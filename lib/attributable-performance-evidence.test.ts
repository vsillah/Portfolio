import { describe, expect, it } from 'vitest'
import {
  adaptPlatformObservation,
  evaluateAttributablePerformance,
  rawResponseSha256,
  policyApprovalSha256,
  baselineInputSha256,
  baselineReceiptSha256,
  shadowReplayAttributablePerformance,
  ATTRIBUTABLE_PERFORMANCE_VERSION,
  DECISION_WINDOW_DAYS,
  type Baseline,
  type Platform,
  type PerformanceObservation,
  type RawPlatformObservation,
} from './attributable-performance-evidence'

const now = '2026-11-26T12:00:00Z'
const objectUrls: Record<Platform, (id: string) => string> = {
  linkedin: (id) => `https://www.linkedin.com/posts/test-${id}`,
  youtube: (id) => `https://www.youtube.com/watch?v=${id}`,
  x: (id) => `https://x.com/test/status/${id}`,
  instagram: (id) => `https://www.instagram.com/p/${id}/`,
  facebook: (id) => `https://www.facebook.com/test/posts/${id}`,
}
const accountUrls: Record<Platform, string> = {
  linkedin: 'https://www.linkedin.com/company/example/',
  youtube: 'https://www.youtube.com/@example',
  x: 'https://x.com/example',
  instagram: 'https://www.instagram.com/example/',
  facebook: 'https://www.facebook.com/example',
}

function fixture(id: string, platform: Platform = 'linkedin', format = 'text'): RawPlatformObservation {
  const raw_response = { synthetic: true, id, views: 100 }
  const raw_response_sha256 = rawResponseSha256(raw_response)
  const start = new Date(Date.parse('2026-11-25T12:00:00Z') - (DECISION_WINDOW_DAYS[platform][format] ?? 7) * 86_400_000).toISOString()
  const value: RawPlatformObservation = {
    platform, format, object_id: id, object_url: objectUrls[platform](id),
    account_id: 'synthetic-account', baseline_id: 'synthetic-baseline', baseline_version: 'v1', evidence_version: 'synthetic-evidence-v1', source_policy_version: 'v1', observation_grade: 'decision', account_url: accountUrls[platform],
    published_at: start, observed_at: '2026-11-25T12:00:00Z',
    observation_window: { start, end: '2026-11-25T12:00:00Z' },
    raw_response, raw_response_sha256,
    metric: { name: 'views', value: 100, denominator_name: 'impressions', denominator: 1000 },
    audience: { subscribers_or_followers: 5000, observed_at: '2026-11-25T12:00:00Z' },
    cohort_id: 'synthetic-cohort', collector_version: 'fixture-collector-v1', scoring_version: ATTRIBUTABLE_PERFORMANCE_VERSION,
    source_class: 'owned_first_party', source_url: objectUrls[platform](id),
    provenance: { record_id: `record-${id}`, captured_at: '2026-11-25T12:00:00Z', method: 'synthetic fixture' },
    rights: { privacy_cleared: true, rights_cleared: true, rights_basis: 'synthetic fixture' },
    policy: { source_class: 'owned_first_party', policy_id: 'synthetic-policy', policy_version: 'v1', evidence_version: 'synthetic-evidence-v1', platform, format, object_id: id, observation_id: `record-${id}`, raw_response_sha256, approved: true, expiry_basis: 'approved_source_class_policy', issued_at: '2026-10-01T00:00:00Z', expires_at: '2026-11-30T00:00:00Z', approval: { receipt_id: `approval-${id}`, authority_id: 'synthetic-authority', authority_version: 'v1', policy_sha256: '' } },
    rollback: { historical_record_id: `history-${id}`, supersedes_record_id: null, procedure: 'Revert the derived receipt; retain historical observation.' },
  }
  value.policy.approval.policy_sha256 = policyApprovalSha256(value.policy)
  return value
}

function sealPolicy(raw: RawPlatformObservation): RawPlatformObservation {
  raw.policy.approval.policy_sha256 = policyApprovalSha256(raw.policy)
  return raw
}

