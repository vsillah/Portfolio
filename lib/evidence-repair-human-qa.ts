import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH = /^[a-f0-9]{64}$/
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const str = (value: unknown) => typeof value === 'string' ? value : ''
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
// PostgreSQL timestamptz retains microseconds; Date.toISOString() retains only
// milliseconds. Keep the remaining digits when binding a database row to a review.
function exactTimestamp(value: unknown): string {
  const raw = str(value)
  const match = raw.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}(?::?\d{2})?)$/)
  if (!match || !Number.isFinite(Date.parse(raw))) return ''
  const iso = new Date(raw).toISOString()
  const remaining = (match[1] ?? '').padEnd(6, '0').slice(3).replace(/0+$/, '')
  return `${iso.slice(0, -1)}${remaining}Z`
}

export type RepairDecision = 'approve' | 'reject' | 'revise'
export type RepairBinding = {
  caseId: string; packetId: string; packetVersion: string; originalPacketId: string
  originalPacketVersion: string; calendarItemId: string; socialContentId: string
  sourceSha256: string; sourceExpiresAt: string; approvedCopySha256: string
  evidenceVersion: string; contentVersion: string; claimBoundarySha256: string; bindingHash: string
}
type Review = {
  binding: RepairBinding; title: string; sourceUrl: string; sourceUseBoundary: string
  supportedClaims: string[]; removedClaims: string[]; status: string
  candidate: Record<string, unknown>; freshness: Record<string, unknown>; pattern: Record<string, unknown>
}

export class RepairDecisionError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export function repairBinding(input: Omit<RepairBinding, 'bindingHash'>): RepairBinding {
  return { ...input, bindingHash: hash(JSON.stringify(input)) }
}

