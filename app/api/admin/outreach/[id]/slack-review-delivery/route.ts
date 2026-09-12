import { CONFIRMED_PREFLIGHT_REJECTION } from '@/lib/warm-outreach-action-outcome'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSlackAgentDeliveryConfig } from '@/lib/slack-agent-environment'
import { requireAuthorizedSlackChannel } from '@/lib/slack-agent-access'
import { startAgentRun } from '@/lib/agent-run'
import { warmFinalCopyFingerprint } from '@/lib/warm-outreach-copy-fingerprint'
import { warmCopyBlocker, warmCopyEvidenceBlocker } from '@/lib/warm-outreach-copy-quality'
import { buildWarmGmailSendApprovalSlackPayload, warmGmailReviewMessageVersionKey } from '@/lib/warm-outreach-slack-send-approval'
import { GET as getRelationshipPacket } from '@/app/api/admin/outreach/leads/[id]/relationship-packet/route'
import type { WarmOutreachResponseMonitoring } from '@/lib/warm-outreach-response-monitoring'
export const dynamic = 'force-dynamic'
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let confirmedPreflight = true
  const blocked = (message: string, status = 409, confirmed = confirmedPreflight) => NextResponse.json({ message, status: 'blocked', sent: false, ...(confirmed ? { actionOutcome: CONFIRMED_PREFLIGHT_REJECTION } : {}) }, { status })
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return blocked(auth.error, auth.status)
  // This on-demand action has its own gate; it never enables scheduled notifications.
  if (process.env.ENABLE_WARM_GMAIL_SLACK_REVIEW_DELIVERY !== 'true') return blocked('Slack review delivery is disabled. Configure the approved Slack destination and enable the on-demand review delivery gate, then refresh.')
  let config: ReturnType<typeof getSlackAgentDeliveryConfig>
  try { config = getSlackAgentDeliveryConfig({ ...process.env, SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'true' }) }
  catch (error) { return blocked(error instanceof Error ? error.message : 'Slack delivery configuration is unavailable.') }
  const teamId = process.env.SLACK_AGENT_OPS_TEAM_ID?.trim()
  if (!teamId || !/^T[A-Z0-9]+$/.test(teamId)) return blocked('Configure the authorized Slack workspace ID before delivery.')
  const channelAuthorization = requireAuthorizedSlackChannel(config.channel)
  if (!channelAuthorization.ok) return blocked(channelAuthorization.text)
  if (!supabaseAdmin) return blocked('Database unavailable.', 503)
  const body = record(await request.json().catch(() => null))
  const { id } = await params
  const { data: item, error } = await supabaseAdmin.from('outreach_queue')
    .select('id, contact_submission_id, channel, status, subject, body, sent_at, updated_at, generation_inputs, contact_submissions(id,name,email)')
    .eq('id', id).maybeSingle()
  if (error || !item) return blocked('Outreach item not found.', 404)
  const inputs = record(item.generation_inputs)
  if (item.sent_at || ['queued', 'sent'].includes(String(item.status)) || inputs.warm_gmail_review_slack_delivery || warmCopyEvidenceBlocker(inputs)) confirmedPreflight = false
  const approvalRequest = record(inputs.warm_gmail_send_slack_approval_request)
  const draft = record(inputs.gmail_draft_creation)
  const fingerprint = warmFinalCopyFingerprint(item)
  if (item.sent_at || item.status !== 'approved' || item.channel !== 'email' || !item.updated_at || !item.contact_submissions?.email ||
    warmCopyBlocker(item.body) || warmCopyEvidenceBlocker(inputs) || inputs.copy_revision_requires_provider_reconciliation ||
    draft.final_copy_fingerprint !== fingerprint || !draft.draft_id || approvalRequest.final_copy_fingerprint !== fingerprint ||
    approvalRequest.message_version_key !== warmGmailReviewMessageVersionKey(fingerprint, inputs) || approvalRequest.outreach_queue_id !== id || Number(approvalRequest.contact_submission_id) !== item.contact_submission_id ||
    approvalRequest.gmail_draft_id !== draft.draft_id || approvalRequest.status !== 'pending' || !approvalRequest.request_key ||
    inputs.warm_gmail_send_authorization || inputs.warm_gmail_review_slack_delivery) {
    return blocked('Current copy, mailbox, or review request is not ready, or a delivery already exists. Refresh the review and reconcile existing delivery before retrying.')
  }
  const packetResponse = await getRelationshipPacket(request, { params: Promise.resolve({ id: String(item.contact_submission_id) }) })
  const packet = await packetResponse.json() as { responseMonitoring?: WarmOutreachResponseMonitoring }
  const lifecycle = packet.responseMonitoring?.sendReadiness?.modes?.warm_1_to_1?.find(entry => entry.channel === 'email')?.emailSendLifecycle
  if (!packetResponse.ok || !lifecycle || lifecycle.suppressionCheck.status !== 'clear' ||
    lifecycle.externalSendReadiness.suppressionConsent.state !== 'clear' ||
    lifecycle.messageVersionKey !== approvalRequest.lifecycle_message_version_key ||
    lifecycle.sendQueueIdempotencyKey !== approvalRequest.send_queue_idempotency_key) return blocked('Relationship or review scope changed. Rebuild the review after checking its current evidence.')
  const expectedAuthorization = { sendReviewToSlack: true, expectedUpdatedAt: item.updated_at, finalCopyFingerprint: fingerprint, requestKey: approvalRequest.request_key, workspaceId: teamId, channelId: config.channel, recipientEmail: item.contact_submissions.email }
  if (body.prepareOnly === true) return NextResponse.json({ readyForConfirmation: true, sent: false, expectedAuthorization,
    slackDestination: { workspaceId: teamId, channelId: config.channel },
    reviewedCopy: { queueId: item.id, recipientEmail: item.contact_submissions.email, subject: item.subject ?? '', body: item.body ?? '', sender: lifecycle.externalSendReadiness.senderIdentity.requiredSender, updatedAt: item.updated_at } })
  if (Object.entries(expectedAuthorization).some(([key, value]) => body[key] !== value)) return blocked('Confirm the current exact review and configured Slack destination before delivery.')
  // Verify the bot belongs to the authorized workspace before claiming or posting private copy.
  try {
    const identityResponse = await fetch('https://slack.com/api/auth.test', { method: 'POST', headers: { Authorization: `Bearer ${config.token}` }, signal: AbortSignal.timeout(10000) })
    const identity = await identityResponse.json()
    if (!identityResponse.ok || identity.ok !== true || identity.team_id !== teamId) return blocked('Slack bot workspace could not be verified. Check the configured workspace and bot before retrying.')
  } catch { return blocked('Slack workspace verification failed. No review message was posted.', 503) }
  const claimToken = randomUUID()
  const now = new Date(Math.max(Date.now(), Date.parse(item.updated_at) + 1)).toISOString()
  const metadata = { delivery_claim_token: claimToken, outreach_queue_id: id, final_copy_fingerprint: fingerprint, request_key: approvalRequest.request_key, workspace_id: teamId, channel_id: config.channel }
  let runId: string
  try {
    confirmedPreflight = false
    const run = await startAgentRun({ agentKey: 'chief-of-staff', runtime: 'manual', kind: 'warm_gmail_slack_review', title: 'Send warm Gmail review to Slack', status: 'queued', triggerSource: 'admin_warm_gmail_review_click', metadata, idempotencyKey: `warm-gmail-slack-review:${id}:${fingerprint}:${approvalRequest.request_key}` })
    runId = run.id
    const claim = await supabaseAdmin.from('agent_runs').update({ status: 'running', metadata, current_step: 'Sending warm Gmail review to Slack' }).eq('id', runId).eq('status', 'queued').select('id').maybeSingle()
    if (claim.error || !claim.data?.id) return blocked('This review delivery is already claimed or completed. Reconcile its receipt before retrying.')
  } catch { return blocked('Delivery claim could not be confirmed. Reconcile the existing run before retrying.', 503) }
  const delivery = { state: 'dispatching', workspace_id: teamId, channel_id: config.channel, run_id: runId, claim_token: claimToken, final_copy_fingerprint: fingerprint, request_key: approvalRequest.request_key }
  const queueClaim = await supabaseAdmin.from('outreach_queue').update({ generation_inputs: { ...inputs, warm_gmail_review_slack_delivery: delivery }, updated_at: now })
    .eq('id', id).eq('status', 'approved').eq('updated_at', item.updated_at).select('id,updated_at').maybeSingle()
  if (!queueClaim.error && !queueClaim.data) return blocked('Copy changed before delivery. Refresh and review the current state.', 409, true)
  if (queueClaim.error || !queueClaim.data?.updated_at) return blocked('Copy changed before delivery. No review was posted; reconcile the reserved delivery run.')
  const card = buildWarmGmailSendApprovalSlackPayload({ contactId: item.contact_submission_id, outreachQueueId: id, recipientLabel: item.contact_submissions.name || item.contact_submissions.email, recipientEmail: item.contact_submissions.email, relationshipBasisSummary: lifecycle.relationshipProvenance.detail, proposedSubject: item.subject, proposedMessage: item.body, portfolioUrl: `${config.sourceOrigin}/admin/outreach?tab=leads&id=${item.contact_submission_id}&contactId=${item.contact_submission_id}&draftReview=${encodeURIComponent(id)}#warm-gmail-draft-review`, gmailDraftUrl: 'https://mail.google.com/mail/#drafts', lifecycle: { ...lifecycle, messageVersionKey: String(approvalRequest.message_version_key) } })
  let receipt: { channel: string; ts: string } | null = null
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: config.channel, text: card.text, blocks: [{ type: 'context', elements: [{ type: 'mrkdwn', text: `${config.sourceEnvironment} · ${config.sourceOrigin}` }] }, ...card.blocks], unfurl_links: false, unfurl_media: false }), signal: AbortSignal.timeout(10000) })
    const result = await response.json()
    if (response.ok && result.ok === true && result.channel === config.channel && typeof result.ts === 'string' && /^\d+\.\d+$/.test(result.ts)) receipt = { channel: result.channel, ts: result.ts }
  } catch { /* The durable claim stays locked; a timeout does not prove nondelivery. */ }
  const outcome = { sent: Boolean(receipt), uncertain: !receipt, slack_channel: receipt?.channel ?? null, slack_message_ts: receipt?.ts ?? null, workspace_id: teamId }
  try {
  const savedRun = await supabaseAdmin.from('agent_runs').update({ status: receipt ? 'completed' : 'running', outcome, updated_at: new Date().toISOString() }).eq('id', runId).eq('status', 'running').eq('metadata->>delivery_claim_token', claimToken).select('id').maybeSingle()
  const finalDelivery = { ...delivery, state: receipt ? 'sent' : 'outcome_unknown', ...outcome }
  const savedQueue = await supabaseAdmin.from('outreach_queue').update({ generation_inputs: { ...inputs, warm_gmail_review_slack_delivery: finalDelivery }, updated_at: new Date(Math.max(Date.now(), Date.parse(queueClaim.data.updated_at) + 1)).toISOString() }).eq('id', id).eq('status', 'approved').eq('updated_at', queueClaim.data.updated_at).select('id').maybeSingle()
  if (savedRun.error || !savedRun.data?.id || savedQueue.error || !savedQueue.data?.id) return NextResponse.json({ status: 'receipt_repair_required', sent: Boolean(receipt), uncertain: !receipt, receipt, message: 'Slack delivery tracking needs reconciliation. Do not resend this review.' }, { status: 502 })
  } catch { return NextResponse.json({ status: 'receipt_repair_required', sent: Boolean(receipt), uncertain: !receipt, receipt, message: 'Slack delivery tracking is unavailable. Reconcile the existing receipt before retrying.' }, { status: 502 }) }
  return NextResponse.json({ status: receipt ? 'sent' : 'outcome_unknown', sent: Boolean(receipt), uncertain: !receipt, receipt, message: receipt ? 'Review delivered to the configured Slack channel. Gmail send remains a separate action.' : 'Slack delivery outcome is unknown. Reconcile the channel and receipt before retrying.' }, { status: receipt ? 200 : 502 })
}
