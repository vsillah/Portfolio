import { createHash, randomUUID } from 'node:crypto'
import { getEvidenceRepairReview, evidenceRepairReviewPath, type RepairBinding } from '@/lib/evidence-repair-human-qa'
import { getSlackAgentDeliveryConfig, getSlackAgentSource } from '@/lib/slack-agent-environment'
import { postToSlack } from '@/lib/agent-slack-delivery'
import { mrkdwn, slackButton, truncateSlack, type SlackBlock, type SlackAgentActionValue } from '@/lib/agent-slack-blocks'
import { supabaseAdmin } from '@/lib/supabase'
import { allowedSlackUserIds } from '@/lib/slack-agent-access'

const KIND = 'evidence_repair_human_qa_request'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[a-f0-9]{64}$/
const slackText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function evidenceRepairSlackEnabled() {
  return process.env.EVIDENCE_REPAIR_SLACK_REVIEW_ENABLED === 'true'
}

export function mappedRepairReviewer(slackUserId: string): string | null {
  if (!evidenceRepairSlackEnabled() || !/^[A-Z0-9]{2,32}$/.test(slackUserId)) return null
  try {
    const map = JSON.parse(process.env.EVIDENCE_REPAIR_SLACK_REVIEWER_MAP || '{}') as Record<string, unknown>
    if (!map || Array.isArray(map) || typeof map !== 'object') return null
    const reviewerId = map[slackUserId]
    return typeof reviewerId === 'string' && UUID.test(reviewerId) ? reviewerId : null
  } catch { return null }
}

export function evidenceRepairSlackCard(input: {
  requestId: string; binding: RepairBinding; title: string; sourceUrl: string
  sourceUseBoundary: string; supportedClaims: string[]; removedClaims: string[]
  expiresAt: string
}) {
  const source = getSlackAgentSource()
  const base: SlackAgentActionValue = {
    action: 'evidence_repair.approve', schemaVersion: 'evidence-repair-human-qa/v1',
    sourceEnvironment: source.sourceEnvironment, sourceOrigin: source.sourceOrigin,
    repairRequestId: input.requestId, repairCaseId: input.binding.caseId,
    repairPacketId: input.binding.packetId, repairPacketVersion: input.binding.packetVersion,
    repairOriginalPacketId: input.binding.originalPacketId,
    repairOriginalPacketVersion: input.binding.originalPacketVersion,
    repairBindingHash: input.binding.bindingHash, repairSourceSha256: input.binding.sourceSha256,
    repairSourceExpiresAt: input.binding.sourceExpiresAt,
    repairCopySha256: input.binding.approvedCopySha256,
    repairClaimBoundarySha256: input.binding.claimBoundarySha256,
    repairContentVersion: input.binding.contentVersion,
    repairExpiresAt: input.expiresAt, calendarItemId: input.binding.calendarItemId,
    contentId: input.binding.socialContentId,
  }
  const url = `${source.sourceOrigin}${evidenceRepairReviewPath(input.binding.packetId)}`
  const claims = input.supportedClaims.slice(0, 3).map(value => `• ${slackText(truncateSlack(value, 170))}`).join('\n')
    + (input.supportedClaims.length > 3 ? `\n• ${input.supportedClaims.length - 3} more in Portfolio` : '')
  const removed = input.removedClaims.length ? `${input.removedClaims.length} source-derived assertion(s) removed.` : 'No removed assertions recorded.'
  const text = `Review-only evidence repair: ${input.title}. Source: ${input.sourceUrl}. Expires ${input.expiresAt}. Decide in Portfolio: ${url}`
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn(`*Review-only evidence repair* · ${slackText(truncateSlack(input.title, 110))}\nCandidate ${input.binding.packetId} · original ${input.binding.originalPacketId}\nSource: ${slackText(input.sourceUrl)}`) },
    { type: 'section', text: mrkdwn(`*What changed:* replacement source proposed; ${removed}\n*Source-use boundary:* ${slackText(truncateSlack(input.sourceUseBoundary, 300)) || 'Unrecorded'}\n*Supported claims:* ${claims}`) },
    { type: 'section', text: mrkdwn(`*Exact binding:* source SHA-256 ${input.binding.sourceSha256}; claim boundary SHA-256 ${input.binding.claimBoundarySha256}; approved-copy SHA-256 ${input.binding.approvedCopySha256}; content ${input.binding.contentVersion}; candidate ${input.binding.packetVersion}; original ${input.binding.originalPacketVersion}.\n*Decision expires:* ${input.expiresAt}`) },
    { type: 'context', elements: [mrkdwn('Revision records: clarify the source or claim boundary before another review. Rejection records: this source does not support the bounded claim; replace or correct it in Research.')] },
    { type: 'context', elements: [mrkdwn('Approval marks only this packet candidate Human-QA approved. It does not link evidence, change copy, rerun preparation, generate media, upload, schedule, publish, post, or enable external execution.')] },
    { type: 'actions', elements: [
      slackButton({ label: 'Approve evidence only', actionId: 'evidence_repair_approve', style: 'primary', value: { ...base,
        note: 'Exact replacement source and bounded claims approved for internal evidence review only.' } }),
      slackButton({ label: 'Request revision', actionId: 'evidence_repair_revise', value: { ...base,
        action: 'evidence_repair.revise', note: 'Revise the source or claim boundary in Research, then request a new Human QA review.' } }),
      slackButton({ label: 'Reject candidate', actionId: 'evidence_repair_reject', style: 'danger', value: { ...base,
        action: 'evidence_repair.reject', note: 'Source or claim boundary does not support this candidate. Replace or correct the source in Research.' } }),
      slackButton({ label: 'Open Portfolio', actionId: 'evidence_repair_open', url }),
    ] },
  ]
  return { text, blocks, url }
}

