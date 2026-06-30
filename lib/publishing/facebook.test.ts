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

import { publishToFacebook } from './facebook'

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

describe('publishToFacebook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = mocks.fetch
  })

  it('publishes a Facebook Page feed post when no media exists', async () => {
    installSupabase({
      is_active: true,
      credentials: {
        page_access_token: 'page-token',
        page_id: 'page-1',
      },
      settings: {
        graph_api_version: 'v20.0',
      },
    })

    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'page-1_post-1',
    }), { status: 200 }))

    const result = await publishToFacebook({
      contentId: 'content-1',
      postText: 'Post text',
      ctaUrl: 'https://example.com',
      hashtags: ['AI'],
    })

    expect(result).toMatchObject({
      success: true,
      status: 'published',
      platformPostId: 'page-1_post-1',
      platformPostUrl: 'https://www.facebook.com/page-1/posts/page-1_post-1',
    })
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/page-1/feed',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('fails closed when Page credentials are missing', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: {
        page_access_token: 'page-token',
      },
      settings: {},
    })

    const result = await publishToFacebook({
      contentId: 'content-1',
      postText: 'Post text',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Page access token or Page ID')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: expect.stringContaining('Page access token or Page ID'),
    }))
  })
})
