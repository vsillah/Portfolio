import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import cohort from '@/artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/cohort.json'
import { acquireYouTubeReadOnlyEvidence, YOUTUBE_EVIDENCE_CALENDAR_ID, YOUTUBE_EVIDENCE_COHORT_SHA256, YOUTUBE_EVIDENCE_CONTENT_ID, type YouTubeEvidenceRequest } from './youtube-readonly-evidence-acquisition'
import { rawResponseSha256 } from './attributable-performance-evidence'
import { YOUTUBE_READONLY_SCOPE } from './youtube-oauth'

const now = new Date('2026-11-26T12:00:00.000Z')
const request: YouTubeEvidenceRequest = { content_id: YOUTUBE_EVIDENCE_CONTENT_ID, calendar_item_id: YOUTUBE_EVIDENCE_CALENDAR_ID, cohort_sha256: YOUTUBE_EVIDENCE_COHORT_SHA256, expected_content_updated_at: '2026-11-25T12:00:00.000Z' }
const credentials = { access_token: 'stored-secret', refresh_token: 'refresh-secret', scope: YOUTUBE_READONLY_SCOPE, token_obtained_at: '2026-11-26T11:00:00.000Z', expires_in: 7200 }
const seedByChannel = new Map(cohort.included.map((seed) => [seed.channel_id, seed]))
const seedByVideo = new Map(cohort.included.map((seed) => [seed.video_id, seed]))
function response(value: unknown, status = 200) { return { ok: status === 200, status, json: async () => value, text: async () => JSON.stringify(value) } as Response }
function setup(overrides: Record<string, unknown> = {}, options: {
  video?: (id: string, value: Record<string, unknown>) => Record<string, unknown> | null
  channel?: (id: string, value: Record<string, unknown>) => Record<string, unknown> | null
  providerStatus?: number
} = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url)
    calls.push({ url: target, init })
    if (target.includes('/token')) return response({ access_token: 'transient-secret', scope: YOUTUBE_READONLY_SCOPE })
    if (options.providerStatus) return response({ error: 'quotaExceeded' }, options.providerStatus)
    const parsed = new URL(target)
    const id = parsed.searchParams.get('id')!
    if (parsed.pathname.endsWith('/videos')) {
      const seed = seedByVideo.get(id) ?? cohort.included.find((entry) => entry.channel_baseline.video_ids.includes(id))!
      const value = { id, snippet: { channelId: seed.channel_id, publishedAt: seedByVideo.has(id) ? seed.published_at : '2026-10-01T12:00:00.000Z' }, contentDetails: { duration: `PT${seedByVideo.get(id)?.duration_seconds ?? 30}S` }, statistics: { viewCount: seedByVideo.has(id) ? '1000' : '100', likeCount: '20' }, status: { privacyStatus: 'public' } }
      const changed = options.video?.(id, value) ?? value
      return response({ items: changed ? [changed] : [] })
    }
    const seed = seedByChannel.get(id)!
    const value = { id, statistics: { subscriberCount: String(seed.subscriber_count), hiddenSubscriberCount: false } }
    const changed = options.channel?.(id, value) ?? value
    return response({ items: changed ? [changed] : [] })
  }) as unknown as typeof fetch
  return { input: { request, credentials, is_active: true, content_updated_at: request.expected_content_updated_at, calendar_bound: true, fetchImpl, now, ...overrides }, calls, fetchImpl }
}
afterEach(() => { vi.unstubAllEnvs() })

