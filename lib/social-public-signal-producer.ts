import { createHash } from 'crypto'
import { isIP } from 'net'
import {
  PUBLIC_SIGNAL_MEASUREMENT_VERSION, PUBLIC_SIGNAL_MIN_SAMPLE_SIZE, PUBLIC_SIGNAL_SCORE_THRESHOLD,
  publicSignalMeasurementReceiptId, validatePublicSignalMeasurement,
  type PublicSignalMeasurementReceipt,
} from '@/lib/social-public-signal-measurement'
import { validOfficialSignalAttribution } from '@/lib/social-official-live-signals'
import { publicObservationIdentity, validPublicObservation } from '@/lib/social-public-signal-observation'

const MAX_ATTEMPTS = 3
const OWNER = 'social_content_research'
const DAY = 86400000

type Row = { id: string; source_url: string; title: string; status: string; actor_metadata: Record<string, unknown>; updated_at?: string }
type Observation = {
  version: 'public_signal_observation_v1'
  coverage_identity: string
  source_url: string
  observed_at: string
  expires_at: string
  public_attention: { observed: number; required: number }
  relevance: { observed: number; required: number }
  excluded?: boolean
}
type Unscored = {
  status: 'Unscored'; owner: typeof OWNER; reason: string; observed_value: number | null
  required_value: number; evidence_fingerprint: string; attempt_count: number; max_attempts: typeof MAX_ATTEMPTS
  observed_at: string; expires_at: string | null
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function validUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.')
      && !isIP(url.hostname) && !['.local', '.internal', '.invalid', '.test'].some((suffix) => url.hostname.endsWith(suffix))
  } catch { return false }
}
function normalized(value: { observed: number; required: number }) {
  return Number(Math.min(1, value.observed / value.required).toFixed(4))
}
function mean(values: number[]) { return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) }
function finitePair(value: unknown): value is { observed: number; required: number } {
  const pair = object(value)
  return typeof pair.observed === 'number' && Number.isFinite(pair.observed) && pair.observed >= 0
    && typeof pair.required === 'number' && Number.isFinite(pair.required) && pair.required > 0
}

