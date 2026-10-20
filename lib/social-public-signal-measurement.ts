import { createHash } from 'crypto'

export const PUBLIC_SIGNAL_MEASUREMENT_VERSION = 'public_signal_measurement_v1' as const
export const PUBLIC_SIGNAL_MIN_SAMPLE_SIZE = 3
export const PUBLIC_SIGNAL_SCORE_THRESHOLD = 0.65

export type PublicSignalMeasurementReceipt = {
  version: typeof PUBLIC_SIGNAL_MEASUREMENT_VERSION
  receipt_id: string
  coverage_identity: string
  observed_at: string
  fresh_until: string
  sample_size: number
  formula: 'mean_normalized_public_observations_v1'
  public_attention_score: number
  public_attention_threshold: typeof PUBLIC_SIGNAL_SCORE_THRESHOLD
  relevance_score: number
  relevance_threshold: typeof PUBLIC_SIGNAL_SCORE_THRESHOLD
  source_receipts: Array<{
    receipt_id: string
    source_url: string
    observed_at: string
    public_attention_score: number
    relevance_score: number
    source_packet_id?: string
    source_fingerprint?: string
    observed_values?: { public_attention: number; relevance: number }
    required_values?: { public_attention: number; relevance: number }
  }>
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function score(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}
function publicUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      && !['localhost', '127.0.0.1'].includes(url.hostname)
      && !url.hostname.endsWith('.local') && url.hostname.includes('.')
  } catch { return false }
}
function mean(values: number[]) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}
export function publicSignalMeasurementReceiptId(receipt: Omit<PublicSignalMeasurementReceipt, 'receipt_id'>) {
  return `public-signal-measurement:${createHash('sha256').update(JSON.stringify(receipt)).digest('hex')}`
}

export function validatePublicSignalMeasurement(input: {
  stored: unknown
  submitted: unknown
  coverageIdentity: string
  officialSourceUrl: string
  now: string
}): { valid: true; receipt: PublicSignalMeasurementReceipt } | { valid: false; reason: string } {
  const stored = record(input.stored)
  const submitted = record(input.submitted)
  if (!Object.keys(stored).length || JSON.stringify(stored) !== JSON.stringify(submitted)) {
    return { valid: false, reason: 'measurement_receipt_missing_or_mismatched' }
  }
  const receipt = stored as PublicSignalMeasurementReceipt
  const now = Date.parse(input.now)
  const observed = Date.parse(receipt.observed_at)
  const expires = Date.parse(receipt.fresh_until)
  if (receipt.version !== PUBLIC_SIGNAL_MEASUREMENT_VERSION
    || receipt.coverage_identity !== input.coverageIdentity
    || receipt.formula !== 'mean_normalized_public_observations_v1'
    || !Number.isFinite(now) || !Number.isFinite(observed) || !Number.isFinite(expires)
    || observed > now || expires <= now || expires > observed + 7 * 86400000
    || receipt.public_attention_threshold !== PUBLIC_SIGNAL_SCORE_THRESHOLD
    || receipt.relevance_threshold !== PUBLIC_SIGNAL_SCORE_THRESHOLD) {
    return { valid: false, reason: 'measurement_receipt_stale_or_wrong_version' }
  }
  if (!Array.isArray(receipt.source_receipts) || receipt.source_receipts.length < PUBLIC_SIGNAL_MIN_SAMPLE_SIZE
    || receipt.sample_size !== receipt.source_receipts.length) {
    return { valid: false, reason: 'measurement_sample_insufficient' }
  }
  const urls = new Set<string>()
  const ids = new Set<string>()
  const hosts = new Set<string>()
  for (const source of receipt.source_receipts) {
    if (!source || !publicUrl(source.source_url) || !/^public-source:[a-zA-Z0-9:_-]{12,}$/.test(source.receipt_id)
      || !score(source.public_attention_score) || !score(source.relevance_score)
      || !Number.isFinite(Date.parse(source.observed_at))
      || Date.parse(source.observed_at) > observed || Date.parse(source.observed_at) < observed - 7 * 86400000) {
      return { valid: false, reason: 'measurement_source_unattributable' }
    }
    if (source.observed_values || source.required_values || source.source_packet_id || source.source_fingerprint) {
      const observedValues = source.observed_values
      const requiredValues = source.required_values
      const normalized = (observedValue: number, requiredValue: number) => Number(Math.min(1, observedValue / requiredValue).toFixed(4))
      if (!source.source_packet_id || !/^[a-f0-9]{64}$/.test(source.source_fingerprint ?? '')
        || !observedValues || !requiredValues
        || !Number.isFinite(observedValues.public_attention) || observedValues.public_attention < 0
        || !Number.isFinite(observedValues.relevance) || observedValues.relevance < 0
        || !Number.isFinite(requiredValues.public_attention) || requiredValues.public_attention <= 0
        || !Number.isFinite(requiredValues.relevance) || requiredValues.relevance <= 0
        || source.public_attention_score !== normalized(observedValues.public_attention, requiredValues.public_attention)
        || source.relevance_score !== normalized(observedValues.relevance, requiredValues.relevance)) {
        return { valid: false, reason: 'measurement_source_values_mismatched' }
      }
    }
    urls.add(source.source_url)
    ids.add(source.receipt_id)
    hosts.add(new URL(source.source_url).hostname)
  }
  if (!urls.has(input.officialSourceUrl) || urls.size !== receipt.sample_size
    || ids.size !== receipt.sample_size || hosts.size < 2) {
    return { valid: false, reason: 'measurement_source_unattributable' }
  }
  if (!score(receipt.public_attention_score) || !score(receipt.relevance_score)
    || receipt.public_attention_score !== mean(receipt.source_receipts.map((source) => source.public_attention_score))
    || receipt.relevance_score !== mean(receipt.source_receipts.map((source) => source.relevance_score))
    || receipt.public_attention_score < receipt.public_attention_threshold
    || receipt.relevance_score < receipt.relevance_threshold) {
    return { valid: false, reason: 'measurement_score_insufficient_or_mismatched' }
  }
  const { receipt_id: _id, ...contents } = receipt
  if (receipt.receipt_id !== publicSignalMeasurementReceiptId(contents)) {
    return { valid: false, reason: 'measurement_receipt_identity_mismatched' }
  }
  return { valid: true, receipt }
}