describe('YouTube read-only evidence acquisition', () => {
  it('refreshes every exact approved comparable and same-channel baseline; selects six micro-band records and preserves large-band exclusions', async () => {
    const { input, calls } = setup()
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.status).toBe('acquired_unscored')
    expect(output.selected_audience_band).toBe('micro')
    expect(output.included_video_ids).toHaveLength(6)
    expect(output.baseline_receipts).toHaveLength(8)
    expect(output.records).toHaveLength(8)
    expect(output.comparable_decisions.filter((decision) => decision.status === 'excluded')).toEqual(expect.arrayContaining([
      expect.objectContaining({ video_id: 'sA6UA2fMNHg', reason: expect.stringContaining('Audience band large') }),
      expect.objectContaining({ video_id: 'DVEOS9t_DHM', reason: expect.stringContaining('Audience band large') }),
    ]))
    expect(output.seed_exclusions).toHaveLength(cohort.excluded.length)
    expect(output.qualification_blockers).toEqual([expect.stringContaining('source-class freshness policy'), expect.stringContaining('privacy and rights')])
    expect(output.source_policy_expires_at).toBeNull()
    expect(output.scoring_enabled).toBe(false)
    expect(output.records.find((record) => record.video_id === 'gTHQpAkgjy4')).toMatchObject({ audience_band: 'micro', views: 1000, likes: 20, comments: null, baseline: { median_views: 100 }, channel_relative_ratio: 10, normalized_performance_score: expect.any(Number), outlier_qualified: expect.any(Boolean) })
    const requestedVideos = calls.filter((call) => new URL(call.url).pathname.endsWith('/videos')).map((call) => new URL(call.url).searchParams.get('id'))
    const requiredVideos = new Set(cohort.included.flatMap((seed) => [seed.video_id, ...seed.channel_baseline.video_ids]))
    expect(new Set(requestedVideos)).toEqual(requiredVideos)
    expect(requestedVideos).toHaveLength(requiredVideos.size)
    expect(calls.filter((call) => new URL(call.url).pathname.endsWith('/channels'))).toHaveLength(8)
    expect(output.provider_responses).toHaveLength(calls.length)
    expect(output.provider_responses.every((entry) => /^[a-f0-9]{64}$/.test(entry.body_sha256))).toBe(true)
    expect(calls.every(({ url, init }) => init?.method === 'GET' && new URL(url).hostname === 'www.googleapis.com' && !url.includes('analytics') && !url.includes('search'))).toBe(true)
    expect(JSON.stringify(output)).not.toMatch(/stored-secret|refresh-secret|transient-secret/)
    const { receipt_sha256, ...body } = output
    expect(receipt_sha256).toBe(rawResponseSha256(body))
    expect(output.baseline_receipts.every((entry) => /^[a-f0-9]{64}$/.test(entry.baseline.receipt_sha256))).toBe(true)
    expect((await acquireYouTubeReadOnlyEvidence(setup().input)).receipt_sha256).toBe(receipt_sha256)
  })
  it.each([
    ['inactive', { is_active: false }], ['missing credentials', { credentials: null }],
    ['missing scope', { credentials: { ...credentials, scope: 'https://www.googleapis.com/auth/youtube.upload' } }],
    ['wrong cohort', { request: { ...request, cohort_sha256: 'wrong' } }],
    ['wrong content', { request: { ...request, content_id: 'other' } }],
    ['wrong calendar', { calendar_bound: false }], ['stale content version', { content_updated_at: 'different' }],
  ])('fails before provider calls for %s', async (_label, overrides) => {
    const { input, calls } = setup(overrides)
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(0)
  })
  it('refreshes an expired access token only in memory', async () => {
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id'); vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret')
    const { input, calls } = setup({ credentials: { ...credentials, token_obtained_at: '2026-11-25T00:00:00.000Z' } })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.status).toBe('acquired_unscored')
    expect(calls[0]).toMatchObject({ url: 'https://oauth2.googleapis.com/token', init: { method: 'POST' } })
    expect(calls.slice(1).every((call) => (call.init?.headers as Record<string, string>).Authorization === 'Bearer transient-secret')).toBe(true)
    expect(JSON.stringify(output)).not.toMatch(/stored-secret|refresh-secret|transient-secret|client-secret/)
    expect(input.credentials).toEqual({ ...credentials, token_obtained_at: '2026-11-25T00:00:00.000Z' })
  })
  it('fails closed on refresh failure with no retry', async () => {
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id'); vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret')
    const { input, calls } = setup({ credentials: { ...credentials, token_obtained_at: '2026-11-25T00:00:00.000Z' } })
    input.fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return response({ error: 'invalid_grant' }, 400) }) as unknown as typeof fetch
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(1)
  })
  it('stops after a provider quota or access failure without retry', async () => {
    const { input, calls } = setup({}, { providerStatus: 403 })
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(1)
  })
  it('excludes a changed channel identity while preserving other attributable records', async () => {
    const id = cohort.included[0].video_id
    const { input } = setup({}, { video: (videoId, value) => videoId === id ? { ...value, snippet: { ...(value.snippet as object), channelId: 'UCwrong' } } : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.comparable_decisions.find((item) => item.video_id === id)).toMatchObject({ status: 'excluded', reason: expect.stringContaining('channel differs') })
    expect(output.included_video_ids).toHaveLength(5)
  })
  it('preserves baseline exclusions and excludes a comparable with fewer than four current exact Shorts baselines', async () => {
    const seed = cohort.included[0]
    const missing = seed.channel_baseline.video_ids[0]
    const { input } = setup({}, { video: (id, value) => id === missing ? { ...value, status: { privacyStatus: 'private' } } : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.baseline_receipts[0].baseline.excluded).toEqual([expect.objectContaining({ video_id: missing, reason: 'Video is no longer public.', response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })])
    expect(output.comparable_decisions[0]).toMatchObject({ status: 'excluded', reason: expect.stringContaining('Only 3 of 4') })
    expect(output.included_video_ids).toHaveLength(5)
  })
  it('blocks when fewer than five current comparables share an audience band', async () => {
    const affected = new Set([cohort.included[0].video_id, cohort.included[1].video_id])
    const { input } = setup({}, { video: (id, value) => affected.has(id) ? { ...value, statistics: {} } : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.status).toBe('blocked')
    expect(output.blockers).toContain('Fewer than five attributable comparables share one current audience band.')
    expect(output.included_video_ids).toHaveLength(0)
    expect(output.comparable_decisions.filter((item) => item.status === 'excluded')).toHaveLength(8)
  })
  it('excludes hidden subscriber counts without guessing an audience band', async () => {
    const seed = cohort.included[0]
    const { input } = setup({}, { channel: (id, value) => id === seed.channel_id ? { ...value, statistics: { hiddenSubscriberCount: true } } : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.comparable_decisions[0]).toMatchObject({ status: 'excluded', audience_band: null, reason: 'Public subscriber baseline is hidden or unavailable.' })
    expect(output.provider_responses.find((entry) => entry.kind === 'channel' && entry.object_id === seed.channel_id)?.body_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(output.included_video_ids).toHaveLength(5)
  })
  it('excludes wrong-format approved baseline video and keeps exact reason', async () => {
    const seed = cohort.included[0]
    const id = seed.channel_baseline.video_ids[0]
    const { input } = setup({}, { video: (videoId, value) => videoId === id ? { ...value, contentDetails: { duration: 'PT4M' } } : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.baseline_receipts[0].baseline.excluded[0]).toMatchObject({ video_id: id, reason: expect.stringContaining('15–60 second') })
  })
  it('hashes a deleted baseline response and records one exclusion without refetching that identity', async () => {
    const seed = cohort.included[0]
    const missing = seed.channel_baseline.video_ids[0]
    const { input, calls, fetchImpl } = setup()
    input.fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (new URL(String(url)).searchParams.get('id') === missing) {
        calls.push({ url: String(url), init })
        return response({ error: 'notFound' }, 404)
      }
      return fetchImpl(url, init)
    }) as unknown as typeof fetch
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.baseline_receipts[0].baseline.excluded[0]).toMatchObject({ video_id: missing, reason: 'Approved video identity is unavailable.', response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(output.provider_responses.find((entry) => entry.kind === 'video' && entry.object_id === missing)).toMatchObject({ http_status: 404, body_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(calls.filter((call) => new URL(call.url).searchParams.get('id') === missing)).toHaveLength(1)
  })
  it('excludes comparable observations beyond the approved publication window', async () => {
    const later = new Date('2028-11-26T12:00:00.000Z')
    const { input } = setup({ now: later, credentials: { ...credentials, token_obtained_at: '2028-11-26T11:00:00.000Z' } })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.status).toBe('blocked')
    expect(output.comparable_decisions).toEqual(expect.arrayContaining([expect.objectContaining({ reason: expect.stringContaining('publication window') })]))
  })
  it('reports exact timestamp and duration decisions with a byte hash and bounded public evidence', async () => {
    const seed = cohort.included[0]
    const observedAt = seed.published_at.replace('.000Z', 'Z')
    const extraSecret = 'provider-secret-must-not-escape'
    const { input } = setup({}, { video: (id, value) => id === seed.video_id
      ? { ...value, snippet: { channelId: seed.channel_id, publishedAt: observedAt, title: extraSecret },
          contentDetails: { duration: 'PT1M' }, statistics: { viewCount: '1000', privateMetric: extraSecret },
          status: { privacyStatus: 'public' }, unrelated: { access_token: extraSecret } }
      : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    const observation = output.candidate_observations[0]
    expect(observation).toMatchObject({ approved_video_id: seed.video_id,
      raw_response_evidence: { video_id: seed.video_id, channel_id: seed.channel_id, published_at: observedAt, duration: 'PT1M', privacy_status: 'public' },
      parsed_duration_seconds: 60, shorts_format_determination: 'duration_band_match', inclusion: 'excluded',
      field_decisions: { video_id: 'match', channel_id: 'match', published_at: 'mismatch', duration: 'mismatch', public_status: 'match', shorts_duration_band: 'match' },
      exclusion_fields: ['published_at', 'duration'] })
    const expectedBody = { items: [{ id: seed.video_id, snippet: { channelId: seed.channel_id, publishedAt: observedAt, title: extraSecret },
      contentDetails: { duration: 'PT1M' }, statistics: { viewCount: '1000', privateMetric: extraSecret },
      status: { privacyStatus: 'public' }, unrelated: { access_token: extraSecret } }] }
    expect(observation.response_body_sha256).toBe(createHash('sha256').update(JSON.stringify(expectedBody)).digest('hex'))
    expect(JSON.stringify(output)).not.toContain(extraSecret)
    expect(output.comparable_decisions[0].reason).toContain('publication timestamp')
    expect(output.persistence_enabled).toBe(false)
    expect(output.external_actions_enabled).toBe(false)
  })
  it('reports field exclusions for a private, wrong-channel, long video without leaking extra fields', async () => {
    const seed = cohort.included[0]
    const { input } = setup({}, { video: (id, value) => id === seed.video_id
      ? { ...value, snippet: { channelId: cohort.included[1].channel_id, publishedAt: seed.published_at },
          contentDetails: { duration: 'PT1H2M3S' }, status: { privacyStatus: 'private' } }
      : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.candidate_observations[0]).toMatchObject({ parsed_duration_seconds: 3723,
      shorts_format_determination: 'outside_duration_band',
      field_decisions: { channel_id: 'mismatch', duration: 'mismatch', public_status: 'mismatch', shorts_duration_band: 'mismatch' },
      exclusion_fields: ['channel_id', 'duration', 'public_status', 'shorts_duration_band'] })
  })
  it('redacts malformed provider fields and marks them unavailable', async () => {
    const seed = cohort.included[0]
    const secret = 'refresh-secret-malformed'
    const { input } = setup({}, { video: (id, value) => id === seed.video_id
      ? { ...value, snippet: { channelId: secret, publishedAt: secret }, contentDetails: { duration: secret }, status: { privacyStatus: secret } }
      : value })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.candidate_observations[0]).toMatchObject({ raw_response_evidence: { video_id: seed.video_id, channel_id: null, published_at: null, duration: null, privacy_status: null },
      parsed_duration_seconds: null, shorts_format_determination: 'unavailable',
      field_decisions: { channel_id: 'unavailable', published_at: 'unavailable', duration: 'unavailable', public_status: 'unavailable', shorts_duration_band: 'unavailable' } })
    expect(JSON.stringify(output)).not.toContain(secret)
  })
})