// Observation rows are already reviewed public research records. Scores are ratios of
// recorded values to declared denominators; no inferred sentiment or fabricated reach.
export function preparePublicSignalMeasurement(input: { packet: Row; evidence: Row[]; now: string }) {
  const { packet, now } = input
  const metadata = object(packet.actor_metadata)
  const official = object(metadata.official_signal)
  const prior = object(metadata.public_signal_measurement_state)
  const identity = String(official.coverage_identity ?? '')
  const nowMs = Date.parse(now)
  const candidateEvidence = input.evidence.filter((row) =>
    object(object(row.actor_metadata).public_signal_observation).coverage_identity === identity)
    .sort((a, b) => a.source_url.localeCompare(b.source_url) || a.id.localeCompare(b.id))
  const fingerprint = hash({ identity, official_fingerprint: official.source_fingerprint,
    evidence: candidateEvidence.map((row) => ({ id: row.id, url: row.source_url, status: row.status,
      observation: object(row.actor_metadata).public_signal_observation })) })
  const priorAttempts = Number.isInteger(prior.attempt_count) ? Number(prior.attempt_count) : 0
  const unchanged = prior.evidence_fingerprint === fingerprint
  const attempts = unchanged ? priorAttempts : Math.min(MAX_ATTEMPTS, priorAttempts + 1)
  const blocked = (reason: string, observedValue: number | null, requiredValue: number): { receipt: null; state: Unscored; changed: boolean } => ({
    receipt: null,
    state: { status: 'Unscored', owner: OWNER, reason, observed_value: observedValue, required_value: requiredValue,
      evidence_fingerprint: fingerprint, attempt_count: attempts, max_attempts: MAX_ATTEMPTS,
      observed_at: now, expires_at: typeof official.expires_at === 'string' ? official.expires_at : null },
    changed: !unchanged && priorAttempts < MAX_ATTEMPTS,
  })
  if (packet.status !== 'review_ready' || !validOfficialSignalAttribution(packet)
    || !Number.isFinite(nowMs) || Date.parse(String(official.expires_at)) <= nowMs) {
    return blocked('official_packet_stale_or_not_pending', null, 1)
  }
  if (metadata.public_signal_measurement_receipt) {
    const validation = validatePublicSignalMeasurement({ stored: metadata.public_signal_measurement_receipt,
      submitted: metadata.public_signal_measurement_receipt, coverageIdentity: identity, officialSourceUrl: packet.source_url, now })
    return validation.valid
      ? { receipt: validation.receipt, state: null, changed: false }
      : blocked('existing_measurement_immutable_review_required', null, 1)
  }
  if (priorAttempts >= MAX_ATTEMPTS) return blocked('retry_limit_reached_owner_review_required', priorAttempts, MAX_ATTEMPTS)
  const sources: PublicSignalMeasurementReceipt['source_receipts'] = []
  let rejected = 0
  for (const row of candidateEvidence) {
    const observation = object(row.actor_metadata.public_signal_observation) as Partial<Observation>
    const review = object(row.actor_metadata.operator_review)
    const observedMs = Date.parse(String(observation.observed_at))
    const expiresMs = Date.parse(String(observation.expires_at))
    if (row.status !== 'approved' || observation.version !== 'public_signal_observation_v1'
      || !validPublicObservation(observation, now)
      || object(row.actor_metadata.public_signal_observation).observation_identity !== publicObservationIdentity(observation as Parameters<typeof publicObservationIdentity>[0])
      || object(row.actor_metadata.public_signal_observation).official_packet_id !== packet.id
      || review.decision !== 'approved' || !Number.isFinite(Date.parse(String(review.reviewed_at)))
      || observation.excluded === true || observation.source_url !== row.source_url || !validUrl(row.source_url)
      || !Number.isFinite(observedMs) || observedMs > nowMs || observedMs < nowMs - 7 * DAY
      || !Number.isFinite(expiresMs) || expiresMs <= nowMs || expiresMs > observedMs + 7 * DAY
      || !finitePair(observation.public_attention) || !finitePair(observation.relevance)) {
      rejected += 1; continue
    }
    const sourceFingerprint = hash({ packet_id: row.id, source_url: row.source_url, observation })
    sources.push({ receipt_id: `public-source:${sourceFingerprint}`, source_packet_id: row.id,
      source_fingerprint: sourceFingerprint, source_url: row.source_url,
      observed_at: new Date(observedMs).toISOString(),
      observed_values: { public_attention: observation.public_attention.observed, relevance: observation.relevance.observed },
      required_values: { public_attention: observation.public_attention.required, relevance: observation.relevance.required },
      public_attention_score: normalized(observation.public_attention), relevance_score: normalized(observation.relevance) })
  }
  const urls = new Set(sources.map((source) => source.source_url))
  const hosts = new Set(sources.map((source) => new URL(source.source_url).hostname))
  if (sources.length < PUBLIC_SIGNAL_MIN_SAMPLE_SIZE || urls.size !== sources.length || hosts.size < 2
    || !urls.has(packet.source_url)) {
    return blocked(rejected ? 'insufficient_or_excluded_attributable_public_sources' : 'insufficient_attributable_public_sources',
      sources.length, PUBLIC_SIGNAL_MIN_SAMPLE_SIZE)
  }
  const attention = mean(sources.map((source) => source.public_attention_score))
  const relevance = mean(sources.map((source) => source.relevance_score))
  if (attention < PUBLIC_SIGNAL_SCORE_THRESHOLD || relevance < PUBLIC_SIGNAL_SCORE_THRESHOLD) {
    return blocked('measured_score_below_threshold', Math.min(attention, relevance), PUBLIC_SIGNAL_SCORE_THRESHOLD)
  }
  const observedAt = new Date(Math.max(...sources.map((source) => Date.parse(source.observed_at)))).toISOString()
  const freshUntil = new Date(Math.min(Date.parse(String(official.expires_at)),
    ...candidateEvidence.filter((row) => sources.some((source) => source.source_packet_id === row.id))
      .map((row) => Date.parse(String(object(row.actor_metadata.public_signal_observation).expires_at))),
    Date.parse(observedAt) + 7 * DAY)).toISOString()
  const contents: Omit<PublicSignalMeasurementReceipt, 'receipt_id'> = {
    version: PUBLIC_SIGNAL_MEASUREMENT_VERSION, coverage_identity: identity, observed_at: observedAt,
    fresh_until: freshUntil, sample_size: sources.length, formula: 'mean_normalized_public_observations_v1',
    public_attention_score: attention, public_attention_threshold: PUBLIC_SIGNAL_SCORE_THRESHOLD,
    relevance_score: relevance, relevance_threshold: PUBLIC_SIGNAL_SCORE_THRESHOLD, source_receipts: sources,
  }
  const receipt = { ...contents, receipt_id: publicSignalMeasurementReceiptId(contents) }
  const validation = validatePublicSignalMeasurement({ stored: receipt, submitted: receipt,
    coverageIdentity: identity, officialSourceUrl: packet.source_url, now })
  return validation.valid ? { receipt, state: null, changed: true }
    : blocked(validation.reason, sources.length, PUBLIC_SIGNAL_MIN_SAMPLE_SIZE)
}

