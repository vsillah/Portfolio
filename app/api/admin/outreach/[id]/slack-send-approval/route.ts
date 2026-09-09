import { warmGmailReviewMessageVersionKey } from '@/lib/warm-outreach-slack-send-approval'
import { warmFinalCopyFingerprint } from '@/lib/warm-outreach-copy-fingerprint'
import { warmCopyBlocker, warmCopyEvidenceBlocker } from '@/lib/warm-outreach-copy-quality'
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
  updated_at: string
  id: string
  contact_submission_id: number
  channel: string | null
  status: string | null
  subject: string | null
  body: string | null
  thread_id: string | null
  message_id: string | null
  sent_at: string | null
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

function evidence(
  generationInputs: Record<string, unknown>,
  snakeKey: string,
  camelKey: string,
): Record<string, unknown> {
  return {
    ...record(generationInputs[snakeKey]),
    ...record(generationInputs[camelKey]),
  }
}

function stringValue(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function gmailDraftUrl(generationInputs: Record<string, unknown>) {
  const draft = evidence(generationInputs, 'gmail_draft_creation', 'gmailDraftCreation')
  const draftId = stringValue(draft.draft_id) ?? stringValue(draft.draftId)
  return draftId ? `https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(draftId)}` : null
}

function blockedBoundary() {
  return {
    portfolioCanonicalAudit: true,
    slackAttentionSurfaceOnly: true,
    gmailSendCalled: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    schedulingEnabled: false,
  }
}

function existingAuthorization(generationInputs: Record<string, unknown>) {
  const authorization = evidence(
    generationInputs,
    'warm_gmail_send_authorization',
    'warmGmailSendAuthorization',
  )
  const status = stringValue(authorization.status)?.toLowerCase()
  if (status === 'approved' || status === 'rejected' || status === 'revision_requested') {
    return status
  }
  return null
}

function existingApprovalRequest(generationInputs: Record<string, unknown>) {
  return evidence(
    generationInputs,
    'warm_gmail_send_slack_approval_request',
    'warmGmailSendSlackApprovalRequest',
  )
}

function requestDedupeKey(request: Record<string, unknown>) {
  return (
    stringValue(request.request_key) ??
    stringValue(request.requestKey) ??
    stringValue(request.payload_dedupe_key) ??
    stringValue(request.payloadDedupeKey)
  )
}

function requestTimestamp(request: Record<string, unknown>) {
  return stringValue(request.requested_at) ?? stringValue(request.requestedAt)
}

function approvalRequestHistory(generationInputs: Record<string, unknown>) {
  if (Array.isArray(generationInputs.warm_gmail_send_slack_approval_request_history)) {
    return generationInputs.warm_gmail_send_slack_approval_request_history
  }
  if (Array.isArray(generationInputs.warmGmailSendSlackApprovalRequestHistory)) {
    return generationInputs.warmGmailSendSlackApprovalRequestHistory
  }
  return []
}

function existingSubmittedEvidence(
  item: QueueRow,
  generationInputs: Record<string, unknown>,
) {
  const queueStatus = stringValue(item.status)?.toLowerCase()
  if (queueStatus === 'sent' || queueStatus === 'submitted' || queueStatus === 'delivered') {
    return queueStatus
  }
  if (stringValue(item.sent_at)) {
    return 'sent_at'
  }

  const execution = evidence(
    generationInputs,
    'warm_gmail_send_execution',
    'warmGmailSendExecution',
  )
  const executionStatus = stringValue(execution.status)?.toLowerCase()
  if (
    executionStatus === 'sent' ||
    executionStatus === 'submitted' ||
    executionStatus === 'delivered' ||
    executionStatus === 'sent_secondary_log_repair_required'
  ) {
    return executionStatus
  }
  if (
    execution.gmail_send_called === true ||
    execution.gmailSendCalled === true ||
    execution.external_send_performed === true ||
    execution.externalSendPerformed === true
  ) {
    return 'external_send_evidence'
  }
  return null
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

  const requestBody = await request.json().catch(() => ({}))
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
      sent_at,
      updated_at,
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
  if (item.status !== 'approved' || !item.updated_at || requestBody.expectedUpdatedAt !== item.updated_at) {
    return NextResponse.json({ error: 'Reload and review the current approved copy before requesting send approval.' }, { status: 409 })
  }
  const copyBlocker = warmCopyBlocker(item.body) ?? warmCopyEvidenceBlocker(item.generation_inputs)
  if (copyBlocker) return NextResponse.json({ error: copyBlocker }, { status: 409 })
  const fingerprint = warmFinalCopyFingerprint(item)
  const trackedDraft = record(item.generation_inputs?.gmail_draft_creation)
  if (trackedDraft.final_copy_fingerprint !== fingerprint || item.generation_inputs?.copy_revision_requires_provider_reconciliation === true) {
    return NextResponse.json({ error: 'Mailbox draft does not match the current copy. Reconcile it before requesting approval.' }, { status: 409 })
  }
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
  if (!lifecycle.realRecipientRolloutReadiness.canBuildSlackApprovalPayload) {
    return NextResponse.json(
      {
        error: 'Warm Gmail send approval cannot be requested until the real-recipient readiness blockers are resolved.',
        readiness: lifecycle.realRecipientRolloutReadiness,
        executionBoundary: {
          portfolioCanonicalAudit: true,
          slackAttentionSurfaceOnly: true,
          gmailSendCalled: false,
          externalSendEnabled: false,
          providerExecutionEnabled: false,
          schedulingEnabled: false,
        },
      },
      { status: 409 },
    )
  }

  const generationInputs = record(item.generation_inputs)
  if (generationInputs.warm_gmail_review_slack_delivery) return NextResponse.json({ error: 'A Slack review delivery already exists. Reconcile its receipt before rebuilding the request.' }, { status: 409 })
  const authorizationStatus = existingAuthorization(generationInputs)
  if (authorizationStatus) {
    return NextResponse.json(
      {
        error: `Warm Gmail send approval request is superseded by existing ${authorizationStatus.replace(/_/g, ' ')} authorization evidence. No duplicate request was recorded.`,
        executionBoundary: blockedBoundary(),
      },
      { status: 409 },
    )
  }

  const submittedEvidence = existingSubmittedEvidence(item, generationInputs)
  if (submittedEvidence) {
    return NextResponse.json(
      {
        error: `Warm Gmail send approval request is blocked because submitted/send evidence already exists (${submittedEvidence.replace(/_/g, ' ')}). Do not request or send a duplicate.`,
        executionBoundary: blockedBoundary(),
      },
      { status: 409 },
    )
  }

  const contact = item.contact_submissions
  const portfolioUrl = `${baseUrl()}/admin/outreach?tab=leads&filter=warm&id=${item.contact_submission_id}&contactId=${item.contact_submission_id}&queueId=${encodeURIComponent(item.id)}#warm-gmail-operating-loop`
  const reviewMessageVersionKey = warmGmailReviewMessageVersionKey(fingerprint, generationInputs)
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
    lifecycle: { ...lifecycle, messageVersionKey: reviewMessageVersionKey },
  })
  const now = new Date(Math.max(Date.now(), Date.parse(item.updated_at) + 1)).toISOString()
  const existingRequest = existingApprovalRequest(generationInputs)
  const requestAlreadyRecorded = requestDedupeKey(existingRequest) === card.dedupeKey
  const existingRequestedAt = requestTimestamp(existingRequest)
  const approvalRequest = {
    version: 'warm-outreach-slack-gmail-send-approval-request/v1',
    status: requestAlreadyRecorded && stringValue(existingRequest.status)
      ? existingRequest.status
      : 'pending',
    request_key: card.dedupeKey,
    payload_dedupe_key: card.dedupeKey,
    contact_submission_id: item.contact_submission_id,
    outreach_queue_id: item.id,
    message_version_key: reviewMessageVersionKey,
    final_copy_fingerprint: fingerprint,
    lifecycle_message_version_key: lifecycle.messageVersionKey,
    reviewed_updated_at: item.updated_at,
    recipient_email: contact.email?.trim().toLowerCase(),
    channel: 'email',
    gmail_draft_id: trackedDraft.draft_id,
    submitted_evidence_key: lifecycle.submittedEvidenceKey,
    send_queue_idempotency_key: lifecycle.sendQueueIdempotencyKey,
    route: `/api/admin/outreach/${encodeURIComponent(item.id)}/slack-send-approval`,
    action_ids: ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise'],
    slack_dispatch_enabled: false,
    slack_dispatch_status: 'not_sent',
    requested_at: requestAlreadyRecorded && existingRequestedAt
      ? existingRequestedAt
      : now,
    last_payload_built_at: now,
    records_authorization_intent_only: true,
    gmail_send_called: false,
    external_send_performed: false,
    provider_execution_enabled: false,
    operating_loop_state: 'send_approval_requested',
  }
  const requestHistory = approvalRequestHistory(generationInputs)
  const { data: changed, error: requestError } = await supabaseAdmin
    .from('outreach_queue')
    .update({
      generation_inputs: {
        ...generationInputs,
        warm_gmail_send_slack_approval_request: approvalRequest,
        warm_gmail_send_slack_approval_request_history: requestAlreadyRecorded
          ? requestHistory
          : [approvalRequest, ...requestHistory].slice(0, 25),
      },
      updated_at: now,
    })
    .eq('id', item.id).eq('status', 'approved').eq('updated_at', item.updated_at).select('id, updated_at')

  if (!requestError && !changed?.length) return NextResponse.json({ error: 'Copy changed while requesting approval. Reload; the stale request was not saved.' }, { status: 409 })
  if (requestError) {
    return NextResponse.json(
      { error: `Could not record warm Gmail Slack approval request: ${requestError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    card,
    approvalRequest,
    updatedAt: changed?.[0]?.updated_at ?? now,
    operatingLoopTransition: {
      state: 'send_approval_requested',
      nextState: 'send_authorized',
      nextAction: 'record_send_decision',
      portfolioDeepLink: portfolioUrl,
      recordsAuthorizationIntentOnly: true,
      gmailSendCalled: false,
    },
    slackDispatch: {
      requested: true,
      sent: false,
      reason: 'This route records the approval request and builds the card only. Slack delivery remains a separate activation gate.',
    },
    approvalRecovery: {
      status: 'portfolio_request_recorded_slack_dispatch_disabled',
      label: 'Portfolio recovery path',
      detail:
        'Slack dispatch is disabled in this lane. Portfolio recorded the one-recipient approval request locally and returned the Slack review card payload without posting it.',
      nextAction:
        'Review this request in the contact workroom or approved Slack review surface; record approve, reject, or revise before any separate Gmail send execution gate.',
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
