import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  previewYouTubePublicationReconciliation: vi.fn(),
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/youtube-publication-reconciliation-preview', () => ({
  previewYouTubePublicationReconciliation: mocks.previewYouTubePublicationReconciliation,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}))

import { POST } from './route'

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/social-content/youtube/publication-preview', {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/youtube/publication-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.previewYouTubePublicationReconciliation.mockResolvedValue({
      ok: true,
      platform: 'youtube',
      provider: 'youtube_data_api',
      contentId: '11111111-1111-4111-8111-111111111111',
      videoId: 'abc123DEF45',
      blockers: [],
      conflicts: [],
    })
  })

  it('requires admin auth before building a preview', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({
      content_id: '11111111-1111-4111-8111-111111111111',
      youtube_video_id: 'abc123DEF45',
    }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.previewYouTubePublicationReconciliation).not.toHaveBeenCalled()
  })

  it('passes explicit selected content and candidate video inputs to the preview helper', async () => {
    const response = await POST(request({
      content_id: '11111111-1111-4111-8111-111111111111',
      youtube_video_url: 'https://www.youtube.com/watch?v=abc123DEF45',
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      platform: 'youtube',
      contentId: '11111111-1111-4111-8111-111111111111',
      videoId: 'abc123DEF45',
    })
    expect(mocks.previewYouTubePublicationReconciliation).toHaveBeenCalledWith({
      db: mocks.supabaseAdmin,
      contentId: '11111111-1111-4111-8111-111111111111',
      videoId: null,
      videoUrl: 'https://www.youtube.com/watch?v=abc123DEF45',
    })
  })

  it('returns a sanitized generic error when preview construction throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.previewYouTubePublicationReconciliation.mockRejectedValue(new Error('database secret raw exception'))

    const response = await POST(request({
      content_id: '11111111-1111-4111-8111-111111111111',
      youtube_video_id: 'abc123DEF45',
    }) as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'YouTube publication preview failed' })
    expect(consoleSpy).toHaveBeenCalledWith('[youtube-publication-preview] failed')
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('database secret raw exception')
    consoleSpy.mockRestore()
  })
})
