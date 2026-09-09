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
import { releaseStore, releaseFixture } from '@/lib/social-release-safety.test-fixtures'
import { socialReleaseFingerprint } from '@/lib/social-release-evidence'

const futureToken = {
  access_token: 'linkedin-token',
  expires_in: 60 * 24 * 60 * 60,
  token_obtained_at: '2999-01-01T00:00:00.000Z',
  person_urn: 'urn:li:person:member-1',
}

let activeStore: ReturnType<typeof releaseStore>
function installSupabase(payload: Record<string, unknown> = {}) {
  const item: Record<string, any> = { ...releaseFixture(), post_text: payload.postText ?? 'Post text', cta_text: payload.ctaText,
    cta_url: payload.ctaUrl, hashtags: payload.hashtags, image_url: payload.imageUrl, carousel_slide_urls: payload.carouselSlideUrls }
  item.rag_context.platform_submission_gate = { status: 'submitting', release_id: 'release-1', release_platforms: ['linkedin'],
    approved_fingerprint: socialReleaseFingerprint(item) }
  const store = releaseStore(item)
  activeStore = store
  store.tables.social_content_config[0] = { platform: 'linkedin', is_active: true, credentials: futureToken,
    settings: { author_urn: 'urn:li:person:member-1', post_visibility: 'PUBLIC' } }
  const publishUpdate = vi.fn()
  mocks.from.mockImplementation((table: string) => {
    const q = store.admin.from(table), update = q.update
    q.update = (patch: Record<string, unknown>) => { publishUpdate(patch); return update(patch) }
    return q
  })
  return { publishUpdate, store }
}

async function approvedPublish(payload: Parameters<typeof publishToLinkedIn>[0]) {
  Object.assign(activeStore.item(), { post_text: payload.postText, cta_text: payload.ctaText, cta_url: payload.ctaUrl,
    hashtags: payload.hashtags, image_url: payload.imageUrl, carousel_slide_urls: payload.carouselSlideUrls })
  activeStore.item().rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint(activeStore.item())
  return publishToLinkedIn({ ...payload, releaseClaimId: 'release-1' })
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
    const { publishUpdate } = installSupabase()

    const result = await approvedPublish({
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
    expect(publishUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      status: 'publishing',
      error_message: null,
    }))
    expect(publishUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      status: 'published',
      error_message: null,
      platform_post_id: 'urn:li:share:post-123',
    }))
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

    const result = await approvedPublish({
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


describe('LinkedIn dispatch and uncertainty fences', () => {
  beforeEach(() => { vi.clearAllMocks(); installSupabase(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('rejects direct calls without a queue claim before reading credentials or network', async () => {
    vi.stubGlobal('fetch', vi.fn())
    expect((await publishToLinkedIn({ contentId: 'social-1', postText: 'Post text' })).success).toBe(false)
    expect(mocks.from).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('allows one of two adapter calls with the same valid queue claim', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'remote-1' })))
    const results = await Promise.all([approvedPublish({ contentId: 'social-1', postText: 'Post text' }), approvedPublish({ contentId: 'social-1', postText: 'Post text' })])
    expect(results.filter(r => r.success)).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each(['network', 'empty', 'missing-id', 'http-error'])('keeps %s remote outcome non-retryable', async mode => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (mode === 'network') throw new Error('timeout')
      if (mode === 'empty') return new Response(null, { status: 201 })
      if (mode === 'http-error') return new Response(null, { status: 500 })
      return jsonResponse({})
    }))
    const result = await approvedPublish({ contentId: 'social-1', postText: 'Post text' })
    expect(result.reconciliationRequired).toBe(true)
    expect(activeStore.publish().status).toBe('publishing')
    await approvedPublish({ contentId: 'social-1', postText: 'Post text' }); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('never retries a successful remote post after local publish persistence fails', async () => {
    activeStore.controls.fail = (_table, patch) => patch.status === 'published'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'remote-1' })))
    expect((await approvedPublish({ contentId: 'social-1', postText: 'Post text' })).reconciliationRequired).toBe(true)
    expect(activeStore.publish().status).toBe('publishing')
    await approvedPublish({ contentId: 'social-1', postText: 'Post text' }); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each(['disabled', 'missing'])('blocks %s credentials without network', async mode => {
    if (mode === 'disabled') activeStore.tables.social_content_config[0].is_active = false
    else activeStore.tables.social_content_config = []
    vi.stubGlobal('fetch', vi.fn())
    expect((await approvedPublish({ contentId: 'social-1', postText: 'Post text' })).success).toBe(false)
    expect(fetch).not.toHaveBeenCalled(); expect(activeStore.publish().status).toBe('pending')
  })
  it('rejects a payload changed after queue approval', async () => {
    vi.stubGlobal('fetch', vi.fn())
    expect((await publishToLinkedIn({ contentId: 'social-1', postText: 'unapproved', releaseClaimId: 'release-1' })).success).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