export async function requestEvidenceRepairSlackReview(packetId: string, dryRun = false,
  expected?: { packetVersion: string; bindingHash: string }) {
  const review = await getEvidenceRepairReview(packetId)
  if (expected && (review.binding.packetVersion !== expected.packetVersion
    || review.binding.bindingHash !== expected.bindingHash)) {
    throw new Error('Evidence repair binding changed. Refresh the Portfolio review before requesting Slack.')
  }
  const expiresAt = new Date(Math.min(Date.now() + 24 * 60 * 60_000, Date.parse(review.binding.sourceExpiresAt))).toISOString()
  if (Date.parse(expiresAt) <= Date.now()) throw new Error('Evidence repair source expired before Slack delivery.')
  const requestId = randomUUID()
  const card = evidenceRepairSlackCard({ requestId, binding: review.binding,
    title: review.title, sourceUrl: review.sourceUrl, sourceUseBoundary: review.sourceUseBoundary,
    supportedClaims: review.supportedClaims, removedClaims: review.removedClaims, expiresAt })
  if (dryRun) return { status: 'dry_run' as const, card, binding: review.binding, expiresAt, external_execution_enabled: false }
  if (!evidenceRepairSlackEnabled()) throw new Error('Evidence repair Slack review is disabled.')
  const config = getSlackAgentDeliveryConfig()
  if (!config.hosted || process.env.SLACK_ACTION_RECEIPTS_ENABLED !== 'true'
    || process.env.SLACK_ACTION_RECEIPTS_ENVIRONMENT !== config.sourceEnvironment
    || !process.env.SLACK_SIGNING_SECRET
    || ![...allowedSlackUserIds()].some(id => mappedRepairReviewer(id))) {
    throw new Error('Signed, allowlisted Slack action receipts are not configured for this source.')
  }
  const teamId = process.env.SLACK_AGENT_OPS_TEAM_ID?.trim()
  if (!teamId || !/^[A-Z0-9]{2,32}$/.test(teamId)) throw new Error('Slack review workspace is not configured.')
  if (!supabaseAdmin) throw new Error('Review database unavailable.')
  const key = `evidence-repair-review-request:${config.sourceEnvironment}:${review.binding.bindingHash}`
  const { data: prior, error: priorError } = await supabaseAdmin.from('agent_runs')
    .select('id,status,outcome,metadata').eq('idempotency_key', key).maybeSingle()
  if (priorError) throw new Error('Slack request receipt read failed.')
  if (prior) return { status: 'already_requested' as const, request_id: prior.id,
    delivery: prior.outcome, external_execution_enabled: false }
  const { data: claim, error: claimError } = await supabaseAdmin.from('agent_runs').insert({
    id: requestId, runtime: 'manual', kind: KIND, title: 'Evidence repair Human QA Slack request',
    status: 'running', started_at: new Date().toISOString(), current_step: 'delivery_claimed',
    trigger_source: 'portfolio_research_review', idempotency_key: key,
    metadata: { binding: review.binding, expires_at: expiresAt, team_id: teamId,
      channel_id: config.channel, source_environment: config.sourceEnvironment,
      source_origin: config.sourceOrigin, external_execution_enabled: false },
    outcome: { delivery: 'unconfirmed' },
  }).select('id').maybeSingle()
  if (claimError?.code === '23505') return { status: 'already_requested' as const, external_execution_enabled: false }
  if (claimError || !claim) throw new Error('Slack request claim was not confirmed.')
  const sent = await postToSlack(card.text, card.blocks, config)
  if (!sent.sent) {
    await supabaseAdmin.from('agent_runs').update({ status: 'waiting_for_approval',
      current_step: sent.uncertain ? 'delivery_uncertain' : 'delivery_rejected',
      outcome: { delivery: sent.uncertain ? 'uncertain' : 'rejected', reason: sent.reason } }).eq('id', requestId)
    return { status: sent.uncertain ? 'uncertain' as const : 'rejected' as const,
      request_id: requestId, external_execution_enabled: false }
  }
  const { data: receipt, error: receiptError } = await supabaseAdmin.from('agent_runs').update({
    status: 'completed', current_step: 'delivered',
    outcome: { delivery: 'sent', channel_id: sent.channel, message_ts: sent.ts },
  }).eq('id', requestId).eq('current_step', 'delivery_claimed').select('id').maybeSingle()
  if (receiptError || !receipt) return { status: 'uncertain' as const,
    request_id: requestId, external_execution_enabled: false }
  return { status: 'sent' as const, request_id: requestId,
    channel_id: sent.channel, message_ts: sent.ts, external_execution_enabled: false }
}

