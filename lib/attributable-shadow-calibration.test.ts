import { describe, expect, it, vi } from 'vitest'
import { constructHistoricalCohort, type HistoricalFixtureManifest } from './attributable-historical-cohort'
import { acquireAttributableObservation, type AcquisitionChannel, type AcquisitionFixture } from './attributable-performance-acquisition'
import { baselineInputSha256, baselineReceiptSha256, policyApprovalSha256, rawResponseSha256, type Baseline } from './attributable-performance-evidence'
import { calibrateHistoricalShadow, outcomeReceiptSha256, type ApprovedOutcomeReceipt, type CalibrationPolicy, type ShadowCase } from './attributable-shadow-calibration'

const observed = '2026-11-25T12:00:00Z'
const published = '2026-11-18T12:00:00Z'
const cases: Array<[AcquisitionChannel, string, string, string, (id: string) => object]> = [
  ['linkedin', 'text', 'li-account', 'https://www.linkedin.com/company/example/', (id) => ({ urn: id, authorUrn: 'li-account', publishedAt: published, permalink: `https://www.linkedin.com/feed/update/${id}/`, mediaType: 'text', analytics: { engagements: 100, impressions: 1000 } })],
  ['youtube', 'long_form', 'yt-channel', 'https://www.youtube.com/@example', (id) => ({ id, snippet: { channelId: 'yt-channel', publishedAt: published }, canonicalUrl: `https://www.youtube.com/watch?v=${id}`, videoFormat: 'long_form', analytics: { views: 100, impressions: 1000 } })],
  ['youtube_shorts', 'shorts', 'yt-channel', 'https://www.youtube.com/@example', (id) => ({ id, snippet: { channelId: 'yt-channel', publishedAt: published }, canonicalUrl: `https://www.youtube.com/shorts/${id}`, videoFormat: 'shorts', analytics: { views: 100, impressions: 1000 } })],
  ['x', 'single_post', 'x-account', 'https://x.com/example', (id) => ({ id, author_id: 'x-account', author_handle: 'example', created_at: published, url: `https://x.com/example/status/${id}`, post_format: 'single_post', public_metrics: { engagement_count: 100, impression_count: 1000 } })],
  ['facebook', 'text', 'fb-page', 'https://www.facebook.com/example', (id) => ({ id, from_id: 'fb-page', created_time: published, permalink_url: `https://www.facebook.com/fb-page/posts/${id}`, post_format: 'text', insights: { engagements: 100, impressions: 1000 } })],
  ['instagram', 'feed', 'ig-account', 'https://www.instagram.com/example/', (id) => ({ id, owner_id: 'ig-account', timestamp: published, permalink: `https://www.instagram.com/p/${id}/`, media_format: 'feed', insights: { engagements: 100, impressions: 1000 } })],
]

function fixture(channel: AcquisitionChannel, id: string): AcquisitionFixture {
  const [_, format, account_id, account_url, response] = cases.find((item) => item[0] === channel)!
  const raw_response = response(id)
  const platform = channel === 'youtube_shorts' ? 'youtube' : channel
  const value: AcquisitionFixture = {
    channel, format, account_id, account_url, observed_at: observed,
    baseline_id: `baseline-${channel}`, baseline_version: 'v1', evidence_version: 'fixture-v1', source_policy_version: 'policy-v1',
    observation_grade: 'decision', observation_window: { start: published, end: observed },
    audience: { subscribers_or_followers: 5000, observed_at: observed }, cohort_id: `cohort-${channel}`, collector_version: 'checked-in-fixture-v1',
    source_class: 'owned_first_party', source_url: account_url, provenance: { record_id: `record-${channel}-${id}`, captured_at: observed, method: 'checked-in synthetic historical fixture' },
    rights: { privacy_cleared: true, rights_cleared: true, rights_basis: 'synthetic fixture' },
    rollback: { historical_record_id: `history-${channel}-${id}`, supersedes_record_id: null, procedure: 'Retain historical response; discard derived receipt.' },
    raw_response,
    policy: { source_class: 'owned_first_party', policy_id: 'fixture-policy', policy_version: 'policy-v1', evidence_version: 'fixture-v1', platform, format, object_id: id, observation_id: `record-${channel}-${id}`, raw_response_sha256: rawResponseSha256(raw_response), approved: true, expiry_basis: 'approved_source_class_policy', issued_at: '2026-11-18T00:00:00Z', expires_at: '2026-11-30T00:00:00Z', approval: { receipt_id: `fixture-approval-${id}`, authority_id: 'fixture-authority', authority_version: 'v1', policy_sha256: '' } },
  }
  value.policy.approval.policy_sha256 = policyApprovalSha256(value.policy)
  return value
}

