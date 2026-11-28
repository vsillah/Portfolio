import { describe, expect, it, vi } from 'vitest'
import { reconcileLinkedInAttributableEvidence, SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID, type LinkedInAcquisitionInput } from './attributable-linkedin-acquisition'
import { acquireAttributableObservation, type AcquisitionFixture } from './attributable-performance-acquisition'
import { baselineInputSha256, baselineReceiptSha256, policyApprovalSha256, rawResponseSha256, type Baseline } from './attributable-performance-evidence'

const published = '2026-11-18T12:00:00Z'
const observed = '2026-11-25T12:00:00Z'
const evaluated = '2026-11-26T12:00:00Z'
function fixture(id: string): AcquisitionFixture {
  const raw_response = { urn: id, authorUrn: 'li-account', publishedAt: published, permalink: `https://www.linkedin.com/feed/update/${id}/`, mediaType: 'text', analytics: { engagements: 100, impressions: 1000 } }
  const item: AcquisitionFixture = {
    channel: 'linkedin', format: 'text', account_id: 'li-account', account_url: 'https://www.linkedin.com/company/example/', observed_at: observed,
    baseline_id: 'li-baseline', baseline_version: 'v1', evidence_version: 'synthetic-v1', source_policy_version: 'policy-v1',
    observation_grade: 'decision', observation_window: { start: published, end: observed }, audience: { subscribers_or_followers: 5000, observed_at: observed },
    cohort_id: 'li-text-micro-v1', collector_version: 'synthetic-v1', source_class: 'owned_first_party', source_url: 'https://www.linkedin.com/company/example/',
    provenance: { record_id: `record-${id}`, captured_at: observed, method: 'synthetic retained response' },
    rights: { privacy_cleared: true, rights_cleared: true, rights_basis: 'synthetic fixture' },
    rollback: { historical_record_id: `history-${id}`, supersedes_record_id: null, procedure: 'Discard derived report; retain fixture.' }, raw_response,
    policy: { source_class: 'owned_first_party', policy_id: 'synthetic-policy', policy_version: 'policy-v1', evidence_version: 'synthetic-v1', platform: 'linkedin', format: 'text', object_id: id, observation_id: `record-${id}`, raw_response_sha256: rawResponseSha256(raw_response), approved: true, expiry_basis: 'approved_source_class_policy', issued_at: '2026-11-18T00:00:00Z', expires_at: '2026-11-30T00:00:00Z', approval: { receipt_id: `synthetic-policy-${id}`, authority_id: 'synthetic-authority', authority_version: 'v1', policy_sha256: '' } },
  }
  item.policy.approval.policy_sha256 = policyApprovalSha256(item.policy)
  return item
}
function baseline(sample: AcquisitionFixture): Baseline {
  const observation = acquireAttributableObservation(sample).observation!
  const contributions = Array.from({ length: 5 }, (_, index) => ({ record_id: `baseline-${index}`, raw_response_sha256: rawResponseSha256({ index }), account_id: sample.account_id, platform: observation.platform, format: observation.format, metric_name: 'engagements', denominator_name: 'impressions', metric_value: 10, denominator: 200 }))
  const result: Baseline = { baseline_id: 'li-baseline', baseline_version: 'v1', platform: 'linkedin', format: 'text', account_id: sample.account_id, metric_name: 'engagements', denominator_name: 'impressions', metric_value: 50, denominator: 1000, audience: 5000, observed_at: observed, source_record_id: 'synthetic-baseline-source', contributions, input_sha256: '', computation_method: 'aggregate_rate', computation_version: 'v1', computed_at: observed, receipt_sha256: '' }
  result.input_sha256 = baselineInputSha256(result); result.receipt_sha256 = baselineReceiptSha256(result)
  return result
}
function packet(): LinkedInAcquisitionInput {
  const candidate = fixture('candidate')
  const comparables = Array.from({ length: 5 }, (_, index) => fixture(`peer${index}`))
  const fixtures = [candidate, ...comparables]
  const sourcePath = 'lib/attributable-linkedin-acquisition.test.ts'
  return {
    calendar_item_id: SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID, artifact_version: 'synthetic-artifact-v1', content_sha256: rawResponseSha256({ approved_copy: 'synthetic' }), content_snapshot: { approved_copy: 'synthetic' },
    candidate, comparables, baselines: [baseline(candidate)], evaluated_at: evaluated,
    fixture_manifest: { manifest_id: 'synthetic-linkedin-v1', manifest_version: 'v1', policy_id: 'synthetic-policy', policy_version: 'policy-v1', evidence_version: 'synthetic-v1', metric_definition: { metric_name: 'engagements', denominator_name: 'impressions', definition_version: 'v1', approval_receipt_id: 'synthetic-definition-v1' }, entries: fixtures.map((item) => ({ record_id: item.provenance.record_id, raw_response_sha256: rawResponseSha256(item.raw_response), evidence_version: item.evidence_version, collector_version: item.collector_version, source_policy_version: item.source_policy_version, policy_approval_receipt_id: item.policy.approval.receipt_id, kind: 'synthetic', approval_receipt_id: `synthetic-fixture-${item.provenance.record_id}`, source_path: sourcePath })) },
    retained_sources: fixtures.map((item) => ({ record_id: item.provenance.record_id, source_path: sourcePath, raw_response_sha256: rawResponseSha256(item.raw_response), policy_expires_at: item.policy.expires_at, source_route: 'synthetic', impression_origin: 'linkedin_reported', reported_impressions: 1000 })),
  }
}

