import { describe, expect, it, vi } from 'vitest'
import { constructHistoricalCohort, type HistoricalFixtureManifest } from './attributable-historical-cohort'
import { acquireAttributableObservation, type AcquisitionChannel, type AcquisitionFixture } from './attributable-performance-acquisition'
import { baselineInputSha256, baselineReceiptSha256, policyApprovalSha256, rawResponseSha256, type Baseline } from './attributable-performance-evidence'
import { calibrateHistoricalShadow, outcomeReceiptSha256, type ApprovedOutcomeReceipt, type CalibrationPolicy, type ShadowCase } from './attributable-shadow-calibration'
import { createHash } from 'node:crypto'
import { calibrationIntegrationApprovalSha256, prepareSyntheticCalibrationIntegration, type CalibrationIntegrationApproval, type SyntheticRepairReview } from './attributable-calibration-integration'
import type { RepairBinding } from './evidence-repair-human-qa'

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

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function repair(sourceSha256: string): RepairBinding {
  const body = {
    caseId: `calendar:${id(3)}:repair-packet:${id(1)}`, packetId: id(1), packetVersion: observed,
    originalPacketId: id(2), originalPacketVersion: published, calendarItemId: id(3), socialContentId: id(4),
    sourceSha256, sourceExpiresAt: '2026-11-30T00:00:00Z', approvedCopySha256: sha('copy'),
    evidenceVersion: observed, contentVersion: observed, claimBoundarySha256: sha('claim'),
  }
  return { ...body, bindingHash: sha(body) }
}
function setup() {
  const low = shadowCase('youtube', 'low')
  const high = shadowCase('youtube', 'high', true)
  const input = { cases: [low, high], outcomes: [outcome(low, 'below_threshold'), outcome(high, 'pass')], policy }
  const expected_report = calibrateHistoricalShadow(input)
  const trace = expected_report.traces.find(row => row.case_id === 'high')!
  const source = trace.cohort_receipt.decisions[0]
  const binding = repair(source.raw_response_sha256)
  const review: SyntheticRepairReview = {
    environment: 'synthetic_staging', binding, current_binding: structuredClone(binding),
    candidate_status: 'human_qa_pending', linkage_status: 'unlinked', preparation_rerun_status: 'not_run',
    approved_copy_unchanged: true, freshness_status: 'passed', provenance_status: 'verified_primary_source',
    privacy_cleared: true, rights_cleared: true, external_actions_allowed: false,
  }
  const approval: CalibrationIntegrationApproval = {
    decision_receipt_id: 'synthetic-integration-decision', authority_id: 'synthetic-review-store', authority_version: 'v1',
    decision: 'allow_synthetic_review_candidate', report_sha256: expected_report.receipt_sha256,
    policy_id: policy.policy_id, policy_version: policy.policy_version, policy_approval_receipt_id: policy.approval_receipt_id,
    case_id: trace.case_id, artifact_version: trace.artifact_version, evidence_version: source.evidence_version,
    platform: trace.platform, format: trace.format, cohort_receipt_sha256: trace.cohort_receipt_sha256,
    performance_receipt_sha256: trace.performance_receipt_sha256!, source_sha256: source.raw_response_sha256,
    repair_binding_hash: binding.bindingHash, decided_at: '2026-11-26T11:00:00Z', valid_until: '2026-11-30T00:00:00Z',
    privacy_cleared: true, rights_cleared: true, exclusions: [], source_path: 'lib/attributable-calibration-integration.test.ts',
    rollback: 'Discard derived synthetic candidate and retain original receipts.', receipt_sha256: '',
  }
  approval.receipt_sha256 = calibrationIntegrationApprovalSha256(approval)
  return { ...input, expected_report, approval, authority_verified: true, review }
}