function baselineFor(account_id = 'synthetic-account', baseline_id = 'synthetic-baseline'): Baseline {
  const contributions = Array.from({ length: 5 }, (_, index) => ({
    record_id: `baseline-source-${account_id}-${index}`, raw_response_sha256: rawResponseSha256({ baseline: account_id, index }),
    account_id, platform: 'linkedin' as const, format: 'text', metric_name: 'views', denominator_name: 'impressions', metric_value: 10, denominator: 200,
  }))
  const baseline: Baseline = {
    baseline_id, baseline_version: 'v1', platform: 'linkedin', format: 'text', account_id,
    metric_name: 'views', denominator_name: 'impressions', metric_value: 50, denominator: 1000,
    audience: 5000, observed_at: '2026-11-25T12:00:00Z', source_record_id: `baseline-history-${account_id}`,
    contributions, input_sha256: '', computation_method: 'aggregate_rate', computation_version: 'v1', computed_at: '2026-11-25T12:00:00Z', receipt_sha256: '',
  }
  baseline.input_sha256 = baselineInputSha256(baseline)
  baseline.receipt_sha256 = baselineReceiptSha256(baseline)
  return baseline
}

function adapt(raw: RawPlatformObservation): PerformanceObservation {
  const result = adaptPlatformObservation(raw)
  expect(result.blockers).toEqual([])
  return result.observation!
}

function packet() {
  const candidate = adapt(fixture('candidate'))
  const comparables = Array.from({ length: 5 }, (_, index) => adapt(fixture(`peer${index}`)))
  const baseline = baselineFor()
  return { candidate, comparables, baselines: [baseline], evaluated_at: now }
}