describe('Phase 5L LinkedIn retained-source reconciliation', () => {
  it('replays five synthetic comparables deterministically without external effects', () => {
    const input = packet()
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network access') })
    const first = reconcileLinkedInAttributableEvidence(input)
    const reverse = reconcileLinkedInAttributableEvidence({ ...input, comparables: [...input.comparables].reverse(), retained_sources: [...input.retained_sources].reverse() })
    expect(first).toEqual(reverse)
    expect(first).toMatchObject({ status: 'synthetic_scored', comparable_count: 5, source_authority: 'synthetic_fixture_only', production_evidence_sufficient: false, production_receipt_enabled: false, packet_linkage_enabled: false, preparation_rerun_enabled: false, notification_enabled: false, external_actions_enabled: false })
    expect(first.decisions.filter((item) => item.role === 'comparable' && item.status === 'Included')).toHaveLength(5)
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })

  it.each([
    ['missing comparable', (v: LinkedInAcquisitionInput) => { v.comparables.pop(); v.fixture_manifest.entries.pop(); v.retained_sources.pop() }, 'Five distinct'],
    ['raw drift', (v: LinkedInAcquisitionInput) => { (v.comparables[0].raw_response as { analytics: { engagements: number } }).analytics.engagements = 999 }, 'SHA-256 differs'],
    ['account mismatch', (v: LinkedInAcquisitionInput) => { (v.comparables[0].raw_response as { authorUrn: string }).authorUrn = 'other' }, 'author differs'],
    ['missing denominator', (v: LinkedInAcquisitionInput) => { (v.comparables[0].raw_response as { analytics: { impressions?: number } }).analytics.impressions = undefined }, 'denominator'],
    ['immature window', (v: LinkedInAcquisitionInput) => { v.comparables[0].observation_window.start = '2026-11-20T12:00:00Z' }, 'immature'],
    ['wrong expiration', (v: LinkedInAcquisitionInput) => { v.retained_sources[1].policy_expires_at = '2026-12-31T00:00:00Z' }, 'expiration differs'],
    ['rights unclear', (v: LinkedInAcquisitionInput) => { v.comparables[0].rights.rights_cleared = false }, 'rights'],
    ['audience mismatch', (v: LinkedInAcquisitionInput) => { v.comparables[0].audience.subscribers_or_followers = 20_000 }, 'Audience band'],
    ['duplicate object', (v: LinkedInAcquisitionInput) => { v.comparables[4] = structuredClone(v.comparables[0]) }, 'Duplicate'],
    ['changed content', (v: LinkedInAcquisitionInput) => { v.content_snapshot = { approved_copy: 'changed' } }, 'content SHA-256'],
    ['wrong calendar', (v: LinkedInAcquisitionInput) => { v.calendar_item_id = '00000000-0000-0000-0000-000000000000' as LinkedInAcquisitionInput['calendar_item_id'] }, 'Calendar item identity'],
  ] as const)('blocks %s', (_, change, reason) => {
    const input = packet(); change(input)
    const report = reconcileLinkedInAttributableEvidence(input)
    expect(report.status).toBe('blocked')
    expect(report.blockers.join(' ').toLowerCase()).toContain(reason.toLowerCase())
    expect(report.production_evidence_sufficient).toBe(false)
  })

  it('keeps historical authority unverified even when the fixture is otherwise complete', () => {
    const input = packet()
    input.fixture_manifest.entries = input.fixture_manifest.entries.map((entry) => ({ ...entry, kind: 'approved_checked_in_historical' }))
    input.retained_sources = input.retained_sources.map((source) => ({ ...source, source_route: 'member_export' }))
    const report = reconcileLinkedInAttributableEvidence(input)
    expect(report.status).toBe('blocked')
    expect(report.source_authority).toBe('historical_approval_store_unverified')
    expect(report.blockers).toContain('Historical source approval and policy authority require owning-store verification.')
  })

  it.each([
    ['Portfolio-derived impressions', (v: LinkedInAcquisitionInput) => { v.retained_sources[0].impression_origin = 'portfolio_derived' }, 'Portfolio-derived impressions'],
    ['reported count drift', (v: LinkedInAcquisitionInput) => { v.retained_sources[0].reported_impressions = 1001 }, 'match the retained response'],
    ['unresolved API activity-to-entity mapping', (v: LinkedInAcquisitionInput) => { v.retained_sources[0].source_route = 'api_response' }, 'API entity mapping'],
    ['source route drift', (v: LinkedInAcquisitionInput) => { v.retained_sources[0].source_route = 'member_export' }, 'source route differs'],
    ['missing source-policy expiry', (v: LinkedInAcquisitionInput) => { v.retained_sources[0].policy_expires_at = '' }, 'source-policy expiration'],
    ['privacy uncleared', (v: LinkedInAcquisitionInput) => { v.candidate!.rights.privacy_cleared = false }, 'privacy'],
    ['wrong format', (v: LinkedInAcquisitionInput) => { v.comparables[0].format = 'image' }, 'format'],
    ['lifetime range instead of seven days', (v: LinkedInAcquisitionInput) => { v.candidate!.observation_window.start = '2025-11-25T12:00:00Z' }, 'window'],
  ] as const)('keeps %s unscored with external actions locked', (_, change, reason) => {
    const input = packet(); change(input)
    const report = reconcileLinkedInAttributableEvidence(input)
    expect(report.status).toBe('blocked')
    expect(report.blockers.join(' ').toLowerCase()).toContain(reason.toLowerCase())
    expect(report.external_actions_enabled).toBe(false)
    expect(report.production_receipt_enabled).toBe(false)
    expect(report.packet_linkage_enabled).toBe(false)
  })
})
