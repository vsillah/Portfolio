import { createHash } from 'crypto'

import { mrkdwn, slackButton, truncateSlack, type SlackBlock } from '@/lib/agent-slack-blocks'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  WarmOutreachEmailSendLifecycle,
  WarmOutreachExternalSendReadiness,
} from '@/lib/warm-outreach-response-monitoring'

type JsonRecord = Record<string, unknown>

export type WarmGmailSendApprovalDecisionStatus =
  | 'approved'
  | 'rejected'
  | 'revision_requested'

export type WarmGmailSendApprovalCardInput = {
  contactId: number
  outreachQueueId?: string | null
  recipientLabel: string
  recipientEmail?: string | null
  relationshipBasisSummary: string
  proposedSubject?: string | null
  proposedMessage?: string | null
  portfolioUrl?: string | null
  gmailDraftUrl?: string | null
  lifecycle: WarmOutreachEmailSendLifecycle
}

export type WarmGmailSendApprovalSlackPayload = {
  text: string
  blocks: SlackBlock[]
  dedupeKey: string
  actionScope: {
    contactId: number
    outreachQueueId: string | null
    messageVersionKey: string
    sendQueueIdempotencyKey: string
  }
  executionBoundary: {
    portfolioCanonicalAudit: true
    slackAttentionSurfaceOnly: true
    gmailSendCalled: false
    externalSendEnabled: false
    providerExecutionEnabled: false
  }
}

type OutreachQueueDecisionRow = {
  id: string
  contact_submission_id: number
  channel: string | null
  status: string | null
  generation_inputs: JsonRecord | null
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20)
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function decisionLabel(status: WarmGmailSendApprovalDecisionStatus) {
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  return 'revision requested'
}

export function warmGmailSendApprovalDedupeKey(input: {
  contactId: number
  messageVersionKey: string
}) {
  return `warm-outreach:slack-gmail-send-card:v1:${stableHash({
    contactId: input.contactId,
    messageVersionKey: input.messageVersionKey,
  })}`
}

export function warmGmailSendAuthorizationDecisionKey(input: {
  contactId: number
  messageVersionKey: string
}) {
  return `warm-outreach:slack-gmail-send-decision:v1:${stableHash({
    contactId: input.contactId,
    messageVersionKey: input.messageVersionKey,
  })}`
}

function approvalActionValue(input: {
  action: string
  contactId: number
  outreachQueueId?: string | null
  messageVersionKey: string
  sendQueueIdempotencyKey: string
  note: string
}) {
  return {
    action: input.action,
    contactId: input.contactId,
    outreachQueueId: input.outreachQueueId ?? undefined,
    messageVersionKey: input.messageVersionKey,
    sendQueueIdempotencyKey: input.sendQueueIdempotencyKey,
    note: input.note,
  }
}

function suppressionSummary(readiness: WarmOutreachExternalSendReadiness) {
  if (readiness.suppressionConsent.state === 'clear') return readiness.suppressionConsent.detail
  return readiness.suppressionConsent.reasons[0] ?? readiness.suppressionConsent.detail
}

function draftSummary(input: WarmGmailSendApprovalCardInput) {
  const draft = input.lifecycle.externalSendReadiness.draftEvidence
  if (draft.gmailDraftExists) {
    const draftLabel = draft.draftId ? `Gmail draft ${draft.draftId}` : 'Tracked Gmail draft'
    return input.gmailDraftUrl ? `<${input.gmailDraftUrl}|${draftLabel}>` : draftLabel
  }
  const subject = input.proposedSubject?.trim()
  const message = input.proposedMessage?.trim()
  if (subject || message) {
    return `${subject ? `Subject: ${truncateSlack(subject, 90)}. ` : ''}${truncateSlack(message, 320)}`
  }
  return draft.detail
}

