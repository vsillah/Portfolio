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

  it('accepts source-bound values only when scores are the clamped observed-to-required ratio', () => {
    const sources = [
      boundSource(officialSourceUrl, 0, { attention: [80, 100], relevance: [9, 10] }, 0.8, 0.9),
      boundSource('https://example.org/agent-attention/a', 1, { attention: [150, 100], relevance: [9, 10] }, 1, 0.9),
      boundSource('https://example.net/agent-attention/b', 2, { attention: [80, 100], relevance: [9, 10] }, 0.8, 0.9),
    ]
    const bound = measurement({
      public_attention_score: 0.8667,
      source_receipts: sources,
    })
    expect(validate(bound)).toMatchObject({ valid: true })
    const overstated = measurement({
      public_attention_score: 0.8667,
      source_receipts: sources.map((source, index) => index === 1
        ? { ...source, public_attention_score: 0.8 }
        : source),
    })
    expect(validate(overstated)).toMatchObject({ valid: false, reason: 'measurement_source_values_mismatched' })
  })

  it('rejects unbound, private, duplicate, and below-threshold measurement evidence', () => {
    const boundSources = sourceReceipts.map((source, index) => boundSource(source.source_url, index, { attention: [80, 100], relevance: [9, 10] }, 0.8, 0.9))
    const bound = measurement({ source_receipts: boundSources })
    expect(validate(bound)).toMatchObject({ valid: true })
    expect(validate(measurement({
      source_receipts: boundSources.map((source, index) => index === 0
        ? { ...source, public_attention_score: 0.4 }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_values_mismatched' })
    expect(validate(measurement({
      source_receipts: boundSources.map((source, index) => index === 0
        ? { ...source, source_fingerprint: 'abc' }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_values_mismatched' })
    expect(validate(measurement({
      source_receipts: boundSources.map((source, index) => index === 0
        ? { ...source, required_values: { public_attention: 0, relevance: 10 } }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_values_mismatched' })
    expect(validate(measurement({
      source_receipts: boundSources.map((source, index) => index === 0
        ? { ...source, observed_values: { public_attention: -1, relevance: 9 } }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_values_mismatched' })
    expect(validate(measurement({
      source_receipts: sourceReceipts.map((source, index) => index === 0
        ? { ...source, source_packet_id: 'packet-0' }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_values_mismatched' })

    const sameHost = [
      officialSourceUrl,
      'https://developers.openai.com/api/docs/agents',
      'https://developers.openai.com/blog/agents',
    ].map((source_url, index) => ({ ...sourceReceipts[index], source_url, receipt_id: `public-source:fixture-host-${index}` }))
    expect(validate(measurement({ source_receipts: sameHost }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    expect(validate(measurement({
      source_receipts: sourceReceipts.map((source) => ({ ...source, receipt_id: sourceReceipts[0].receipt_id })),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    expect(validate(measurement({
      source_receipts: [
        sourceReceipts[0],
        sourceReceipts[0],
        sourceReceipts[1],
      ].map((source, index) => ({ ...source, receipt_id: `public-source:fixture-duplicate-url-${index}` })),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    for (const source_url of [
      'https://10.1.2.3/signal',
      'https://[::1]/signal',
      'https://metrics.internal/signal',
      'https://signals.example.test/signal',
      'https://printer.local/signal',
      'https://user:pass@example.org/signal',
      'https://localhost/signal',
    ]) {
      expect(validate(measurement({
        source_receipts: sourceReceipts.map((source, index) => index === 1 ? { ...source, source_url } : source),
      }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    }
    expect(validate(measurement({
      source_receipts: sourceReceipts.map((source, index) => index === 0
        ? { ...source, receipt_id: 'public-source:short' }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    expect(validate(measurement({
      source_receipts: sourceReceipts.map((source, index) => index === 0
        ? { ...source, observed_at: '2026-10-20T12:00:01.000Z' }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    expect(validate(measurement({
      source_receipts: sourceReceipts.map((source, index) => index === 0
        ? { ...source, observed_at: '2026-10-13T11:59:59.000Z' }
        : source),
    }))).toMatchObject({ valid: false, reason: 'measurement_source_unattributable' })
    expect(validate(measurement({
      public_attention_score: 0.5,
      relevance_score: 0.5,
      source_receipts: sourceReceipts.map((source) => ({ ...source, public_attention_score: 0.5, relevance_score: 0.5 })),
    }))).toMatchObject({ valid: false, reason: 'measurement_score_insufficient_or_mismatched' })
  })

  it('rejects the wrong packet identity, formula, coverage, and freshness window', () => {
    expect(validate(measurement({ version: 'public_signal_measurement_v0' }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ formula: 'sum_v1' }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ coverage_identity: 'different_coverage_identity' }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ public_attention_threshold: 0.5 }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ observed_at: '2026-10-20T14:00:00.000Z' }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ observed_at: 'not-a-time' }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ fresh_until: '2026-10-28T12:00:00.000Z' }))).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate(measurement({ sample_size: 4 }))).toMatchObject({ valid: false, reason: 'measurement_sample_insufficient' })
    expect(validatePublicSignalMeasurement({
      stored: receipt, submitted: receipt, coverageIdentity, officialSourceUrl, now: 'not-a-time',
    })).toMatchObject({ valid: false, reason: 'measurement_receipt_stale_or_wrong_version' })
    expect(validate([], [])).toMatchObject({ valid: false, reason: 'measurement_receipt_missing_or_mismatched' })
  })
})

function boundSource(
  source_url: string,
  index: number,
  values: { attention: [number, number]; relevance: [number, number] },
  public_attention_score: number,
  relevance_score: number,
) {
  return {
    receipt_id: `public-source:fixture-bound-${index}-value`,
    source_url,
    observed_at: '2026-10-20T12:00:00.000Z',
    public_attention_score,
    relevance_score,
    source_packet_id: `packet-${index}`,
    source_fingerprint: 'ab'.repeat(32),
    observed_values: { public_attention: values.attention[0], relevance: values.relevance[0] },
    required_values: { public_attention: values.attention[1], relevance: values.relevance[1] },
  }
}

function measurement(overrides: Record<string, unknown>) {
  const contents = { ...receipt, ...overrides }
  const { receipt_id: _ignored, ...body } = contents
  return { ...body, receipt_id: publicSignalMeasurementReceiptId(body) }
}
