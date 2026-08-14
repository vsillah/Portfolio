import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  refreshPublishedSocialEngagement: vi.fn(),
  refreshPublishedYouTubeComments: vi.fn(),
  refreshPublishedMetaComments: vi.fn(),
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-engagement-refresh', () => ({
  refreshPublishedSocialEngagement: mocks.refreshPublishedSocialEngagement,
}))

vi.mock('@/lib/youtube-comment-ingestion', () => ({
  refreshPublishedYouTubeComments: mocks.refreshPublishedYouTubeComments,
}))

vi.mock('@/lib/meta-comment-ingestion', () => ({
  refreshPublishedMetaComments: mocks.refreshPublishedMetaComments,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}))

import { POST } from './route'

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/social-content/engagement/refresh', {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/engagement/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.refreshPublishedSocialEngagement.mockResolvedValue({
      refreshed: 1,
      skipped: 0,
      errors: [],
      insights: [{ contentId: 'content-1', theme: 'Agentic operating system', score: 88 }],
    })
    mocks.refreshPublishedYouTubeComments.mockResolvedValue({
      platform: 'youtube',
      provider: 'youtube_data_api',
      status: 'succeeded',
      publishId: 'publish-youtube-1',
      contentId: 'content-youtube-1',
      videoId: 'abc123DEF45',
      runId: 'run-youtube-1',
      fetched: 2,
      upserted: 2,
      skipped: 0,
      errors: [],
      cursor: { threadPages: 1 },
    })
    mocks.refreshPublishedMetaComments.mockResolvedValue({
      platform: 'instagram',
      provider: 'meta_graph',
      status: 'manual_blocked',
      publishId: 'publish-instagram-1',
      contentId: 'content-instagram-1',
      objectId: '17900000000000000',
      runId: 'run-meta-1',
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [{ code: 'meta_comment_ingestion_capability_blocked' }],
      cursor: {},
      blockedReason: 'Canonical Meta comment ingestion capability is not verified or enabled; complete a read-only Meta scope smoke before refreshing comments.',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.refreshPublishedSocialEngagement).not.toHaveBeenCalled()
    expect(mocks.refreshPublishedYouTubeComments).not.toHaveBeenCalled()
    expect(mocks.refreshPublishedMetaComments).not.toHaveBeenCalled()
  })

  it('refreshes LinkedIn engagement through the guarded service', async () => {
    const response = await POST(request({
      platform: 'linkedin',
      content_id: 'content-1',
      limit: 5,
      force: true,
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      platform: 'linkedin',
      content_id: 'content-1',
      refreshed: 1,
      insights: [{ contentId: 'content-1', theme: 'Agentic operating system', score: 88 }],
    })
    expect(mocks.refreshPublishedSocialEngagement).toHaveBeenCalledWith({
      db: mocks.supabaseAdmin,
      platform: 'linkedin',
      contentId: 'content-1',
      limit: 5,
      force: true,
    })
  })

  it('refreshes YouTube comments through the read-only adapter only when explicitly requested', async () => {
    const response = await POST(request({
      platform: 'youtube',
      publish_id: 'publish-youtube-1',
      limit: 10,
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      platform: 'youtube',
      content_id: 'content-youtube-1',
      publish_id: 'publish-youtube-1',
      fetched: 2,
      upserted: 2,
    })
    expect(mocks.refreshPublishedYouTubeComments).toHaveBeenCalledWith({
      db: mocks.supabaseAdmin,
      publishId: 'publish-youtube-1',
      contentId: null,
      limit: 10,
    })
    expect(mocks.refreshPublishedSocialEngagement).not.toHaveBeenCalled()
  })

  it('returns a blocked YouTube recovery outcome without falling back to channel-wide refresh', async () => {
    mocks.refreshPublishedYouTubeComments.mockResolvedValue({
      platform: 'youtube',
      provider: 'youtube_data_api',
      status: 'manual_blocked',
      publishId: null,
      contentId: 'draft-youtube-1',
      videoId: null,
      runId: 'run-blocked-1',
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [{ code: 'no_eligible_published_youtube_row' }],
      cursor: {},
      blockedReason: 'No eligible published YouTube row with a canonical provider video ID was selected; reconcile publication first.',
    })

    const response = await POST(request({
      platform: 'youtube',
      content_id: 'draft-youtube-1',
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: false,
      platform: 'youtube',
      content_id: 'draft-youtube-1',
      status: 'manual_blocked',
      blockedReason: 'No eligible published YouTube row with a canonical provider video ID was selected; reconcile publication first.',
    })
    expect(mocks.refreshPublishedYouTubeComments).toHaveBeenCalledWith({
      db: mocks.supabaseAdmin,
      publishId: null,
      contentId: 'draft-youtube-1',
      limit: 20,
    })
  })

  it('refreshes Meta comments through the read-only adapter only when explicitly requested', async () => {
    const response = await POST(request({
      platform: 'instagram',
      publish_id: 'publish-instagram-1',
      limit: 7,
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: false,
      platform: 'instagram',
      content_id: 'content-instagram-1',
      publish_id: 'publish-instagram-1',
      status: 'manual_blocked',
      blockedReason: 'Canonical Meta comment ingestion capability is not verified or enabled; complete a read-only Meta scope smoke before refreshing comments.',
    })
    expect(mocks.refreshPublishedMetaComments).toHaveBeenCalledWith({
      db: mocks.supabaseAdmin,
      platform: 'instagram',
      publishId: 'publish-instagram-1',
      contentId: null,
      limit: 7,
    })
    expect(mocks.refreshPublishedSocialEngagement).not.toHaveBeenCalled()
    expect(mocks.refreshPublishedYouTubeComments).not.toHaveBeenCalled()
  })

  it('defaults unsupported platform input to LinkedIn for V1', async () => {
    const response = await POST(request({ platform: 'tiktok' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.platform).toBe('linkedin')
    expect(mocks.refreshPublishedSocialEngagement).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'linkedin',
      contentId: null,
      limit: 20,
      force: false,
    }))
    expect(mocks.refreshPublishedYouTubeComments).not.toHaveBeenCalled()
    expect(mocks.refreshPublishedMetaComments).not.toHaveBeenCalled()
  })

  it('returns service unavailable when Apify credentials are missing', async () => {
    mocks.refreshPublishedSocialEngagement.mockRejectedValue(new Error('APIFY_API_TOKEN is not configured'))

    const response = await POST(request() as never)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'APIFY_API_TOKEN is not configured' })
  })
})