export function buildWarmGmailSendApprovalSlackPayload(
  input: WarmGmailSendApprovalCardInput,
): WarmGmailSendApprovalSlackPayload {
  const external = input.lifecycle.externalSendReadiness
  const scope = {
    contactId: input.contactId,
    outreachQueueId: input.outreachQueueId ?? null,
    messageVersionKey: input.lifecycle.messageVersionKey,
    sendQueueIdempotencyKey: input.lifecycle.sendQueueIdempotencyKey,
  }
  const warning =
    'Approve Send records explicit external-send authorization in Portfolio for this recipient and message version. Gmail send execution remains disabled in this phase.'
  const text = `Warm Gmail send approval needed: ${input.recipientLabel}`
  const fields = [
    `*Recipient:*\n${input.recipientLabel}${input.recipientEmail ? ` <${input.recipientEmail}>` : ''}`,
    `*Relationship basis:*\n${truncateSlack(input.relationshipBasisSummary, 260)}`,
    `*Sender:*\nRequired: ${external.senderIdentity.requiredSender ?? 'not configured'}\nConnected: ${external.senderIdentity.connectedAs ?? 'not verified'}`,
    `*Suppression / consent:*\n${external.suppressionConsent.state} - ${truncateSlack(suppressionSummary(external), 220)}`,
    `*Draft / message evidence:*\n${draftSummary(input)}`,
    `*Send key:*\n${input.lifecycle.sendQueueIdempotencyKey}`,
  ]

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn(`*Warm Gmail send review*\n${warning}`),
    },
    {
      type: 'section',
      fields: fields.map((field) => mrkdwn(field)),
    },
    {
      type: 'context',
      elements: [
        mrkdwn(`Message version: \`${input.lifecycle.messageVersionKey}\``),
      ],
    },
    {
      type: 'actions',
      elements: [
        slackButton({
          label: 'Approve Send',
          actionId: 'warm_gmail_send.approve',
          style: 'primary',
          value: approvalActionValue({
            ...scope,
            action: 'warm_gmail_send.approve',
            note: 'Approve Send tapped in Slack. Record approval intent only; do not call Gmail send.',
          }),
          confirmText: warning,
        }),
        slackButton({
          label: 'Reject',
          actionId: 'warm_gmail_send.reject',
          style: 'danger',
          value: approvalActionValue({
            ...scope,
            action: 'warm_gmail_send.reject',
            note: 'Rejected from Slack. Keep Gmail send blocked.',
          }),
        }),
        slackButton({
          label: 'Revise',
          actionId: 'warm_gmail_send.revise',
          value: approvalActionValue({
            ...scope,
            action: 'warm_gmail_send.revise',
            note: 'Revision requested from Slack. Keep Gmail send blocked.',
          }),
        }),
        ...(input.portfolioUrl
          ? [
              slackButton({
                label: 'Open Portfolio',
                actionId: 'warm_gmail_send.open_portfolio',
                url: input.portfolioUrl,
              }),
            ]
          : []),
      ],
    },
  ]

  return {
    text,
    blocks,
    dedupeKey: warmGmailSendApprovalDedupeKey({
      contactId: input.contactId,
      messageVersionKey: input.lifecycle.messageVersionKey,
    }),
    actionScope: scope,
    executionBoundary: {
      portfolioCanonicalAudit: true,
      slackAttentionSurfaceOnly: true,
      gmailSendCalled: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
    },
  }
}

export async function decideWarmGmailSendAuthorizationFromSlack(input: {
  contactId: number
  outreachQueueId: string
  messageVersionKey: string
  sendQueueIdempotencyKey: string
  status: WarmGmailSendApprovalDecisionStatus
  actorLabel: string
  slackUserId: string
  decisionNotes: string
  idempotencyKey: string
}) {
  if (!supabaseAdmin) throw new Error('Database not available')

  const { data, error } = await supabaseAdmin
    .from('outreach_queue')
    .select('id, contact_submission_id, channel, status, generation_inputs')
    .eq('id', input.outreachQueueId)
    .maybeSingle()

  if (error || !data?.id) throw new Error('Outreach queue row not found')
  const row = data as OutreachQueueDecisionRow
  if (Number(row.contact_submission_id) !== input.contactId) {
    throw new Error('Slack send authorization target does not match the recipient')
  }
  if (row.channel !== 'email') {
    return 'Portfolio review required: Slack send authorization only supports warm Gmail queue rows.'
  }

  const generationInputs = record(row.generation_inputs)
  const decisionKey = warmGmailSendAuthorizationDecisionKey({
    contactId: input.contactId,
    messageVersionKey: input.messageVersionKey,
  })
  const existing = record(generationInputs.warm_gmail_send_authorization)
  if (existing.decision_key === decisionKey && typeof existing.status === 'string') {
    return `Warm Gmail send ${existing.status} was already recorded for this recipient and message version. No Gmail send was called.`
  }

  const decidedAt = new Date().toISOString()
  const decision = {
    version: 'warm-outreach-slack-gmail-send-authorization/v1',
    decision_key: decisionKey,
    status: input.status,
    decision_notes: input.decisionNotes,
    contact_submission_id: input.contactId,
    outreach_queue_id: input.outreachQueueId,
    message_version_key: input.messageVersionKey,
    send_queue_idempotency_key: input.sendQueueIdempotencyKey,
    decided_by_slack_user_id: input.slackUserId,
    decided_by_label: input.actorLabel,
    decided_at: decidedAt,
    slack_action_idempotency_key: input.idempotencyKey,
    approval_intent_recorded: input.status === 'approved',
    external_send_authorization_intent: input.status === 'approved',
    external_send_enabled: false,
    provider_execution_enabled: false,
    gmail_send_called: false,
    external_send_performed: false,
    send_execution_gate: 'disabled_until_separate_send_execution_pr',
  }
  const history = Array.isArray(generationInputs.warm_gmail_send_authorization_history)
    ? generationInputs.warm_gmail_send_authorization_history
    : []

  const { error: updateError } = await supabaseAdmin
    .from('outreach_queue')
    .update({
      generation_inputs: {
        ...generationInputs,
        warm_gmail_send_authorization: decision,
        warm_gmail_send_authorization_history: [decision, ...history].slice(0, 25),
      },
      updated_at: decidedAt,
    })
    .eq('id', row.id)

  if (updateError) {
    throw new Error(`Failed to record warm Gmail send authorization: ${updateError.message}`)
  }

  return input.status === 'approved'
    ? 'Warm Gmail send approval intent recorded in Portfolio. Gmail send execution remains disabled and no email was sent.'
    : `Warm Gmail send ${decisionLabel(input.status)} in Portfolio. Gmail send execution remains disabled and no email was sent.`
}
