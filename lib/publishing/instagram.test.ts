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

import { publishToInstagram } from './instagram'

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

describe('publishToInstagram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = mocks.fetch
  })

  it('publishes an image post through the configured Instagram Graph account', async () => {
    installSupabase({
      is_active: true,
      credentials: {
        access_token: 'token',
        ig_user_id: 'ig-1',
      },
      settings: {
        graph_api_version: 'v20.0',
      },
    })

    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'creation-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media-1' }), { status: 200 }))

    const result = await publishToInstagram({
      contentId: 'content-1',
      postText: 'Post text',
      hashtags: ['AI'],
      imageUrl: 'https://cdn.example.com/image.png',
    })

    expect(result).toMatchObject({
      success: true,
      status: 'published',
      platformPostId: 'media-1',
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.fetch.mock.calls[0][0]).toBe('https://graph.facebook.com/v20.0/ig-1/media')
    expect(mocks.fetch.mock.calls[1][0]).toBe('https://graph.facebook.com/v20.0/ig-1/media_publish')
  })

  it('fails closed when no media is ready for Instagram', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: {
        access_token: 'token',
        ig_user_id: 'ig-1',
      },
      settings: {},
    })

    const result = await publishToInstagram({
      contentId: 'content-1',
      postText: 'Text-only post',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('requires an image')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: expect.stringContaining('requires an image'),
    }))
  })
})