// Called by the existing coverage intake. Never changes approval, scores on the
// pending momentum receipt, or any source observation. Writes only preparation metadata.
export async function persistPendingPublicSignalMeasurements(now: string, packetId?: string) {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const [packetResult, evidenceResult] = await Promise.all([
    supabaseAdmin.from('social_content_research_packets')
      .select('id, source_url, title, status, actor_metadata, updated_at')
      .eq('status', 'review_ready').contains('actor_metadata', { official_signal: {} }).limit(500),
    supabaseAdmin.from('social_content_research_packets')
      .select('id, source_url, title, status, actor_metadata, updated_at')
      .eq('status', 'approved').contains('actor_metadata', { public_signal_observation: {} }).limit(500),
  ])
  if (packetResult.error || evidenceResult.error) throw new Error(`public_signal_measurement_read_failed:${packetResult.error?.message ?? evidenceResult.error?.message}`)
  if ((packetResult.data?.length ?? 0) >= 500 || (evidenceResult.data?.length ?? 0) >= 500) {
    throw new Error('public_signal_measurement_result_limit_reached')
  }
  const packets = (packetResult.data ?? []) as Row[]
  const evidence = (evidenceResult.data ?? []) as Row[]
  if (packetId && !packets.some((packet) => packet.id === packetId)) throw new Error('official_packet_not_pending_or_outside_bounded_window')
  const outcomes: Array<{ packet_id: string; receipt_id: string | null; reason: string | null; owner: string }> = []
  for (const packet of packetId ? packets.filter((item) => item.id === packetId) : packets) {
    const prepared = preparePublicSignalMeasurement({ packet, evidence, now })
    outcomes.push({ packet_id: packet.id, receipt_id: prepared.receipt?.receipt_id ?? null,
      reason: prepared.state?.reason ?? null, owner: OWNER })
    if (!prepared.changed) continue
    const actorMetadata = { ...packet.actor_metadata,
      ...(prepared.receipt ? { public_signal_measurement_receipt: prepared.receipt } : { public_signal_measurement_state: prepared.state }) }
    // updated_at acts as an optimistic lock. A concurrent review or source edit
    // cannot be overwritten by stale preparation metadata.
    const query = supabaseAdmin.from('social_content_research_packets').update({ actor_metadata: actorMetadata })
      .eq('id', packet.id).eq('status', 'review_ready').eq('updated_at', packet.updated_at)
      .select('id')
    const result = await query
    if (result.error) throw new Error(`public_signal_measurement_write_failed:${result.error.message}`)
    if (!result.data?.length) throw new Error('public_signal_measurement_concurrent_change')
  }
  return { packets_scanned: outcomes.length, receipts_ready: outcomes.filter((item) => item.receipt_id).length,
    outcomes, review_only: true as const }
}
