import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { publishToYouTube } from './youtube'

function installSupabase(configData: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: configData, error: null })
  const selectEq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const secondEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  const update = vi.fn(() => ({ eq: firstEq }))

  mocks.from.mockImplementation((table: string) => (
    table === 'social_content_config'
      ? { select, update }
      : { update }
  ))

  return { update }
}

describe('publishToYouTube', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = mocks.fetch
  })

  it('uploads a final video asset to YouTube with private default privacy', async () => {
    installSupabase({
      is_active: true,
      credentials: {
        access_token: 'token',
      },
      settings: {
        default_privacy: 'private',
        max_download_bytes: 1024,
      },
    })

    mocks.fetch
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'video/mp4', 'content-length': '3' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'youtube-video-1' }), { status: 200 }))

    const result = await publishToYouTube({
      contentId: 'content-1',
      postText: 'Post text',
      youtubeTitle: 'Video title',
      youtubeDescription: 'Video description',
      hashtags: ['AI'],
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(result).toMatchObject({
      success: true,
      status: 'published',
      platformPostId: 'youtube-video-1',
      platformPostUrl: 'https://www.youtube.com/watch?v=youtube-video-1',
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls[1][0]).toContain('https://www.googleapis.com/upload/youtube/v3/videos')
    expect(mocks.fetch.mock.calls[1][1]).toEqual(expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }))
  })

  it('fails closed when no final video URL exists', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: {
        access_token: 'token',
      },
      settings: {},
    })

    const result = await publishToYouTube({
      contentId: 'content-1',
      postText: 'Post text',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('final video URL')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: expect.stringContaining('final video URL'),
    }))
  })
})