describe('attributable performance evidence', () => {
  it('adapts the platform and format boundaries without cross-format equivalence', () => {
    const cases: Array<[Platform, string]> = [
      ['linkedin', 'text'], ['linkedin', 'image'], ['linkedin', 'document'], ['linkedin', 'video'],
      ['youtube', 'long_form'], ['youtube', 'shorts'], ['youtube', 'live'],
      ['x', 'single_post'], ['x', 'thread'], ['x', 'image'], ['x', 'video'],
      ['instagram', 'feed'], ['instagram', 'carousel'], ['instagram', 'reel'],
      ['facebook', 'text'], ['facebook', 'link'], ['facebook', 'image'], ['facebook', 'reel'], ['facebook', 'video'],
    ]
    for (const [platform, format] of cases) expect(adaptPlatformObservation(fixture(`id-${platform}-${format}`, platform, format)).observation).not.toBeNull()
    expect(adaptPlatformObservation(fixture('wrong', 'youtube', 'carousel')).blockers).toContain('Unsupported platform/format boundary.')
  })

  it('scores a fresh owned cohort against its attributable same-account baseline', () => {
    const receipt = evaluateAttributablePerformance(packet())
    expect(receipt).toMatchObject({ status: 'Scored', relative_performance: 2, outlier_score: 50, outlier_verdict: 'below_threshold', baseline_id: 'synthetic-baseline', external_actions_enabled: false, handoff: 'none' })
    expect(receipt.included_record_ids).toHaveLength(5)
    expect(receipt.historical_record_ids).toHaveLength(6)
  })

  it('keeps missing or default baselines Unscored without inventing relative performance', () => {
    const missing = evaluateAttributablePerformance({ ...packet(), baselines: [] })
    expect(missing).toMatchObject({ status: 'Unscored', score: null, relative_performance: null, handoff: 'none' })
    const wrongAccount = packet()
    wrongAccount.baselines[0].account_id = 'another-account'
    expect(evaluateAttributablePerformance(wrongAccount).status).toBe('Unscored')
    const tampered = packet()
    tampered.baselines[0].metric_value = 99
    expect(evaluateAttributablePerformance(tampered)).toMatchObject({ status: 'Unscored', relative_performance: null })
  })

  it('uses the explicit 75-point outlier boundary on normalized comparable performance', () => {
    const make = (lower: number) => {
      const value = packet()
      value.comparables = Array.from({ length: 100 }, (_, index) => {
        const raw = fixture(`rank-${index}`)
        raw.metric.value = index < lower ? 50 : 150
        return adapt(raw)
      })
      return evaluateAttributablePerformance(value)
    }
    expect(make(74)).toMatchObject({ outlier_score: 74, outlier_threshold: 75, outlier_verdict: 'below_threshold' })
    expect(make(75)).toMatchObject({ outlier_score: 75, outlier_threshold: 75, outlier_verdict: 'pass', handoff: 'internal_human_qa_preparation_only' })
  })

  it('rejects changed raw responses, ambiguous identity, missing denominator, and inferred expiry', () => {
    const changed = fixture('changed')
    changed.raw_response = { changed: true }
    expect(adaptPlatformObservation(changed).blockers).toContain('Immutable raw-response SHA-256 does not match.')
    const ambiguous = fixture('ambiguous')
    ambiguous.object_url = objectUrls.linkedin('different')
    expect(adaptPlatformObservation(ambiguous).blockers).toContain('Ambiguous canonical platform object identity.')
    const missing = fixture('missing')
    missing.metric.denominator = 0
    expect(adaptPlatformObservation(missing).blockers).toContain('Attributable metric or denominator is missing.')
    const inferred = fixture('inferred')
    inferred.policy.expires_at = inferred.provenance.captured_at
    inferred.policy.approved = false
    expect(adaptPlatformObservation(inferred).blockers).toContain('Explicit expiry from an approved version-bound source-class policy is missing.')
  })

  it('preserves excluded duplicate, cross-channel, cross-format and wrong-audience records', () => {
    const value = packet()
    value.comparables.push(adapt(fixture('peer0')))
    value.comparables.push(adapt(fixture('cross', 'x', 'single_post')))
    value.comparables.push(adapt(fixture('different-format', 'linkedin', 'video')))
    const wrongAudience = fixture('wrong-audience')
    wrongAudience.audience.subscribers_or_followers = 500_000
    value.comparables.push(adapt(wrongAudience))
    const receipt = evaluateAttributablePerformance(value)
    expect(receipt.status).toBe('Scored')
    expect(receipt.excluded.map(({ reason }) => reason)).toEqual(expect.arrayContaining([
      'Duplicate canonical object.', 'Cross-channel equivalence is unsupported.',
      'Cross-format equivalence is unsupported.', 'Audience band does not match.',
    ]))
  })

  it('retains historical observations while stale evidence loses current eligibility', () => {
    const stale = packet()
    stale.evaluated_at = '2026-12-01T00:00:00Z'
    const receipt = evaluateAttributablePerformance(stale)
    expect(receipt.status).toBe('Unscored')
    expect(receipt.historical_record_ids).toHaveLength(6)
    expect(receipt.blockers).toContain('Candidate: Source-class policy expiry has passed.')
  })

  it('holds immature and directional observation windows Unscored', () => {
    const directional = fixture('directional')
    directional.observation_grade = 'directional'
    expect(evaluateAttributablePerformance({ ...packet(), candidate: adapt(directional) }).blockers).toContain('Candidate: Directional or immature decision window cannot be scored.')
    const immature = fixture('immature')
    immature.observation_window.start = '2026-11-24T12:00:00Z'
    expect(evaluateAttributablePerformance({ ...packet(), candidate: adapt(immature) }).status).toBe('Unscored')
  })

  it('rejects stale or mismatched evidence-version policy binding', () => {
    const mismatch = fixture('version')
    mismatch.policy.evidence_version = 'old-evidence-v0'
    expect(adaptPlatformObservation(mismatch).blockers).toContain('Source policy is not bound to this exact evidence version and observation.')
    const changedPolicy = fixture('hash-binding')
    changedPolicy.policy.raw_response_sha256 = 'a'.repeat(64)
    expect(adaptPlatformObservation(changedPolicy).blockers).toContain('Source policy is not bound to this exact evidence version and observation.')
    const changedVersion = fixture('policy-version')
    changedVersion.policy.policy_version = 'v2'
    expect(adaptPlatformObservation(changedVersion).blockers).toContain('Source policy is not bound to this exact evidence version and observation.')
    const stale = fixture('stale-policy')
    stale.policy.expires_at = '2026-11-25T12:00:00Z'
    expect(evaluateAttributablePerformance({ ...packet(), candidate: adapt(sealPolicy(stale)) }).status).toBe('Unscored')
    const missingAuthority = fixture('missing-authority')
    missingAuthority.policy.approval.authority_id = ''
    expect(adaptPlatformObservation(missingAuthority).blockers).toContain('Policy approval authority or immutable receipt binding is missing or changed.')
    const changedAuthority = fixture('changed-authority')
    changedAuthority.policy.approval.authority_id = 'different-authority'
    expect(adaptPlatformObservation(changedAuthority).blockers).toContain('Policy approval authority or immutable receipt binding is missing or changed.')
    const tamperedAuthority = fixture('tampered-authority')
    tamperedAuthority.policy.expires_at = '2026-12-10T00:00:00Z'
    expect(adaptPlatformObservation(tamperedAuthority).blockers).toContain('Policy approval authority or immutable receipt binding is missing or changed.')
    const thirdParty = fixture('third-party')
    thirdParty.source_url = 'https://example.com/claimed-performance'
    expect(adaptPlatformObservation(thirdParty).blockers).toContain('Account, channel, or platform-authoritative source URL is missing.')
  })

  it('keeps incomplete external evidence at zero performance weight, but accepts complete attributable external evidence', () => {
    const incomplete = fixture('external')
    incomplete.source_class = 'external_creator'
    incomplete.policy.source_class = 'external_creator'
    incomplete.metric.denominator = 0
    const context = adapt(sealPolicy(incomplete))
    expect(context).toMatchObject({ performance_weight: 0, evidence_use: 'structural_topic_context' })
    const value = packet()
    value.comparables.push(context)
    expect(evaluateAttributablePerformance(value).excluded).toContainEqual({ record_id: 'record-external', reason: 'External creator evidence has zero performance weight; structural/topic context only.' })
    const complete = fixture('external-complete')
    complete.source_class = 'external_creator'
    complete.policy.source_class = 'external_creator'
    expect(adapt(sealPolicy(complete)).performance_weight).toBe(1)
    complete.account_id = 'creator-account'
    complete.baseline_id = 'creator-baseline'
    const creator = adapt(complete)
    const withCreator = packet()
    withCreator.comparables = withCreator.comparables.slice(0, 4).concat(creator)
    expect(evaluateAttributablePerformance(withCreator).excluded).toContainEqual({ record_id: 'record-external-complete', reason: 'Comparable lacks its own attributable same-account baseline.' })
    withCreator.baselines.push(baselineFor('creator-account', 'creator-baseline'))
    expect(evaluateAttributablePerformance(withCreator)).toMatchObject({ status: 'Scored', included_record_ids: expect.arrayContaining(['record-external-complete']) })
  })

  it('shadow-replays fresh, stale, incomplete, changed, duplicate, mixed-boundary, and zero-weight receipts', () => {
    const fresh = packet()
    const stale = { ...packet(), evaluated_at: '2026-12-01T00:00:00Z' }
    const incomplete = { ...packet(), baselines: [] }
    const changed = packet()
    changed.candidate.policy.evidence_version = 'changed-after-capture'
    const duplicate = packet()
    duplicate.comparables[4] = duplicate.comparables[0]
    const crossChannel = packet()
    crossChannel.comparables[4] = adapt(fixture('shadow-x', 'x', 'single_post'))
    const crossFormat = packet()
    crossFormat.comparables[4] = adapt(fixture('shadow-video', 'linkedin', 'video'))
    const wrongBand = packet()
    const wrongAudience = fixture('shadow-audience')
    wrongAudience.audience.subscribers_or_followers = 500_000
    wrongBand.comparables[4] = adapt(wrongAudience)
    const externalZero = packet()
    const externalRaw = fixture('shadow-external')
    externalRaw.source_class = 'external_creator'
    externalRaw.policy.source_class = 'external_creator'
    externalRaw.metric.denominator = 0
    externalZero.comparables[4] = adapt(sealPolicy(externalRaw))
    const cases = [fresh, stale, incomplete, changed, duplicate, crossChannel, crossFormat, wrongBand, externalZero]
    const first = shadowReplayAttributablePerformance(cases)
    expect(shadowReplayAttributablePerformance(cases)).toEqual(first)
    expect(first[0].receipt_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(first[0].receipt_sha256).not.toBe(first[1].receipt_sha256)
    expect(first.map((item) => item.status)).toEqual(['Scored', 'Unscored', 'Unscored', 'Unscored', 'Unscored', 'Unscored', 'Unscored', 'Unscored', 'Unscored'])
    expect(first[4].excluded[0].reason).toBe('Duplicate canonical object.')
    expect(first[5].excluded[0].reason).toBe('Cross-channel equivalence is unsupported.')
    expect(first[6].excluded[0].reason).toBe('Cross-format equivalence is unsupported.')
    expect(first[7].excluded[0].reason).toBe('Audience band does not match.')
    expect(first[8].excluded[0].reason).toContain('zero performance weight')
    expect(first.every((item) => item.external_actions_enabled === false)).toBe(true)
  })
})
