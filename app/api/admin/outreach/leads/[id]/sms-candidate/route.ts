import { NextRequest, NextResponse } from 'next/server'

import { GET as getRelationshipPacket } from '../relationship-packet/route'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildWarmSmsCandidateReview,
  warmSmsCandidateArtifact,
  warmSmsCandidateIdempotencyKey,
  warmSmsCandidateMetadata,
  warmSmsMessageVersionKey,
  warmSmsSubmittedEvidenceKey,
  type WarmSmsCandidateQueueRow,
} from '@/lib/warm-outreach-sms-candidate'
import type { WarmSmsReadiness } from '@/lib/warm-outreach-sms-readiness'

export const dynamic = 'force-dynamic'

type RelationshipPacketBody = {
  error?: string
  smsReadiness?: WarmSmsReadiness
}

type RequestBody = {
  messageText?: string
}

function parseBody(value: unknown): RequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return {
    messageText: typeof record.messageText === 'string' ? record.messageText : undefined,
  }
}

function noSendBoundary(createsQueueArtifact: boolean) {
  return {
    createsQueueArtifact,
    providerCallsEnabled: false,
    smsDeliveryEnabled: false,
    telnyxApiCalled: false,
    externalSendEnabled: false,
    slackDispatchEnabled: false,
    gmailActionEnabled: false,
    n8nDispatchEnabled: false,
    rawPhoneReturned: false,
    rawMessageBodyReturned: false,
    rawCredentialsReturned: false,
    environmentVariablesChanged: false,
    externalRequests: [],
  }
}

function blockedResponse(input: {
  message: string
  status?: number
  smsReadiness?: WarmSmsReadiness
  blockers?: string[]
}) {
  return NextResponse.json(
    {
      version: 'warm-outreach-sms-candidate-route/v1',
      outcome: 'blocked',
      message: input.message,
      blockers: input.blockers ?? input.smsReadiness?.candidateReview.blockedReasons ?? [],
      candidateReview: input.smsReadiness?.candidateReview ?? null,
      executionBoundary: noSendBoundary(false),
    },
    { status: input.status ?? 409 },
  )
}

function existingResponse(row: WarmSmsCandidateQueueRow, contactId: number) {
  const artifact = warmSmsCandidateArtifact(row, contactId)
  return NextResponse.json({
    version: 'warm-outreach-sms-candidate-route/v1',
    outcome: 'existing',
    message: 'An SMS candidate queue row already exists for this contact. No duplicate row was created and no SMS was sent.',
    candidate: artifact,
    executionBoundary: noSendBoundary(false),
  })
}

