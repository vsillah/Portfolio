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

import { publishToTikTok } from './tiktok'

function installSupabase(configData: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: configData, error: null })
  const selectEq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const secondEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  const update = vi.fn(() => ({ eq: firstEq }))

  mocks.from.mockImplementation((table: string) => (
    table === 'social_content_config'
      ? { select }
      : { update }
  ))

  return { update }
}

describe('publishToTikTok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = mocks.fetch
  })

  it('submits a Direct Post request when creator and media URL gates are configured', async () => {
    installSupabase({
      is_active: true,
      credentials: {
        access_token: 'token',
      },
      settings: {
        creator_info_confirmed: true,
        source_url_approved: true,
        privacy_level: 'SELF_ONLY',
      },
    })

    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      data: { publish_id: 'publish-1' },
    }), { status: 200 }))

    const result = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      hashtags: ['AI'],
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(result).toMatchObject({
      success: true,
      status: 'publishing',
      platformPostId: 'publish-1',
    })
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    )
  })

  it('fails closed until creator-info review is confirmed', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: {
        access_token: 'token',
      },
      settings: {
        source_url_approved: true,
      },
    })

    const result = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('creator info')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: expect.stringContaining('creator info'),
    }))
  })
})
