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
    const { update } = installSupabase({
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
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'publishing',
      error_message: null,
    }))
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

  it('fails closed when TikTok is active but the access token is missing', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: {},
      settings: {
        creator_info_confirmed: true,
        source_url_approved: true,
      },
    })

    const result = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('missing access token')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: expect.stringContaining('missing access token'),
    }))
  })

  it('fails closed when TikTok remains inactive after reconnect', async () => {
    const { update } = installSupabase({
      is_active: false,
      credentials: {
        access_token: 'token',
      },
      settings: {
        creator_info_confirmed: true,
        source_url_approved: true,
      },
    })

    const result = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(result).toMatchObject({
      success: false,
      error: 'TikTok is not connected or inactive',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'TikTok is not connected or inactive',
    }))
  })

  it('fails closed when the payload has no video URL', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: { access_token: 'token' },
      settings: {
        creator_info_confirmed: true,
        source_url_approved: true,
      },
    })

    const result = await publishToTikTok({
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

  it('allows PULL_FROM_URL only for approved media domains when source_url_approved is unset', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: { access_token: 'token' },
      settings: {
        creator_info_confirmed: true,
        approved_media_domains: ['assets.amadutown.com'],
      },
    })

    const rejected = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(rejected.success).toBe(false)
    expect(rejected.error).toContain('media URL domain is not approved')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: expect.stringContaining('media URL domain is not approved'),
    }))

    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      data: { publish_id: 'publish-2' },
    }), { status: 200 }))

    const allowed = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.assets.amadutown.com/video.mp4',
    })

    expect(allowed.success).toBe(true)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('fails closed when TikTok returns an error or omits publish_id', async () => {
    installSupabase({
      is_active: true,
      credentials: { access_token: 'token' },
      settings: {
        creator_info_confirmed: true,
        source_url_approved: true,
      },
    })

    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: 'creator_info invalid' },
    }), { status: 400 }))

    const apiError = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(apiError).toMatchObject({
      success: false,
      error: 'creator_info invalid',
    })

    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))

    const missingId = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(missingId).toMatchObject({
      success: false,
      error: 'TikTok publish response missing publish_id',
    })
  })

  it('fails closed when the TikTok request throws', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: { access_token: 'token' },
      settings: {
        creator_info_confirmed: true,
        source_url_approved: true,
      },
    })
    mocks.fetch.mockRejectedValueOnce(new Error('socket hang up'))

    const result = await publishToTikTok({
      contentId: 'content-1',
      postText: 'Post text',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })

    expect(result).toMatchObject({
      success: false,
      error: 'socket hang up',
    })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'socket hang up',
    }))
  })
})