export async function getEvidenceRepairReview(packetId: string, now = new Date()): Promise<Review> {
  if (!UUID.test(packetId)) throw new RepairDecisionError('Invalid repair packet ID.', 400)
  if (!supabaseAdmin) throw new RepairDecisionError('Review database unavailable.', 503)
  const { data: packet, error } = await supabaseAdmin.from('social_content_research_packets')
    .select('id,title,source_url,status,updated_at,pattern_packet,actor_metadata')
    .eq('id', packetId).maybeSingle()
  if (error) throw new RepairDecisionError('Repair packet read failed.', 503)
  if (!packet) throw new RepairDecisionError('Repair packet not found.', 404)
  const candidate = record(record(packet.actor_metadata).evidence_repair_candidate)
  const freshness = record(record(packet.actor_metadata).source_freshness_receipt)
  const originalPacketId = str(candidate.original_packet_id)
  const calendarItemId = str(candidate.calendar_item_id)
  const socialContentId = str(candidate.social_content_id)
  const sourceSha256 = str(freshness.source_sha256)
  const approvedCopySha256 = str(candidate.approved_social_copy_sha256)
  const expiresAt = str(freshness.expires_at)
  if (![originalPacketId, calendarItemId, socialContentId].every(value => UUID.test(value))
    || !HASH.test(sourceSha256) || !HASH.test(approvedCopySha256)
    || !exactTimestamp(expiresAt)
    || !exactTimestamp(freshness.observed_at)
    || !exactTimestamp(candidate.original_packet_version)
    || !exactTimestamp(packet.updated_at)
    || !exactTimestamp(freshness.evidence_version)) {
    throw new RepairDecisionError('Repair packet lacks exact versioned evidence.')
  }
  try {
    const source = new URL(str(packet.source_url))
    if (source.protocol !== 'https:' || source.username || source.password) throw new Error('unsafe source')
  } catch { throw new RepairDecisionError('Repair source URL is not safe for Human QA.') }
  if (packet.status !== 'review_ready' || candidate.candidate_status !== 'human_qa_pending'
    || candidate.linkage_status !== 'unlinked' || candidate.preparation_rerun_status !== 'not_run'
    || candidate.external_actions_allowed !== false || candidate.approved_social_copy_unchanged !== true
    || freshness.status !== 'passed' || freshness.provenance_status !== 'verified_primary_source'
    || record(freshness.privacy_clearance).status !== 'cleared'
    || record(freshness.rights_clearance).status !== 'cleared_for_bounded_claim_support'
    || freshness.source_url !== packet.source_url
    || Date.parse(expiresAt) <= now.getTime()
    || Date.parse(str(freshness.observed_at)) > now.getTime()
    || exactTimestamp(freshness.evidence_version) !== exactTimestamp(packet.updated_at)) {
    throw new RepairDecisionError('Repair packet is stale, decided, or outside review-only scope.')
  }
  const [originalResult, calendarResult, socialResult] = await Promise.all([
    supabaseAdmin.from('social_content_research_packets').select('id,updated_at,source_url,status').eq('id', originalPacketId).maybeSingle(),
    supabaseAdmin.from('social_content_calendar_items').select('id,social_content_id,authorization_status,metadata').eq('id', calendarItemId).maybeSingle(),
    supabaseAdmin.from('social_content_queue').select('id,post_text,updated_at').eq('id', socialContentId).maybeSingle(),
  ])
  if (originalResult.error || calendarResult.error || socialResult.error) {
    throw new RepairDecisionError('Exact review lineage could not be read.', 503)
  }
  const calendar = calendarResult.data
  const flags = record(calendar?.metadata)
  if (!originalResult.data || exactTimestamp(originalResult.data.updated_at) !== exactTimestamp(candidate.original_packet_version)
    || originalResult.data.status !== 'approved' || originalResult.data.source_url !== candidate.original_source_url
    || !calendar || calendar.social_content_id !== socialContentId || calendar.authorization_status !== 'authorized'
    || ['external_execution_enabled', 'provider_generation_enabled', 'upload_enabled', 'schedule_enabled',
      'publish_enabled', 'outreach_send_enabled'].some(key => flags[key] !== undefined && flags[key] !== false)
    || !socialResult.data || !exactTimestamp(socialResult.data.updated_at)
    || hash(socialResult.data.post_text ?? '') !== approvedCopySha256) {
    throw new RepairDecisionError('Original packet, calendar authorization, approved copy, or external lock changed.')
  }
  const pattern = record(packet.pattern_packet)
  if (!str(pattern.source_use_boundary).trim() || !Array.isArray(pattern.supported_claims)
    || !pattern.supported_claims.length || pattern.supported_claims.some(value => typeof value !== 'string' || !value.trim())) {
    throw new RepairDecisionError('Repair packet lacks a bounded source and claim explanation.')
  }
  const claimBoundarySha256 = hash(JSON.stringify({ source_use_boundary: pattern.source_use_boundary,
    supported_claims: pattern.supported_claims,
    removed_source_derived_assertions: pattern.removed_source_derived_assertions ?? [] }))
  const binding = repairBinding({
    caseId: `calendar:${calendarItemId}:repair-packet:${packetId}`, packetId,
    packetVersion: exactTimestamp(packet.updated_at), originalPacketId,
    originalPacketVersion: exactTimestamp(candidate.original_packet_version),
    calendarItemId, socialContentId, sourceSha256, sourceExpiresAt: exactTimestamp(expiresAt),
    approvedCopySha256, evidenceVersion: exactTimestamp(freshness.evidence_version),
    contentVersion: exactTimestamp(socialResult.data.updated_at), claimBoundarySha256,
  })
  return {
    binding, title: str(packet.title), sourceUrl: str(packet.source_url),
    sourceUseBoundary: str(pattern.source_use_boundary),
    supportedClaims: Array.isArray(pattern.supported_claims) ? pattern.supported_claims.filter((x): x is string => typeof x === 'string') : [],
    removedClaims: Array.isArray(pattern.removed_source_derived_assertions) ? pattern.removed_source_derived_assertions.filter((x): x is string => typeof x === 'string') : [],
    status: str(candidate.candidate_status), candidate, freshness, pattern,
  }
}