export async function verifyEvidenceRepairSlackRequest(input: {
  requestId: string; bindingHash: string; packetId: string; packetVersion: string
  teamId: string; channelId: string; messageTs: string; userId: string; expiresAt: string
}) {
  if (!evidenceRepairSlackEnabled() || !UUID.test(input.requestId) || !HASH.test(input.bindingHash)) return false
  if (!supabaseAdmin || !mappedRepairReviewer(input.userId)) return false
  const { data, error } = await supabaseAdmin.from('agent_runs')
    .select('id,kind,status,metadata,outcome').eq('id', input.requestId).maybeSingle()
  if (error || !data || data.kind !== KIND || data.status !== 'completed') return false
  const binding = data.metadata?.binding as RepairBinding | undefined
  const source = getSlackAgentSource()
  return data.outcome?.delivery === 'sent' && data.outcome?.channel_id === input.channelId
    && data.outcome?.message_ts === input.messageTs
    && data.metadata?.team_id === input.teamId && data.metadata?.channel_id === input.channelId
    && data.metadata?.source_environment === source.sourceEnvironment
    && data.metadata?.source_origin === source.sourceOrigin
    && data.metadata?.expires_at === input.expiresAt && Date.parse(input.expiresAt) > Date.now()
    && binding?.packetId === input.packetId && binding.packetVersion === input.packetVersion
    && binding.bindingHash === input.bindingHash
}