/**
 * POST /api/admin/outreach/leads/[id]/sms-candidate
 *
 * Prepares one draft SMS outreach_queue row for operator review. This route is
 * deliberately no-send: it never calls Telnyx, never dispatches Slack/Gmail/n8n,
 * never reads credentials, and never returns raw phone numbers.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      )
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const { id: idParam } = await params
    const contactId = parseInt(idParam, 10)
    if (Number.isNaN(contactId) || contactId < 1) {
      return blockedResponse({
        message: 'SMS candidate preparation blocked. Invalid lead ID.',
        blockers: ['Invalid lead ID.'],
        status: 400,
      })
    }

    let body: RequestBody = {}
    try {
      body = parseBody(await request.json())
    } catch {
      body = {}
    }

    const relationshipResponse = await getRelationshipPacket(request, {
      params: Promise.resolve({ id: idParam }),
    })
    const relationshipBody = (await relationshipResponse.json().catch(() => ({}))) as RelationshipPacketBody
    if (!relationshipResponse.ok || !relationshipBody.smsReadiness) {
      return blockedResponse({
        message:
          relationshipBody.error ?? 'SMS candidate preparation blocked. Relationship readiness is unavailable.',
        blockers: [relationshipBody.error ?? 'relationship readiness unavailable'],
        status: relationshipResponse.status,
      })
    }

    const readiness = relationshipBody.smsReadiness
    if (readiness.candidateReview.state === 'candidate_exists' && readiness.candidateReview.queueArtifact) {
      return NextResponse.json({
        version: 'warm-outreach-sms-candidate-route/v1',
        outcome: 'existing',
        message: 'An SMS candidate queue row already exists for this contact. No duplicate row was created and no SMS was sent.',
        candidate: readiness.candidateReview.queueArtifact,
        candidateReview: readiness.candidateReview,
        executionBoundary: noSendBoundary(false),
      })
    }

    if (readiness.candidateReview.state === 'blocked_missing_prerequisites' || readiness.state === 'blocked') {
      return blockedResponse({
        message: `SMS candidate preparation blocked. ${readiness.candidateReview.detail}`,
        smsReadiness: readiness,
      })
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('outreach_queue')
      .select(
        'id, contact_submission_id, channel, status, subject, sequence_step, thread_id, message_id, sent_at, replied_at, generation_inputs, created_at',
      )
      .eq('contact_submission_id', contactId)
      .in('channel', ['sms', 'phone_contact'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (existingError) {
      return blockedResponse({
        message: 'SMS candidate preparation blocked. Existing SMS queue lookup failed.',
        blockers: ['existing SMS queue lookup failed'],
        status: 503,
      })
    }

    const existingCandidate = ((existingRows ?? []) as WarmSmsCandidateQueueRow[])
      .find((row) => warmSmsCandidateArtifact(row, contactId))
    if (existingCandidate) return existingResponse(existingCandidate, contactId)

    const messageText = (body.messageText ?? readiness.draft.preview).trim()
    if (!messageText) {
      return blockedResponse({
        message: 'SMS candidate preparation blocked. SMS draft text is missing.',
        blockers: ['SMS draft text is missing.'],
        status: 400,
      })
    }
    if (messageText.length > readiness.draft.maxRecommendedCharacters) {
      return blockedResponse({
        message: `SMS candidate preparation blocked. Draft text must be at most ${readiness.draft.maxRecommendedCharacters} characters.`,
        blockers: [`Draft text must be at most ${readiness.draft.maxRecommendedCharacters} characters.`],
        status: 400,
      })
    }

    const messageVersionKey = warmSmsMessageVersionKey(contactId, readiness.draft.templateFamily)
    const pendingIdempotencyKey = warmSmsCandidateIdempotencyKey({
      contactId,
      messageVersionKey,
    })
    const pendingSubmittedEvidenceKey = warmSmsSubmittedEvidenceKey({
      contactId,
      messageVersionKey,
    })
    const now = new Date().toISOString()
    const generationInputs = warmSmsCandidateMetadata({
      contactId,
      contactName: readiness.contactName,
      messageVersionKey,
      smsSendIdempotencyKey: pendingIdempotencyKey,
      submittedEvidenceKey: pendingSubmittedEvidenceKey,
      templateFamily: readiness.draft.templateFamily,
      templateLabel: readiness.draft.templateLabel,
      preparedBy: authResult.user.id,
      preparedAt: now,
    })

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('outreach_queue')
      .insert({
        contact_submission_id: contactId,
        channel: 'sms',
        subject: 'Warm SMS candidate',
        body: messageText,
        sequence_step: 1,
        status: 'draft',
        generation_model: 'warm_sms_candidate_review/v1',
        generation_prompt_summary: `review_only:${readiness.draft.templateFamily}:no_send`,
        generation_inputs: generationInputs,
      })
      .select('id, contact_submission_id, channel, status, subject, sequence_step, thread_id, message_id, sent_at, replied_at, generation_inputs, created_at')
      .single()

    if (insertError || !inserted?.id) {
      const detail = insertError?.message?.toLowerCase().includes('check constraint')
        ? 'Database channel constraint does not allow SMS queue rows yet.'
        : 'Failed to save SMS candidate queue row.'
      return blockedResponse({
        message: `SMS candidate preparation blocked. ${detail}`,
        blockers: [detail],
        status: 503,
      })
    }

    const insertedRow = inserted as WarmSmsCandidateQueueRow
    const insertedArtifact = warmSmsCandidateArtifact(insertedRow, contactId)
    const candidateReview = buildWarmSmsCandidateReview({
      readiness,
      queueRows: [insertedRow],
    })

    return NextResponse.json({
      version: 'warm-outreach-sms-candidate-route/v1',
      outcome: 'created',
      message: 'SMS candidate queue row prepared for review. No SMS was sent and no Telnyx call was made.',
      candidate: insertedArtifact,
      candidateReview,
      executionBoundary: noSendBoundary(true),
    })
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/leads/[id]/sms-candidate:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        executionBoundary: noSendBoundary(false),
      },
      { status: 500 },
    )
  }
}
