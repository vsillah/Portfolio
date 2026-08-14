import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { buildXPostSequence, publishToX } from './x'

function installSupabase(configData: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: configData, error: null })
  const selectEq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const secondEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  const publishUpdate = vi.fn(() => ({ eq: firstEq }))
  const configUpdateMaybeSingle = vi.fn().mockResolvedValue({ data: { credentials: configData.credentials }, error: null })
  const configUpdateSelect = vi.fn(() => ({ maybeSingle: configUpdateMaybeSingle }))
  const configUpdateEq = vi.fn(() => ({ eq: configUpdateEq, is: configUpdateIs, select: configUpdateSelect }))
  const configUpdateIs = vi.fn(() => ({ eq: configUpdateEq, is: configUpdateIs, select: configUpdateSelect }))
  const configUpdate = vi.fn(() => ({ eq: configUpdateEq, is: configUpdateIs }))

  mocks.from.mockImplementation((table: string) => (
    table === 'social_content_config'
      ? { select, update: configUpdate }
      : { update: publishUpdate }
  ))

  return { update: publishUpdate, configUpdate }
}

describe('buildXPostSequence', () => {
  it('uses approved thread posts from rag_context before fallback copy assembly', () => {
    expect(buildXPostSequence({
      contentId: 'content-1',
      postText: 'Fallback',
      ragContext: {
        x_thread_posts: [
          ' First post. ',
          'Second post.\n',
        ],
      },
    })).toEqual(['First post.', 'Second post.'])
  })
})

describe('publishToX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = mocks.fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('publishes a reviewed thread in sequence through the X create-post endpoint', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: { access_token: 'x-user-token' },
      settings: { profile_handle: 'amadutown', thread_reply_enabled: true },
    })
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'post-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'post-2' } }), { status: 201 }))

    const result = await publishToX({
      contentId: 'content-1',
      postText: 'Fallback',
      ragContext: {
        x_thread_posts: ['First post.', 'Second post.'],
      },
    })

    expect(result).toEqual({
      success: true,
      platformPostId: 'post-1',
      platformPostUrl: 'https://x.com/amadutown/status/post-1',
      threadPostIds: ['post-1', 'post-2'],
      threadPostUrls: [
        'https://x.com/amadutown/status/post-1',
        'https://x.com/amadutown/status/post-2',
      ],
    })
    expect(mocks.fetch).toHaveBeenNthCalledWith(1, 'https://api.x.com/2/tweets', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer x-user-token' }),
      body: JSON.stringify({ text: 'First post.' }),
    }))
    expect(mocks.fetch).toHaveBeenNthCalledWith(2, 'https://api.x.com/2/tweets', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        text: 'Second post.',
        reply: { in_reply_to_tweet_id: 'post-1' },
      }),
    }))
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      status: 'publishing',
      error_message: null,
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'published',
      error_message: null,
      platform_post_id: 'post-1',
      platform_post_url: 'https://x.com/amadutown/status/post-1',
    }))
  })

  it('fails closed before posting when an X post exceeds the configured character limit', async () => {
    const { update } = installSupabase({
      is_active: true,
      credentials: { access_token: 'x-user-token' },
      settings: { profile_handle: 'amadutown', max_post_length: 10 },
    })

    const result = await publishToX({
      contentId: 'content-1',
      postText: 'Fallback',
      ragContext: {
        x_thread_posts: ['This is too long.'],
      },
    })

    expect(result).toEqual({
      success: false,
      error: 'X post 1 is 17 characters; maximum is 10.',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'X post 1 is 17 characters; maximum is 10.',
    }))
  })

  it('reports partial thread failure without hiding already-created post ids', async () => {
    installSupabase({
      is_active: true,
      credentials: { access_token: 'x-user-token' },
      settings: { profile_handle: 'amadutown', thread_reply_enabled: true },
    })
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'post-1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Reply blocked' }), { status: 403 }))

    const result = await publishToX({
      contentId: 'content-1',
      postText: 'Fallback',
      ragContext: {
        x_thread_posts: ['First post.', 'Second post.'],
      },
    })

    expect(result).toEqual({
      success: false,
      error: 'Reply blocked (1 X post(s) were already created before this failure.)',
      threadPostIds: ['post-1'],
      threadPostUrls: ['https://x.com/amadutown/status/post-1'],
    })
  })

  it('refreshes a stale X token through the shared governed helper before publishing', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-id')
    vi.stubEnv('X_CLIENT_SECRET', 'client-secret')
    const { update, configUpdate } = installSupabase({
      is_active: true,
      credentials: {
        access_token: 'stale-access-token',
        refresh_token: 'old-refresh-token',
        expires_in: 60,
        token_obtained_at: '2026-08-12T10:00:00.000Z',
      },
      settings: { profile_handle: 'amadutown', thread_reply_enabled: true },
    })
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'fresh-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: 7200,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'post-1' } }), { status: 201 }))

    const result = await publishToX({
      contentId: 'content-1',
      postText: 'Fresh token post',
    })

    expect(result).toMatchObject({
      success: true,
      platformPostId: 'post-1',
    })
    expect(configUpdate).toHaveBeenCalledWith({
      credentials: expect.objectContaining({
        access_token: 'fresh-access-token',
        refresh_token: 'rotated-refresh-token',
      }),
    })
    expect(mocks.fetch).toHaveBeenNthCalledWith(2, 'https://api.x.com/2/tweets', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer fresh-access-token' }),
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }))
  })
})
