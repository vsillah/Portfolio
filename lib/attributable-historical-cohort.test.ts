import { describe, expect, it, vi } from 'vitest'
import { constructHistoricalCohort, type HistoricalFixtureManifest } from './attributable-historical-cohort'
import { acquireAttributableObservation, type AcquisitionFixture } from './attributable-performance-acquisition'
import { baselineInputSha256, baselineReceiptSha256, policyApprovalSha256, rawResponseSha256, type Baseline } from './attributable-performance-evidence'

const published = '2026-11-18T12:00:00Z'
const observed = '2026-11-25T12:00:00Z'
const evaluated_at = '2026-11-26T12:00:00Z'

function fixture(id: string, options: { channel?: 'youtube' | 'youtube_shorts' | 'x'; account?: string; audience?: number; format?: string } = {}): AcquisitionFixture {
  const channel = options.channel ?? 'youtube'
  const platform = channel === 'x' ? 'x' : 'youtube'
  const format = options.format ?? (channel === 'youtube_shorts' ? 'shorts' : channel === 'x' ? 'single_post' : 'long_form')
  const account_id = options.account ?? (channel === 'x' ? 'x-account' : 'yt-account')
  const account_url = channel === 'x' ? 'https://x.com/example' : 'https://www.youtube.com/@example'
  const raw_response = channel === 'x'
    ? { id, author_id: account_id, author_handle: 'example', created_at: published, url: `https://x.com/example/status/${id}`, post_format: format, public_metrics: { engagement_count: 100, impression_count: 1000 } }
    : { id, snippet: { channelId: account_id, publishedAt: published }, canonicalUrl: channel === 'youtube_shorts' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`, videoFormat: format, analytics: { views: 100, impressions: 1000 } }
  const value: AcquisitionFixture = {
    channel, format, account_id, account_url, observed_at: observed,
    baseline_id: `baseline-${platform}-${format}-${account_id}`, baseline_version: 'v1', evidence_version: 'fixture-v1', source_policy_version: 'policy-v1',
    observation_grade: 'decision', observation_window: { start: published, end: observed },
    audience: { subscribers_or_followers: options.audience ?? 5000, observed_at: observed }, cohort_id: 'cohort-v1', collector_version: 'fixture-collector-v1',
    source_class: 'owned_first_party', source_url: account_url, provenance: { record_id: `record-${id}`, captured_at: observed, method: 'checked-in synthetic fixture' },
    rights: { privacy_cleared: true, rights_cleared: true, rights_basis: 'synthetic fixture' },
    rollback: { historical_record_id: `history-${id}`, supersedes_record_id: null, procedure: 'Discard derived manifest; retain source fixture.' },
    raw_response,
    policy: { source_class: 'owned_first_party', policy_id: 'fixture-policy', policy_version: 'policy-v1', evidence_version: 'fixture-v1', platform, format, object_id: id, observation_id: `record-${id}`, raw_response_sha256: rawResponseSha256(raw_response), approved: true, expiry_basis: 'approved_source_class_policy', issued_at: '2026-11-18T00:00:00Z', expires_at: '2026-11-30T00:00:00Z', approval: { receipt_id: `policy-approval-${id}`, authority_id: 'fixture-authority', authority_version: 'v1', policy_sha256: '' } },
  }
  value.policy.approval.policy_sha256 = policyApprovalSha256(value.policy)
  return value
}
function baseline(sample: AcquisitionFixture): Baseline {
  const observation = acquireAttributableObservation(sample).observation!
  const contributions = Array.from({ length: 5 }, (_, index) => ({ record_id: `base-${sample.baseline_id}-${index}`, raw_response_sha256: rawResponseSha256({ baseline: sample.baseline_id, index }), account_id: sample.account_id, platform: observation.platform, format: observation.format, metric_name: observation.metric.name, denominator_name: observation.metric.denominator_name, metric_value: 10, denominator: 200 }))
  const value: Baseline = { baseline_id: sample.baseline_id, baseline_version: 'v1', platform: observation.platform, format: observation.format, account_id: sample.account_id, metric_name: observation.metric.name, denominator_name: observation.metric.denominator_name, metric_value: 50, denominator: 1000, audience: sample.audience.subscribers_or_followers, observed_at: observed, source_record_id: `source-${sample.baseline_id}`, contributions, input_sha256: '', computation_method: 'aggregate_rate', computation_version: 'v1', computed_at: observed, receipt_sha256: '' }
  value.input_sha256 = baselineInputSha256(value); value.receipt_sha256 = baselineReceiptSha256(value)
  return value
}
function packet() {
  const candidate = fixture('candidate')
  const comparables = Array.from({ length: 5 }, (_, index) => fixture(`peer${index}`))
  const fixtures = [candidate, ...comparables]
  const fixture_manifest: HistoricalFixtureManifest = { manifest_id: 'checked-in-synthetic-v1', manifest_version: 'v1', policy_id: 'fixture-policy', policy_version: 'policy-v1', evidence_version: 'fixture-v1', metric_definition: { metric_name: 'views', denominator_name: 'impressions', definition_version: 'v1', approval_receipt_id: 'fixture-metric-approval-v1' }, entries: fixtures.map((item) => ({ record_id: item.provenance.record_id, raw_response_sha256: rawResponseSha256(item.raw_response), evidence_version: item.evidence_version, collector_version: item.collector_version, source_policy_version: item.source_policy_version, policy_approval_receipt_id: item.policy.approval.receipt_id, kind: 'synthetic', approval_receipt_id: `fixture-approval-${item.provenance.record_id}`, source_path: 'lib/attributable-historical-cohort.test.ts' })) }
  return { candidate, comparables, baselines: [baseline(candidate)], fixture_manifest, evaluated_at }
}
function replaceLast(input: ReturnType<typeof packet>, replacement: AcquisitionFixture) {
  input.comparables[4] = replacement
  input.fixture_manifest.entries[5] = { ...input.fixture_manifest.entries[5], record_id: replacement.provenance.record_id, raw_response_sha256: rawResponseSha256(replacement.raw_response), evidence_version: replacement.evidence_version, collector_version: replacement.collector_version, source_policy_version: replacement.source_policy_version, policy_approval_receipt_id: replacement.policy.approval.receipt_id }
}

describe('Phase 5H historical cohort construction', () => {
  it('constructs a stable, fully traced five-comparable read-only manifest', () => {
    const input = packet()
    const first = constructHistoricalCohort(input)
    const reversed = constructHistoricalCohort({ ...input, comparables: [...input.comparables].reverse(), fixture_manifest: { ...input.fixture_manifest, entries: [...input.fixture_manifest.entries].reverse() } })
    expect(first).toEqual(reversed)
    expect(first).toMatchObject({ status: 'Scored', qualifying_comparable_count: 5, minimum_comparables: 5, external_actions_enabled: false, performance_receipt: { status: 'Scored', external_actions_enabled: false } })
    expect(first.decisions).toHaveLength(6)
    expect(first.decisions[1]).toMatchObject({ status: 'Included', canonical_identity: { platform: 'youtube', format: 'long_form' }, historical_record_id: 'history-peer0', raw_response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/), baseline_receipt: { receipt_sha256: input.baselines[0].receipt_sha256 }, policy_approval_receipt: { receipt_id: 'policy-approval-peer0' }, rollback: { procedure: expect.any(String) } })
    expect(first.receipt_sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it.each([
    ['cross-channel', () => fixture('other', { channel: 'x' }), 'Cross-channel'],
    ['cross-format', () => fixture('other', { channel: 'youtube_shorts' }), 'Cross-format'],
    ['wrong audience band', () => fixture('other', { audience: 15000 }), 'Audience band'],
    ['unsupported format', () => fixture('other', { format: 'reel' }), 'Unsupported'],
    ['missing denominator', () => { const item = fixture('other'); (item.raw_response as { analytics: { impressions?: number } }).analytics.impressions = undefined; return item }, 'denominator'],
    ['immature window', () => { const item = fixture('other'); item.observation_window.start = '2026-11-20T12:00:00Z'; return item }, 'immature'],
    ['directional grade', () => { const item = fixture('other'); item.observation_grade = 'directional'; return item }, 'Directional'],
    ['stale policy', () => { const item = fixture('other'); item.policy.expires_at = '2026-11-25T00:00:00Z'; item.policy.approval.policy_sha256 = policyApprovalSha256(item.policy); return item }, 'expiry'],
    ['changed policy', () => { const item = fixture('other'); item.policy.policy_version = 'policy-v2'; item.policy.approval.policy_sha256 = policyApprovalSha256(item.policy); return item }, 'policy'],
    ['uncleared rights', () => { const item = fixture('other'); item.rights.rights_cleared = false; return item }, 'rights'],
    ['uncleared privacy', () => { const item = fixture('other'); item.rights.privacy_cleared = false; return item }, 'Privacy'],
    ['wrong account', () => { const item = fixture('other'); (item.raw_response as { snippet: { channelId: string } }).snippet.channelId = 'other-account'; return item }, 'author'],
    ['missing baseline', () => { const item = fixture('other'); item.baseline_id = 'absent'; return item }, 'baseline'],
  ] as const)('%s stays explicit and Unscored', (_, make, phrase) => {
    const input = packet(); replaceLast(input, make())
    const result = constructHistoricalCohort(input)
    expect(result.status).toBe('Unscored')
    expect(result.qualifying_comparable_count).toBe(4)
    expect(result.decisions.find((item) => item.record_id === 'record-other')).toMatchObject({ status: 'Unscored', record_id: 'record-other', rollback: { historical_record_id: 'history-other' } })
    expect(result.decisions.find((item) => item.record_id === 'record-other')?.reason?.toLowerCase()).toContain(phrase.toLowerCase())
    expect(result.external_actions_enabled).toBe(false)
  })

  it('keeps an invalid candidate and its historical metadata without scoring', () => {
    const input = packet(); input.candidate.rights.privacy_cleared = false
    const result = constructHistoricalCohort(input)
    expect(result.status).toBe('Unscored')
    expect(result.performance_receipt).toBeNull()
    expect(result.decisions[0]).toMatchObject({ role: 'candidate', status: 'Unscored', historical_record_id: 'history-candidate' })
  })

  it('requires one approved metric and denominator definition across the cohort', () => {
    const input = packet(); input.fixture_manifest.metric_definition.metric_name = 'engagements'
    const result = constructHistoricalCohort(input)
    expect(result.status).toBe('Unscored')
    expect(result.decisions.every((item) => item.reason?.includes('Approved metric or denominator definition'))).toBe(true)
  })

  it('deduplicates canonical objects, record IDs, and retained response identities', () => {
    const input = packet(); replaceLast(input, fixture('peer0'))
    const result = constructHistoricalCohort(input)
    expect(result.status).toBe('Unscored')
    expect(result.decisions.find((item) => item.reason?.includes('Duplicate historical record identity.'))?.reason).toContain('Duplicate canonical object.')
    expect(result.decisions.find((item) => item.reason?.includes('Duplicate historical record identity.'))?.reason).toContain('Duplicate retained response identity.')
    expect(result.decisions.find((item) => item.reason?.includes('Duplicate historical record identity.'))?.reason).toContain('Duplicate historical record identity.')
  })

  it('detects changed fixture bytes and absent approval without revising historical receipts', () => {
    const input = packet(); const previous = constructHistoricalCohort(input)
    ;(input.comparables[4].raw_response as { analytics: { views: number } }).analytics.views = 999
    const changed = constructHistoricalCohort(input)
    expect(changed.status).toBe('Unscored')
    expect(changed.decisions[5].reason).toContain('Checked-in fixture differs')
    expect(changed.receipt_sha256).not.toBe(previous.receipt_sha256)
    input.fixture_manifest.entries.pop()
    expect(constructHistoricalCohort(input).decisions[5].reason).toContain('Checked-in fixture approval is missing.')
  })

  it('remains pure with network, environment, persistence, and notifications unavailable', () => {
    const input = packet()
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network') })
    const env = vi.spyOn(process, 'env', 'get').mockImplementation(() => { throw new Error('environment') })
    const output = constructHistoricalCohort(input)
    expect(output.status).toBe('Scored')
    expect(fetch).not.toHaveBeenCalled(); expect(env).not.toHaveBeenCalled()
    fetch.mockRestore(); env.mockRestore()
    expect(input.comparables).toHaveLength(5)
  })
})
