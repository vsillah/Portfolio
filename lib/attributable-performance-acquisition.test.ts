import { describe, expect, it, vi } from 'vitest'
import { acquireAttributableObservation, shadowReplayAcquisition, type AcquisitionChannel, type AcquisitionFixture } from './attributable-performance-acquisition'
import { ATTRIBUTABLE_PERFORMANCE_VERSION, baselineInputSha256, baselineReceiptSha256, policyApprovalSha256, rawResponseSha256, type Baseline } from './attributable-performance-evidence'

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

describe('read-only acquisition adapters', () => {
  it.each(cases)('normalizes synthetic %s %s without network or credentials', (channel, format) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const value = acquireAttributableObservation(fixture(channel, 'candidate'))
    expect(value.blockers).toEqual([])
    expect(value.observation).toMatchObject({ platform: channel === 'youtube_shorts' ? 'youtube' : channel, format, metric: { denominator: 1000 }, scoring_version: ATTRIBUTABLE_PERFORMANCE_VERSION, rollback: { historical_record_id: `history-${channel}-candidate` } })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
    expect(shadowReplayAcquisition(replay(channel))).toMatchObject({ status: 'Scored', receipt: { status: 'Scored', included_record_ids: expect.arrayContaining([`record-${channel}-peer0`]), external_actions_enabled: false } })
  })

  it('fails closed on changed, incomplete, wrong-host, cross-account and cross-format responses', () => {
    const changed = fixture('linkedin', 'changed')
    ;(changed.raw_response as Record<string, unknown>).analytics = { engagements: 999, impressions: 1000 }
    expect(acquireAttributableObservation(changed).blockers).toContain('Source policy is not bound to this exact evidence version and observation.')
    const incomplete = fixture('x', 'incomplete')
    ;(incomplete.raw_response as Record<string, unknown>).public_metrics = { engagement_count: 1 }
    expect(acquireAttributableObservation(incomplete).blockers).toContain('Channel-native metric or denominator is missing or invalid.')
    const wrongHost = fixture('youtube', 'host')
    ;(wrongHost.raw_response as Record<string, unknown>).canonicalUrl = 'https://evil.example/watch?v=host'
    expect(acquireAttributableObservation(wrongHost).blockers).toContain('Response URL is not the exact canonical channel object.')
    const account = fixture('facebook', 'account')
    ;(account.raw_response as Record<string, unknown>).from_id = 'other-page'
    expect(acquireAttributableObservation(account).blockers).toContain('Response author differs from the declared account.')
    const format = fixture('instagram', 'format')
    ;(format.raw_response as Record<string, unknown>).media_format = 'reel'
    expect(acquireAttributableObservation(format).blockers).toContain('Response format differs from the declared format.')
    for (const invalid of [changed, incomplete, wrongHost, account, format]) {
      const packet = replay(invalid.channel)
      packet.candidate = invalid
      expect(shadowReplayAcquisition(packet)).toMatchObject({ status: 'Unscored', receipt: null })
    }
  })

  it('shadow replays stale, duplicate, cross-channel and cross-format evidence as Unscored', () => {
    const fresh = replay('youtube')
    const deterministic = shadowReplayAcquisition(fresh)
    expect(shadowReplayAcquisition(fresh).receipt?.receipt_sha256).toBe(deterministic.receipt?.receipt_sha256)
    const stale = replay('youtube'); stale.evaluated_at = '2026-12-01T00:00:00Z'
    expect(shadowReplayAcquisition(stale).status).toBe('Unscored')
    const duplicate = replay('youtube'); duplicate.comparables[4] = duplicate.comparables[0]
    expect(shadowReplayAcquisition(duplicate).receipt?.excluded[0].reason).toBe('Duplicate canonical object.')
    expect(shadowReplayAcquisition(duplicate).status).toBe('Unscored')
    const channel = replay('youtube'); channel.comparables[4] = fixture('x', 'other')
    expect(shadowReplayAcquisition(channel).receipt?.excluded[0].reason).toBe('Cross-channel equivalence is unsupported.')
    expect(shadowReplayAcquisition(channel).status).toBe('Unscored')
    const format = replay('youtube'); format.comparables[4] = fixture('youtube_shorts', 'short')
    expect(shadowReplayAcquisition(format).receipt?.excluded[0].reason).toBe('Cross-format equivalence is unsupported.')
    expect(shadowReplayAcquisition(format).status).toBe('Unscored')
    const immature = replay('youtube'); immature.candidate.observation_window.start = '2026-11-20T12:00:00Z'
    expect(shadowReplayAcquisition(immature).status).toBe('Unscored')
  })
})
