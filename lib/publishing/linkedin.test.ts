import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { publishToLinkedIn } from './linkedin'

const futureToken = {
  access_token: 'linkedin-token',
  expires_in: 60 * 24 * 60 * 60,
  token_obtained_at: '2999-01-01T00:00:00.000Z',
  person_urn: 'urn:li:person:member-1',
}

function installSupabase() {
  const configSingle = vi.fn().mockResolvedValue({
    data: {
      is_active: true,
      credentials: futureToken,
      settings: {
        author_urn: 'urn:li:person:member-1',
        post_visibility: 'PUBLIC',
      },
    },
    error: null,
  })
  const configEq = vi.fn(() => ({ single: configSingle }))
  const configSelect = vi.fn(() => ({ eq: configEq }))

  const publishSecondEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const publishFirstEq = vi.fn(() => ({ eq: publishSecondEq }))
  const publishUpdate = vi.fn(() => ({ eq: publishFirstEq }))

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_config') {
      return { select: configSelect }
    }
    if (table === 'social_content_publishes') {
      return { update: publishUpdate }
    }
    return {}
  })

  return { publishUpdate }
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

describe('publishToLinkedIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    installSupabase()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('publishes approved carousel slides as a LinkedIn REST multi-image post', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://api.linkedin.com/rest/images?action=initializeUpload') {
        const callNumber = fetchMock.mock.calls.filter(([calledUrl]) => (
          String(calledUrl) === 'https://api.linkedin.com/rest/images?action=initializeUpload'
        )).length
        return jsonResponse({
          value: {
            uploadUrl: `https://upload.linkedin.example/slide-${callNumber}`,
            image: `urn:li:image:slide-${callNumber}`,
          },
        })
      }

      if (url.startsWith('https://amadutown.com/slide-')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      }

      if (url.startsWith('https://upload.linkedin.example/slide-')) {
        expect(init?.method).toBe('PUT')
        return new Response(null, { status: 201 })
      }

      if (url === 'https://api.linkedin.com/rest/posts') {
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer linkedin-token',
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        })
        expect(init?.body).toEqual(JSON.stringify({
          author: 'urn:li:person:member-1',
          commentary: 'Post text\nhttps://amadutown.com/agentified\n\n#AI #Product',
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
          content: {
            multiImage: {
              images: [
                { id: 'urn:li:image:slide-1' },
                { id: 'urn:li:image:slide-2' },
                { id: 'urn:li:image:slide-3' },
              ],
            },
          },
        }))
        return new Response(null, {
          status: 201,
          headers: { 'x-restli-id': 'urn:li:share:post-123' },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishToLinkedIn({
      contentId: 'social-1',
      postText: 'Post text',
      ctaUrl: 'https://amadutown.com/agentified',
      hashtags: ['AI', 'Product'],
      imageUrl: 'https://amadutown.com/fallback.png',
      carouselSlideUrls: [
        'https://amadutown.com/slide-1.png',
        'https://amadutown.com/slide-2.png',
        'https://amadutown.com/slide-3.png',
      ],
    })

    expect(result).toEqual({
      success: true,
      platformPostId: 'urn:li:share:post-123',
      platformPostUrl: 'https://www.linkedin.com/feed/update/urn:li:share:post-123/',
    })
    expect(fetchMock).not.toHaveBeenCalledWith('https://amadutown.com/fallback.png', expect.anything())
    expect(fetchMock).toHaveBeenCalledTimes(10)
  })

  it('fails closed when a multi-image slide cannot be uploaded', async () => {
    const { publishUpdate } = installSupabase()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === 'https://api.linkedin.com/rest/images?action=initializeUpload') {
        return jsonResponse({
          value: {
            uploadUrl: 'https://upload.linkedin.example/slide-1',
            image: 'urn:li:image:slide-1',
          },
        })
      }

      if (url === 'https://amadutown.com/slide-1.png') {
        return new Response(null, { status: 404 })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishToLinkedIn({
      contentId: 'social-1',
      postText: 'Post text',
      carouselSlideUrls: [
        'https://amadutown.com/slide-1.png',
        'https://amadutown.com/slide-2.png',
      ],
    })

    expect(result).toEqual({
      success: false,
      error: 'LinkedIn multi-image upload failed on slide 1',
    })
    expect(fetchMock).not.toHaveBeenCalledWith('https://api.linkedin.com/rest/posts', expect.anything())
    expect(publishUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'LinkedIn multi-image upload failed on slide 1',
    }))
  })
})