describe('Phase 5J approval-bound synthetic integration', () => {
  it('prepares a deterministic exact-version internal review candidate with every execution lock off', () => {
    const input = setup()
    const first = prepareSyntheticCalibrationIntegration(input)
    expect(first).toMatchObject({ status: 'ready', blockers: [], scope: 'internal_captain_review_only',
      report_sha256: input.expected_report.receipt_sha256, approval_receipt_sha256: input.approval.receipt_sha256,
      repair_binding_hash: input.review.binding.bindingHash, production_writes_enabled: false,
      packet_linkage_enabled: false, label_promotion_enabled: false, notification_enabled: false,
      external_actions_enabled: false })
    expect(first.review_path).toContain(input.review.binding.packetId)
    expect(first.provenance).toMatchObject({ source_sha256: input.review.binding.sourceSha256,
      cohort_receipt_sha256: input.approval.cohort_receipt_sha256,
      performance_receipt_sha256: input.approval.performance_receipt_sha256 })
    expect(prepareSyntheticCalibrationIntegration(input)).toEqual(first)
    expect(input.review.current_binding).toEqual(input.review.binding)
  })

  it.each([
    ['missing approval', (v: ReturnType<typeof setup>) => { v.approval = null as unknown as CalibrationIntegrationApproval }],
    ['unverified authority', (v: ReturnType<typeof setup>) => { v.authority_verified = false }],
    ['changed report', (v: ReturnType<typeof setup>) => { v.cases[1].comparables[0].raw_response = { changed: true } }],
    ['stale approval', (v: ReturnType<typeof setup>) => { v.approval.valid_until = '2026-11-25T00:00:00Z' }],
    ['receipt mismatch', (v: ReturnType<typeof setup>) => { v.approval.report_sha256 = '0'.repeat(64) }],
    ['duplicate approval label', (v: ReturnType<typeof setup>) => { v.outcomes.push(v.outcomes[0]) }],
    ['changed repair binding', (v: ReturnType<typeof setup>) => { v.review.current_binding.contentVersion = published }],
    ['cross channel', (v: ReturnType<typeof setup>) => { v.approval.platform = 'x' }],
    ['cross format', (v: ReturnType<typeof setup>) => { v.approval.format = 'shorts' }],
    ['privacy failure', (v: ReturnType<typeof setup>) => { v.approval.privacy_cleared = false }],
    ['rights failure', (v: ReturnType<typeof setup>) => { v.review.rights_cleared = false as true }],
    ['execution lock', (v: ReturnType<typeof setup>) => { v.review.external_actions_allowed = true as false }],
  ] as const)('blocks %s without an action path', (_, mutate) => {
    const input = setup(); mutate(input)
    const result = prepareSyntheticCalibrationIntegration(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.length).toBeGreaterThan(0)
    expect(result.review_path).toBeNull()
    expect(result.production_writes_enabled).toBe(false)
    expect(result.packet_linkage_enabled).toBe(false)
    expect(result.label_promotion_enabled).toBe(false)
    expect(result.notification_enabled).toBe(false)
    expect(result.external_actions_enabled).toBe(false)
  })

  it('blocks insufficient cohorts, unresolved labels, and excessive predicted Unscored rate', () => {
    for (const change of ['cohort', 'label', 'unscored'] as const) {
      const input = setup()
      if (change === 'cohort') { input.cases[1].comparables.pop(); input.cases[1].fixture_manifest.entries.pop() }
      if (change === 'label') input.outcomes.pop()
      if (change === 'unscored') {
        const item = shadowCase('youtube', 'unscored')
        item.comparables.pop(); item.fixture_manifest.entries.pop()
        input.cases.push(item); input.outcomes.push(outcome(item, 'unscored'))
        input.expected_report = calibrateHistoricalShadow(input)
        input.approval.report_sha256 = input.expected_report.receipt_sha256
        input.approval.receipt_sha256 = calibrationIntegrationApprovalSha256(input.approval)
      }
      expect(prepareSyntheticCalibrationIntegration(input).status).toBe('blocked')
    }
  })

  it('never reads the network or environment and does not mutate fixtures on replay', () => {
    const input = setup(), original = structuredClone(input)
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw Error('network forbidden') })
    const env = vi.spyOn(process, 'env', 'get').mockImplementation(() => { throw Error('environment forbidden') })
    try {
      expect(prepareSyntheticCalibrationIntegration(input).status).toBe('ready')
      expect(input).toEqual(original)
      expect(fetch).not.toHaveBeenCalled()
      expect(env).not.toHaveBeenCalled()
    } finally { fetch.mockRestore(); env.mockRestore() }
  })
})
