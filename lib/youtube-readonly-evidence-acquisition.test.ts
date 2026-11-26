import { afterEach, describe, expect, it, vi } from 'vitest'
import cohort from '@/artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/cohort.json'
import { acquireYouTubeReadOnlyEvidence, YOUTUBE_EVIDENCE_CALENDAR_ID, YOUTUBE_EVIDENCE_COHORT_SHA256, YOUTUBE_EVIDENCE_CONTENT_ID, type YouTubeEvidenceRequest } from './youtube-readonly-evidence-acquisition'
import { rawResponseSha256 } from './attributable-performance-evidence'
import { YOUTUBE_READONLY_SCOPE } from './youtube-oauth'

const now = new Date('2026-11-26T12:00:00.000Z')
const request: YouTubeEvidenceRequest = { content_id: YOUTUBE_EVIDENCE_CONTENT_ID, calendar_item_id: YOUTUBE_EVIDENCE_CALENDAR_ID, cohort_sha256: YOUTUBE_EVIDENCE_COHORT_SHA256, expected_content_updated_at: '2026-11-25T12:00:00.000Z' }
const credentials = { access_token: 'stored-secret', refresh_token: 'refresh-secret', scope: YOUTUBE_READONLY_SCOPE, token_obtained_at: '2026-11-26T11:00:00.000Z', expires_in: 7200 }
function response(value: unknown, status = 200) { return { ok: status === 200, status, json: async () => value, text: async () => JSON.stringify(value) } as Response }
function setup(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url)
    calls.push({ url: target, init })
    if (target.includes('/token')) return response({ access_token: 'transient-secret', scope: YOUTUBE_READONLY_SCOPE })
    const parsed = new URL(target)
    if (parsed.pathname.endsWith('/videos')) {
      const seed = cohort.included.find((entry) => entry.video_id === parsed.searchParams.get('id'))!
      return response({ items: [{ id: seed.video_id, snippet: { channelId: seed.channel_id, publishedAt: seed.published_at }, contentDetails: { duration: `PT${seed.duration_seconds}S` }, statistics: { viewCount: '1000', likeCount: '20' }, status: { privacyStatus: 'public' } }] })
    }
    const seed = cohort.included.find((entry) => entry.channel_id === parsed.searchParams.get('id'))!
    return response({ items: [{ id: seed.channel_id, statistics: { subscriberCount: '500', hiddenSubscriberCount: false } }] })
  }) as unknown as typeof fetch
  return { input: { request, credentials, is_active: true, content_updated_at: request.expected_content_updated_at, calendar_bound: true, fetchImpl, now, ...overrides }, calls, fetchImpl }
}
afterEach(() => { vi.unstubAllEnvs() })

describe('YouTube read-only evidence acquisition', () => {
  it('reads only approved exact public Shorts identities; hashes current replies and keeps missing policy and rights unscored', async () => {
    const { input, calls } = setup()
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.status).toBe('acquired_unscored')
    expect(output.records).toHaveLength(8)
    expect(output.qualification_blockers).toEqual([expect.stringContaining('source-class freshness policy'), expect.stringContaining('privacy and rights')])
    expect(output.records[0]).toMatchObject({ video_id: cohort.included[0].video_id, views: 1000, likes: 20, comments: null, public_subscribers: 500, format: 'shorts' })
    expect(output.records[0].raw_response_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(output.records[0].video_body_sha256).toMatch(/^[a-f0-9]{64}$/)
    const { receipt_sha256, ...body } = output
    expect(receipt_sha256).toBe(rawResponseSha256(body))
    expect(JSON.stringify(output)).not.toMatch(/stored-secret|refresh-secret|transient-secret/)
    expect(calls).toHaveLength(16)
    expect(calls.every(({ url, init }) => init?.method === 'GET' && new URL(url).hostname === 'www.googleapis.com' && !url.includes('analytics'))).toBe(true)
  })
  it.each([
    ['inactive', { is_active: false }],
    ['missing credentials', { credentials: null }],
    ['missing scope', { credentials: { ...credentials, scope: 'https://www.googleapis.com/auth/youtube.upload' } }],
    ['wrong cohort', { request: { ...request, cohort_sha256: 'wrong' } }],
    ['wrong content', { request: { ...request, content_id: 'other' } }],
    ['wrong calendar', { calendar_bound: false }],
    ['stale content version', { content_updated_at: 'different' }],
  ])('fails before provider calls for %s', async (_label, overrides) => {
    const { input, calls } = setup(overrides)
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(0)
  })
  it('refreshes expired access token only in memory and never returns or writes it', async () => {
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id')
    vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret')
    const { input, calls } = setup({ credentials: { ...credentials, token_obtained_at: '2026-11-25T00:00:00.000Z' } })
    const output = await acquireYouTubeReadOnlyEvidence(input)
    expect(output.status).toBe('acquired_unscored')
    expect(calls[0].url).toBe('https://oauth2.googleapis.com/token')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls.slice(1).every((call) => (call.init?.headers as Record<string, string>).Authorization === 'Bearer transient-secret')).toBe(true)
    expect(JSON.stringify(output)).not.toMatch(/stored-secret|refresh-secret|transient-secret|client-secret/)
    expect(input.credentials).toEqual({ ...credentials, token_obtained_at: '2026-11-25T00:00:00.000Z' })
  })
  it('fails closed on refresh failure without retry or provider data requests', async () => {
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id'); vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret')
    const { input, calls } = setup({ credentials: { ...credentials, token_obtained_at: '2026-11-25T00:00:00.000Z' } })
    input.fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return response({ error: 'invalid_grant' }, 400) }) as unknown as typeof fetch
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(1)
  })
  it.each([
    ['quota', (_url: URL) => response({ error: 'quotaExceeded' }, 403)],
    ['missing views', (url: URL) => url.pathname.endsWith('/videos') ? response({ items: [{ id: cohort.included[0].video_id, snippet: { channelId: cohort.included[0].channel_id, publishedAt: cohort.included[0].published_at }, contentDetails: { duration: 'PT54S' }, statistics: {}, status: { privacyStatus: 'public' } }] }) : response({ items: [] })],
    ['wrong channel', (url: URL) => url.pathname.endsWith('/videos') ? response({ items: [{ id: cohort.included[0].video_id, snippet: { channelId: 'wrong', publishedAt: cohort.included[0].published_at }, contentDetails: { duration: 'PT54S' }, statistics: { viewCount: '100' }, status: { privacyStatus: 'public' } }] }) : response({ items: [] })],
    ['wrong format', (url: URL) => url.pathname.endsWith('/videos') ? response({ items: [{ id: cohort.included[0].video_id, snippet: { channelId: cohort.included[0].channel_id, publishedAt: cohort.included[0].published_at }, contentDetails: { duration: 'PT4M' }, statistics: { viewCount: '100' }, status: { privacyStatus: 'public' } }] }) : response({ items: [] })],
  ])('blocks %s after one provider response', async (_label, makeResponse) => {
    const { input, calls } = setup()
    input.fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return makeResponse(new URL(String(url))) }) as unknown as typeof fetch
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(1)
  })
  it('fails closed on hidden subscriber count', async () => {
    const { input, calls, fetchImpl } = setup()
    input.fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('/channels')) { calls.push({ url: String(url), init }); return response({ items: [{ id: cohort.included[0].channel_id, statistics: { hiddenSubscriberCount: true } }] }) }
      return fetchImpl(url, init)
    }) as unknown as typeof fetch
    expect((await acquireYouTubeReadOnlyEvidence(input)).status).toBe('blocked')
    expect(calls).toHaveLength(2)
  })
})