function baseline(channel: AcquisitionChannel): Baseline {
  const sample = acquireAttributableObservation(fixture(channel, 'candidate')).observation!
  const contributions = Array.from({ length: 5 }, (_, index) => ({ record_id: `base-${channel}-${index}`, raw_response_sha256: rawResponseSha256({ channel, index }), account_id: sample.account_id, platform: sample.platform, format: sample.format, metric_name: sample.metric.name, denominator_name: sample.metric.denominator_name, metric_value: 10, denominator: 200 }))
  const result: Baseline = { baseline_id: sample.baseline_id, baseline_version: 'v1', platform: sample.platform, format: sample.format, account_id: sample.account_id, metric_name: sample.metric.name, denominator_name: sample.metric.denominator_name, metric_value: 50, denominator: 1000, audience: 5000, observed_at: observed, source_record_id: `base-source-${channel}`, contributions, input_sha256: '', computation_method: 'aggregate_rate', computation_version: 'v1', computed_at: observed, receipt_sha256: '' }
  result.input_sha256 = baselineInputSha256(result)
  result.receipt_sha256 = baselineReceiptSha256(result)
  return result
}

function replay(channel: AcquisitionChannel) {
  return { candidate: fixture(channel, 'candidate'), comparables: Array.from({ length: 5 }, (_, index) => fixture(channel, `peer${index}`)), baselines: [baseline(channel)], evaluated_at: '2026-11-26T12:00:00Z' }
}
const policy: CalibrationPolicy = { policy_id: 'synthetic-review', policy_version: 'v1', approval_receipt_id: 'review-policy-v1', minimum_cases: 2, minimum_resolved: 2, minimum_positive: 1, minimum_negative: 1, minimum_binary_comparisons: 2, maximum_unresolved_rate: 0.25, maximum_unscored_rate: 0.25, evaluated_at: '2026-11-26T12:00:00Z' }
function shadowCase(channel: AcquisitionChannel, id: string, high = false): ShadowCase {
  const input = replay(channel)
  input.candidate = fixture(channel, `candidate-${id}`)
  input.comparables = Array.from({ length: 5 }, (_, index) => fixture(channel, `peer-${id}-${index}`))
  if (high) {
    const raw = input.candidate.raw_response as Record<string, unknown>
    const stats = (raw.analytics ?? raw.insights ?? raw.public_metrics) as Record<string, number>
    const key = stats.views !== undefined ? 'views' : stats.engagements !== undefined ? 'engagements' : 'engagement_count'
    stats[key] = 200
    input.candidate.policy.raw_response_sha256 = rawResponseSha256(raw)
    input.candidate.policy.approval.policy_sha256 = policyApprovalSha256(input.candidate.policy)
  }
  const fixtures = [input.candidate, ...input.comparables]
  const metric = acquireAttributableObservation(input.candidate).observation!.metric
  const fixture_manifest: HistoricalFixtureManifest = { manifest_id: `fixture-${id}`, manifest_version: 'v1', policy_id: 'fixture-policy', policy_version: 'policy-v1', evidence_version: 'fixture-v1', metric_definition: { metric_name: metric.name, denominator_name: metric.denominator_name, definition_version: 'v1', approval_receipt_id: 'synthetic-metric-approval' }, entries: fixtures.map((item) => ({ record_id: item.provenance.record_id, raw_response_sha256: rawResponseSha256(item.raw_response), evidence_version: item.evidence_version, collector_version: item.collector_version, source_policy_version: item.source_policy_version, policy_approval_receipt_id: item.policy.approval.receipt_id, kind: 'synthetic', approval_receipt_id: `fixture-${item.provenance.record_id}`, source_path: 'lib/attributable-shadow-calibration.test.ts' })) }
  return { ...input, case_id: id, artifact_version: 'artifact-v1', fixture_manifest }
}
function outcome(item: ShadowCase, outcome: ApprovedOutcomeReceipt['outcome'], unsupported_change = false): ApprovedOutcomeReceipt {
  const cohort = constructHistoricalCohort(item)
  const receipt: ApprovedOutcomeReceipt = { case_id: item.case_id, artifact_version: item.artifact_version, evidence_version: item.fixture_manifest.evidence_version, platform: item.candidate.policy.platform, format: item.candidate.format, cohort_receipt_sha256: cohort.receipt_sha256, performance_receipt_sha256: cohort.performance_receipt?.receipt_sha256 ?? null, outcome, unsupported_change, reviewer_or_authority: 'synthetic-reviewer', decision_receipt_id: `decision-${item.case_id}`, decided_at: '2026-11-26T11:00:00Z', valid_until: '2026-11-30T00:00:00Z', privacy_cleared: true, rights_cleared: true, exclusions: [], source_path: 'lib/attributable-shadow-calibration.test.ts', receipt_sha256: '' }
  receipt.receipt_sha256 = outcomeReceiptSha256(receipt)
  return receipt
}

