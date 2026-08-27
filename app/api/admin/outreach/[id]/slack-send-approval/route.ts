import { NextRequest, NextResponse } from 'next/server'

import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { GET as getRelationshipPacket } from '@/app/api/admin/outreach/leads/[id]/relationship-packet/route'
import {
  buildWarmGmailSendApprovalSlackPayload,
} from '@/lib/warm-outreach-slack-send-approval'
import type { WarmOutreachResponseMonitoring } from '@/lib/warm-outreach-response-monitoring'

export const dynamic = 'force-dynamic'

type QueueRow = {
  id: string
  contact_submission_id: number
  channel: string | null
  status: string | null
  subject: string | null
  body: string | null
  thread_id: string | null
  message_id: string | null
  generation_inputs: Record<string, unknown> | null
  contact_submissions:
    | {
        id: number
        name: string | null
        email: string | null
      }
    | null
}

type RelationshipPacketBody = {
  error?: string
  contextSummary?: {
    relationship_basis?: string | null
  }
  responseMonitoring?: WarmOutreachResponseMonitoring
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function gmailDraftUrl(generationInputs: Record<string, unknown>) {
  const draft = record(generationInputs.gmail_draft_creation)
  const draftId = stringValue(draft.draft_id)
  return draftId ? `https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(draftId)}` : null
}

/**
 * POST /api/admin/outreach/[id]/slack-send-approval
 *
 * Builds the warm Gmail send approval Slack card for one outreach queue row.
 * This is a payload scaffold only: it does not post to Slack, call Gmail,
 * schedule sends, or mark the outreach item send-ready.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('outreach_queue')
    .select(
      `
      id,
      contact_submission_id,
      channel,
      status,
      subject,
      body,
      thread_id,
      message_id,
      generation_inputs,
      contact_submissions (
        id,
        name,
        email
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data?.id) {
    return NextResponse.json({ error: 'Outreach item not found' }, { status: 404 })
  }

  const item = data as QueueRow
  if (item.channel !== 'email') {
    return NextResponse.json(
      { error: 'Slack send approval cards are only available for warm Gmail queue rows.' },
      { status: 400 },
    )
  }
  if (!item.contact_submissions?.id) {
    return NextResponse.json(
      { error: 'Outreach item is missing its recipient contact.' },
      { status: 409 },
    )
  }

  const relationshipResponse = await getRelationshipPacket(request, {
    params: Promise.resolve({ id: String(item.contact_submission_id) }),
  })
  const relationshipBody = (await relationshipResponse.json().catch(() => ({}))) as RelationshipPacketBody
  if (!relationshipResponse.ok) {
    return NextResponse.json(
      {
        error: relationshipBody.error ?? 'Could not build warm relationship readiness for Slack review.',
      },
      { status: relationshipResponse.status },
    )
  }

  const lifecycle = relationshipBody.responseMonitoring?.sendReadiness.modes.warm_1_to_1
    .find((entry) => entry.channel === 'email')?.emailSendLifecycle
  if (!lifecycle) {
    return NextResponse.json(
      { error: 'No warm Gmail send lifecycle is available for this recipient.' },
      { status: 409 },
    )
  }

  const generationInputs = record(item.generation_inputs)
  const contact = item.contact_submissions
  const portfolioUrl = `${baseUrl()}/admin/outreach?contactId=${item.contact_submission_id}&queueId=${encodeURIComponent(item.id)}`
  const card = buildWarmGmailSendApprovalSlackPayload({
    contactId: item.contact_submission_id,
    outreachQueueId: item.id,
    recipientLabel: contact.name?.trim() || contact.email?.trim() || `Lead #${item.contact_submission_id}`,
    recipientEmail: contact.email,
    relationshipBasisSummary:
      relationshipBody.contextSummary?.relationship_basis ||
      lifecycle.relationshipProvenance.detail,
    proposedSubject: item.subject,
    proposedMessage: item.body,
    portfolioUrl,
    gmailDraftUrl: gmailDraftUrl(generationInputs),
    lifecycle,
  })

  return NextResponse.json({
    card,
    slackDispatch: {
      requested: false,
      sent: false,
      reason: 'This route builds the approval card only. Slack delivery remains a separate activation gate.',
    },
    executionBoundary: {
      portfolioCanonicalAudit: true,
      slackAttentionSurfaceOnly: true,
      gmailSendCalled: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      schedulingEnabled: false,
    },
  })
}
