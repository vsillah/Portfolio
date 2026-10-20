import { describe, expect, it } from 'vitest'
import { publicSignalMeasurementReceiptId, validatePublicSignalMeasurement } from './social-public-signal-measurement'

const now = '2026-10-20T13:00:00.000Z'
const officialSourceUrl = 'https://developers.openai.com/api/docs/changelog'
const coverageIdentity = 'openai_agents_api_2026_10_16_artifact_sdk_ultrafast_mode'
const sourceReceipts = [officialSourceUrl, 'https://example.org/agent-attention/a', 'https://example.net/agent-attention/b']
  .map((source_url, index) => ({ receipt_id: `public-source:fixture-measurement-${index}`, source_url,
    observed_at: '2026-10-20T12:00:00.000Z', public_attention_score: 0.8, relevance_score: 0.9 }))
const contents = {
  version: 'public_signal_measurement_v1' as const, coverage_identity: coverageIdentity,
  observed_at: '2026-10-20T12:00:00.000Z', fresh_until: '2026-10-25T12:00:00.000Z',
  sample_size: 3, formula: 'mean_normalized_public_observations_v1' as const,
  public_attention_score: 0.8, public_attention_threshold: 0.65 as const,
  relevance_score: 0.9, relevance_threshold: 0.65 as const, source_receipts: sourceReceipts,
}
const receipt = { ...contents, receipt_id: publicSignalMeasurementReceiptId(contents) }
const validate = (stored: unknown, submitted: unknown = stored) => validatePublicSignalMeasurement({
  stored, submitted, coverageIdentity, officialSourceUrl, now,
})

describe('source-bound public signal measurement', () => {
  it('accepts only a current stored receipt with deterministic scores and identity', () => {
    expect(validate(receipt)).toMatchObject({ valid: true, receipt: { receipt_id: receipt.receipt_id } })
    expect(validate(null, receipt)).toMatchObject({ valid: false, reason: 'measurement_receipt_missing_or_mismatched' })
    expect(validate(receipt, { ...receipt, public_attention_score: 0.9 })).toMatchObject({ valid: false, reason: 'measurement_receipt_missing_or_mismatched' })
  })

  it('blocks stale, undersized, unattributable and score-mismatched receipts', () => {
    expect(validate({ ...receipt, fresh_until: '2026-10-20T12:00:00.000Z' })).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate({ ...receipt, sample_size: 2, source_receipts: sourceReceipts.slice(0, 2) })).toMatchObject({ valid: false, reason: 'measurement_sample_insufficient' })
    expect(validate({ ...receipt, source_receipts: sourceReceipts.map((source) => ({ ...source, source_url: 'https://example.org/only' })) })).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    expect(validate({ ...receipt, public_attention_score: 0.7 })).toMatchObject({ valid: false, reason: 'measurement_score_insufficient_or_mismatched' })
    expect(validate({ ...receipt, receipt_id: 'public-signal-measurement:wrong' })).toMatchObject({ valid: false, reason: 'measurement_receipt_identity_mismatched' })
  })
})