describe('Phase 5I shadow calibration', () => {
  it.each(cases)('keeps %s %s in its own channel and format', (channel, format) => {
    const a = shadowCase(channel, `${channel}-low`)
    const b = shadowCase(channel, `${channel}-high`, true)
    const labels = [outcome(a, 'below_threshold'), outcome(b, 'pass')]
    const first = calibrateHistoricalShadow({ cases: [a, b], outcomes: labels, policy })
    const reversed = calibrateHistoricalShadow({ cases: [b, a], outcomes: [...labels].reverse(), policy })
    expect(first).toEqual(reversed)
    expect(first.groups).toHaveLength(1)
    expect(first.groups[0]).toMatchObject({ platform: channel === 'youtube_shorts' ? 'youtube' : channel, format, sample_size: 2, resolved: 2, exact_agreement: 2, disagreements: 0, true_positive: 1, true_negative: 1, false_positive: 0, false_negative: 0, precision: 1, recall: 1, confidence_eligible: true, reportable: true })
    expect(first.traces[0].cohort_receipt.decisions[0].rollback.historical_record_id).toContain('history-')
    expect(first.external_actions_enabled).toBe(false)
  })

  it('accounts for disagreements and valid binary denominators without scoring unresolved cases', () => {
    const a = shadowCase('youtube', 'low')
    const b = shadowCase('youtube', 'high', true)
    const c = shadowCase('youtube', 'unscored')
    c.comparables.pop()
    c.fixture_manifest.entries.pop()
    const result = calibrateHistoricalShadow({ cases: [a, b, c], outcomes: [outcome(a, 'pass', true), outcome(b, 'below_threshold'), outcome(c, 'unscored')], policy })
    expect(result.groups[0]).toMatchObject({ resolved: 3, disagreements: 2, exact_agreement: 1, false_positive: 1, false_negative: 1, true_positive: 0, true_negative: 0, precision: 0, recall: 0, unsupported_change_count: 1, unsupported_change_rate: 1 / 3 })
    expect(result.traces.find((row) => row.case_id === 'unscored')?.predicted).toBe('unscored')
  })

  it.each([
    ['tampered approval receipt', (label: ApprovedOutcomeReceipt) => { label.receipt_sha256 = '0'.repeat(64) }],
    ['wrong cohort hash', (label: ApprovedOutcomeReceipt) => { label.cohort_receipt_sha256 = '0'.repeat(64) }],
    ['wrong performance hash', (label: ApprovedOutcomeReceipt) => { label.performance_receipt_sha256 = '0'.repeat(64) }],
    ['cross format', (label: ApprovedOutcomeReceipt) => { label.format = 'shorts' }],
    ['cross channel', (label: ApprovedOutcomeReceipt) => { label.platform = 'youtube' }],
    ['cross version', (label: ApprovedOutcomeReceipt) => { label.artifact_version = 'v2' }],
    ['stale approval', (label: ApprovedOutcomeReceipt) => { label.valid_until = '2026-11-25T00:00:00Z' }],
    ['ambiguous authority', (label: ApprovedOutcomeReceipt) => { label.reviewer_or_authority = '' }],
    ['privacy uncleared', (label: ApprovedOutcomeReceipt) => { label.privacy_cleared = false }],
  ] as const)('excludes %s from all denominators', (_, change) => {
    const item = shadowCase('x', 'bad')
    const label = outcome(item, 'below_threshold'); change(label); if (label.receipt_sha256 !== '0'.repeat(64)) label.receipt_sha256 = outcomeReceiptSha256(label)
    const result = calibrateHistoricalShadow({ cases: [item], outcomes: [label], policy })
    expect(result.groups[0]).toMatchObject({ resolved: 0, unresolved: 1, precision: null, recall: null, reportable: false })
    expect(result.traces[0].agreement).toBe('unresolved')
  })

  it('rejects duplicate labels, duplicate cases, missing labels, and reused decision IDs', () => {
    const a = shadowCase('x', 'a'), b = shadowCase('x', 'b')
    const la = outcome(a, 'below_threshold'), lb = outcome(b, 'below_threshold')
    const duplicate = calibrateHistoricalShadow({ cases: [a, b], outcomes: [la, la, lb], policy })
    expect(duplicate.groups[0].resolved).toBe(1)
    const repeatedCase = calibrateHistoricalShadow({ cases: [a, a], outcomes: [la], policy })
    expect(repeatedCase.groups[0].resolved).toBe(0)
    const missing = calibrateHistoricalShadow({ cases: [a, b], outcomes: [la], policy })
    expect(missing.groups[0].unresolved).toBe(1)
    lb.decision_receipt_id = la.decision_receipt_id; lb.receipt_sha256 = outcomeReceiptSha256(lb)
    expect(calibrateHistoricalShadow({ cases: [a, b], outcomes: [la, lb], policy }).groups[0].resolved).toBe(0)
  })

  it('changes exact hashes on source drift and has no network, environment, or action dependencies', () => {
    const item = shadowCase('linkedin', 'source')
    const label = outcome(item, 'below_threshold')
    const before = structuredClone(item)
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden') })
    const env = vi.spyOn(process, 'env', 'get').mockImplementation(() => { throw new Error('environment forbidden') })
    try {
      const clean = calibrateHistoricalShadow({ cases: [item], outcomes: [label], policy })
      expect(clean.traces[0].approved).not.toBeNull()
      ;(item.comparables[0].raw_response as { analytics: { engagements: number } }).analytics.engagements = 500
      const changed = calibrateHistoricalShadow({ cases: [item], outcomes: [label], policy })
      expect(changed.traces[0].approved).toBeNull()
      expect(changed.traces[0].cohort_receipt_sha256).not.toBe(clean.traces[0].cohort_receipt_sha256)
      expect(changed.traces[0].source_and_cohort_rejections.length).toBeGreaterThan(0)
      expect(fetch).not.toHaveBeenCalled(); expect(env).not.toHaveBeenCalled()
      expect(before.comparables[0].raw_response).not.toEqual(item.comparables[0].raw_response)
      expect(changed.external_actions_enabled).toBe(false)
      expect(changed.policy_changes_enabled).toBe(false)
    } finally { fetch.mockRestore(); env.mockRestore() }
  })

  it('keeps cross-channel comparables and absent performance receipts visible but unscored', () => {
    const item = shadowCase('youtube', 'leak')
    item.comparables[4] = fixture('x', 'foreign')
    const foreign = item.comparables[4]
    item.fixture_manifest.entries[5] = { ...item.fixture_manifest.entries[5], record_id: foreign.provenance.record_id, raw_response_sha256: rawResponseSha256(foreign.raw_response), evidence_version: foreign.evidence_version, collector_version: foreign.collector_version, source_policy_version: foreign.source_policy_version, policy_approval_receipt_id: foreign.policy.approval.receipt_id }
    const label = outcome(item, 'unscored')
    const result = calibrateHistoricalShadow({ cases: [item], outcomes: [label], policy })
    expect(result.traces[0].predicted).toBe('unscored')
    expect(result.traces[0].source_and_cohort_rejections.join(' ')).toContain('Cross-channel')
    expect(result.groups[0]).toMatchObject({ resolved: 1, exact_agreement: 1, precision: null, recall: null, reportable: false })
    expect(result.groups[0].blockers).toContain('Insufficient valid binary comparisons.')
    expect(result.orphan_outcome_receipts).toEqual([])
  })

  it('retains orphan outcome receipts without adding them to any group', () => {
    const item = shadowCase('facebook', 'known')
    const orphan = { ...outcome(item, 'below_threshold'), case_id: 'unknown', decision_receipt_id: 'orphan' }
    const result = calibrateHistoricalShadow({ cases: [item], outcomes: [outcome(item, 'below_threshold'), orphan], policy })
    expect(result.orphan_outcome_receipts).toEqual([orphan])
    expect(result.groups[0].sample_size).toBe(1)
  })

  it.each([
    ['zero', 0, 0, true],
    ['below limit', 1, 0.2, true],
    ['exact limit', 1, 0.25, true],
    ['above limit despite adequate binary comparisons', 1, 1 / 3, false],
  ] as const)('enforces the separate predicted Unscored rate: %s', (_, unscoredCount, expectedRate, reportable) => {
    const cases = [shadowCase('youtube', 'rate-low'), shadowCase('youtube', 'rate-high', true)]
    // Add scored cases to put one Unscored result below or exactly on the policy limit.
    if (unscoredCount && expectedRate <= 0.25) {
      cases.push(shadowCase('youtube', 'rate-extra-low'))
      if (expectedRate < 0.25) cases.push(shadowCase('youtube', 'rate-extra-high', true))
    }
    if (unscoredCount) {
      const unscored = shadowCase('youtube', 'rate-unscored')
      unscored.comparables.pop()
      unscored.fixture_manifest.entries.pop()
      cases.push(unscored)
    }
    const outcomes = cases.map((item) => outcome(item, item.case_id === 'rate-unscored' ? 'unscored' : item.case_id.includes('high') ? 'pass' : 'below_threshold'))
    const result = calibrateHistoricalShadow({ cases, outcomes, policy })
    const group = result.groups[0]
    expect(group.predicted_unscored_rate).toBe(expectedRate)
    expect(group.unresolved_rate).toBe(0)
    expect(group.true_positive + group.true_negative + group.false_positive + group.false_negative).toBeGreaterThanOrEqual(2)
    expect(group.reportable).toBe(reportable)
    expect(group.confidence_eligible).toBe(reportable)
    expect(group.blockers.includes('Predicted Unscored rate exceeds approved limit.')).toBe(!reportable)
  })

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid predicted Unscored policy limit %s', (maximum_unscored_rate) => {
    const low = shadowCase('x', 'invalid-policy-low')
    const high = shadowCase('x', 'invalid-policy-high', true)
    const result = calibrateHistoricalShadow({ cases: [low, high], outcomes: [outcome(low, 'below_threshold'), outcome(high, 'pass')], policy: { ...policy, maximum_unscored_rate } })
    expect(result.groups[0].predicted_unscored_rate).toBe(0)
    expect(result.groups[0].reportable).toBe(false)
    expect(result.groups[0].confidence_eligible).toBe(false)
    expect(result.groups[0].blockers).toContain('Versioned calibration policy or threshold inputs are invalid.')
  })

  it('fails closed on insufficient samples and invalid versioned policy', () => {
    const item = shadowCase('instagram', 'one')
    const result = calibrateHistoricalShadow({ cases: [item], outcomes: [outcome(item, 'below_threshold')], policy })
    expect(result.groups[0].reportable).toBe(false)
    expect(result.groups[0].blockers).toContain('Insufficient case sample.')
    const bad = calibrateHistoricalShadow({ cases: [item], outcomes: [outcome(item, 'below_threshold')], policy: { ...policy, approval_receipt_id: '', maximum_unresolved_rate: -1 } })
    expect(bad.groups[0].blockers).toContain('Versioned calibration policy or threshold inputs are invalid.')
  })
})