export async function decideEvidenceRepairHumanQa(input: {
  packetId: string; packetVersion: string; bindingHash: string; decision: RepairDecision
  reason: string; reviewerId: string; surface: 'portfolio' | 'slack'
  slackIdentity?: { team_id: string; channel_id: string; message_ts: string; user_id: string }
}) {
  if (!UUID.test(input.packetId) || !UUID.test(input.reviewerId)
    || !['approve', 'reject', 'revise'].includes(input.decision)
    || !input.reason.trim() || input.reason.trim().length > 2000
    || !HASH.test(input.bindingHash) || !exactTimestamp(input.packetVersion)) {
    throw new RepairDecisionError('Invalid review decision or exact binding.', 400)
  }
  if (!supabaseAdmin) throw new RepairDecisionError('Review database unavailable.', 503)
  const packetVersion = exactTimestamp(input.packetVersion)
  const idempotencyKey = `evidence-repair-human-qa:${input.packetId}:${packetVersion}:${input.decision}:${input.reviewerId}`
  const { data: prior, error: priorError } = await supabaseAdmin
    .from('evidence_repair_human_qa_receipts').select('*')
    .eq('packet_id', input.packetId).eq('packet_version', packetVersion).maybeSingle()
  if (priorError) throw new RepairDecisionError('Decision receipt read failed.', 503)
  if (prior) {
    if (prior.idempotency_key === idempotencyKey && prior.reason === input.reason.trim()
      && prior.surface === input.surface && prior.reviewer_id === input.reviewerId
      && JSON.stringify(prior.slack_identity ?? null) === JSON.stringify(input.slackIdentity ?? null)
      && prior.candidate_snapshot && prior.freshness_snapshot
      && repairBinding({ caseId: prior.case_id, packetId: prior.packet_id,
        packetVersion: exactTimestamp(prior.packet_version), originalPacketId: prior.original_packet_id,
        originalPacketVersion: exactTimestamp(prior.original_packet_version),
        calendarItemId: prior.calendar_item_id, socialContentId: prior.social_content_id,
        sourceSha256: prior.source_sha256, sourceExpiresAt: exactTimestamp(prior.source_expires_at),
        approvedCopySha256: prior.approved_copy_sha256,
        evidenceVersion: exactTimestamp(record(prior.freshness_snapshot).evidence_version),
        contentVersion: exactTimestamp(prior.content_version), claimBoundarySha256: prior.claim_boundary_sha256,
      }).bindingHash === input.bindingHash) return { ...prior, replayed: true }
    throw new RepairDecisionError('This packet version already has a different Human QA decision.')
  }
  const review = await getEvidenceRepairReview(input.packetId)
  if (review.binding.bindingHash !== input.bindingHash
    || review.binding.packetVersion !== packetVersion) {
    throw new RepairDecisionError('Review evidence changed. Open the current Portfolio record.')
  }
  const { data, error } = await supabaseAdmin.rpc('record_evidence_repair_human_qa_decision', {
    p_packet_id: input.packetId, p_packet_version: review.binding.packetVersion,
    p_candidate: review.candidate, p_freshness: review.freshness,
    p_pattern: review.pattern, p_claim_boundary_sha256: review.binding.claimBoundarySha256,
    p_content_version: review.binding.contentVersion,
    p_decision: input.decision, p_reason: input.reason.trim(), p_reviewer_id: input.reviewerId,
    p_surface: input.surface, p_idempotency_key: idempotencyKey,
    p_slack_identity: input.slackIdentity ?? null,
  })
  if (error || !data) throw new RepairDecisionError(error?.message ?? 'Decision persistence was not confirmed.', 409)
  return data as Record<string, unknown>
}

export function evidenceRepairReviewPath(packetId: string) {
  return `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(packetId)}`
}

export async function getEvidenceRepairDecisionReceipt(packetId: string) {
  if (!UUID.test(packetId)) throw new RepairDecisionError('Invalid repair packet ID.', 400)
  if (!supabaseAdmin) throw new RepairDecisionError('Review database unavailable.', 503)
  const { data, error } = await supabaseAdmin.from('evidence_repair_human_qa_receipts')
    .select('id,packet_id,packet_version,decision,reason,reviewer_id,surface,created_at,external_execution_enabled')
    .eq('packet_id', packetId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new RepairDecisionError('Decision receipt read failed.', 503)
  if (!data) return null
  const { data: packet, error: packetError } = await supabaseAdmin.from('social_content_research_packets')
    .select('id,actor_metadata').eq('id', packetId).maybeSingle()
  if (packetError) throw new RepairDecisionError('Repair packet reconciliation read failed.', 503)
  const actual = record(record(packet?.actor_metadata).evidence_repair_candidate).candidate_status
  const expected = data.decision === 'approve' ? 'human_qa_approved'
    : data.decision === 'reject' ? 'human_qa_rejected' : 'revision_requested'
  return actual === expected ? data : null
}
