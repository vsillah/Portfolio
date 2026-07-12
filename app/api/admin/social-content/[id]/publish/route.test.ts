import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  publishToLinkedIn: vi.fn(),
  publishToYouTube: vi.fn(),
  publishToInstagram: vi.fn(),
  publishToFacebook: vi.fn(),
  publishToTikTok: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/publishing/linkedin', () => ({
  publishToLinkedIn: mocks.publishToLinkedIn,
}))

vi.mock('@/lib/publishing/youtube', () => ({
  publishToYouTube: mocks.publishToYouTube,
}))

vi.mock('@/lib/publishing/instagram', () => ({
  publishToInstagram: mocks.publishToInstagram,
}))

vi.mock('@/lib/publishing/facebook', () => ({
  publishToFacebook: mocks.publishToFacebook,
}))

vi.mock('@/lib/publishing/tiktok', () => ({
  publishToTikTok: mocks.publishToTikTok,
}))

import { POST } from './route'

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/[id]/publish redaction gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'approved',
        rag_context: {
          production_assets: {
            version: 'social_production_assets_v2',
            video_redaction_manifest: {
              items: [{
                id: 'item-1',
                status: 'pending',
                reviewer_decision: null,
                issue_type: 'email',
                source: 'chronicle',
                original_asset: { label: 'Chronicle', url_or_path: null },
                redacted_asset: null,
                timestamp_ranges: [],
                bounding_boxes: [],
                proposed_action: 'auto_blur',
                confidence: 0.98,
                evidence: 'email@example.com',
              }],
            },
          },
        },
      },
      error: null,
    })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ select: mocks.select })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks publishing while video redaction items are unresolved', async () => {
    const response = await POST(request({ platforms: ['linkedin'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Video privacy review required: 1 redaction item unresolved.',
      unresolved_redaction_items: 1,
    })
    expect(mocks.publishToLinkedIn).not.toHaveBeenCalled()
  })
})

function installPublishRouteSupabase({
  item,
  publishes,
  configs,
}: {
  item: Record<string, unknown>
  publishes: Array<Record<string, unknown>>
  configs?: Array<Record<string, unknown>>
}) {
  const queueSingle = vi.fn().mockResolvedValue({ data: item, error: null })
  const queueSelectEq = vi.fn(() => ({ single: queueSingle }))
  const queueSelect = vi.fn(() => ({ eq: queueSelectEq }))
  const queueUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const queueUpdate = vi.fn(() => ({ eq: queueUpdateEq }))

  const publishSelectEq = vi.fn().mockResolvedValue({ data: publishes, error: null })
  const publishSelect = vi.fn(() => ({ eq: publishSelectEq }))
  const publishUpdateSecondEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const publishUpdateFirstEq = vi.fn(() => ({ eq: publishUpdateSecondEq }))
  const publishUpdate = vi.fn(() => ({ eq: publishUpdateFirstEq }))
  const configSelect = vi.fn().mockResolvedValue({ data: configs ?? platformConfigsFor(publishes), error: null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') return { select: queueSelect, update: queueUpdate }
    if (table === 'social_content_publishes') return { select: publishSelect, update: publishUpdate }
    if (table === 'social_content_config') return { select: configSelect }
    return {}
  })

  return { queueUpdate }
}

function platformConfigsFor(publishes: Array<Record<string, unknown>>) {
  return publishes.map((publish) => {
    const platform = publish.platform
    if (platform === 'linkedin') {
      return {
        platform,
        is_active: true,
        credentials: { access_token: 'token', author_urn: 'urn:li:person:123' },
        settings: {},
      }
    }
    if (platform === 'youtube') {
      return { platform, is_active: true, credentials: { access_token: 'token' }, settings: {} }
    }
    if (platform === 'instagram') {
      return {
        platform,
        is_active: true,
        credentials: { access_token: 'token', ig_user_id: 'ig-user-1' },
        settings: {},
      }
    }
    if (platform === 'facebook') {
      return {
        platform,
        is_active: true,
        credentials: { page_access_token: 'token', page_id: 'page-1' },
        settings: {},
      }
    }
    if (platform === 'tiktok') {
      return {
        platform,
        is_active: true,
        credentials: { access_token: 'token' },
        settings: { creator_info_confirmed: true, source_url_approved: true },
      }
    }
    return { platform, is_active: false, credentials: {}, settings: {} }
  })
}

function approvedGate(platforms: string[]) {
  return {
    platform_submission_gate: {
      status: 'approved',
      approved_at: '2026-07-01T00:00:00.000Z',
      approved_by: 'admin-1',
      platforms,
    },
  }
}

describe('POST /api/admin/social-content/[id]/publish platform dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks direct publish calls until the final platform-submission gate is approved', async () => {
    installPublishRouteSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Post text',
        cta_text: null,
        cta_url: null,
        hashtags: [],
        image_url: 'https://cdn.example.com/image.png',
        video_url: null,
        carousel_slide_urls: null,
        rag_context: null,
      },
      publishes: [
        { platform: 'linkedin', status: 'pending' },
      ],
    })

    const response = await POST(request({ platforms: ['linkedin'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Platform submission requires final approval and connected platform configuration.')
    expect(mocks.publishToLinkedIn).not.toHaveBeenCalled()
  })

  it('dispatches Instagram and TikTok publish modules from approved content', async () => {
    const { queueUpdate } = installPublishRouteSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Post text',
        cta_text: 'CTA',
        cta_url: 'https://example.com',
        hashtags: ['AI'],
        image_url: 'https://cdn.example.com/image.png',
        video_url: 'https://cdn.example.com/video.mp4',
        carousel_slide_urls: null,
        rag_context: approvedGate(['instagram', 'tiktok']),
      },
      publishes: [
        { platform: 'instagram', status: 'pending' },
        { platform: 'tiktok', status: 'pending' },
      ],
    })
    mocks.publishToInstagram.mockResolvedValue({
      success: true,
      status: 'published',
      platformPostId: 'ig-post-1',
    })
    mocks.publishToTikTok.mockResolvedValue({
      success: true,
      status: 'publishing',
      platformPostId: 'tt-publish-1',
    })

    const response = await POST(request({ platforms: ['instagram', 'tiktok'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.published).toBe(true)
    expect(mocks.publishToInstagram).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'social-1',
      imageUrl: 'https://cdn.example.com/image.png',
      videoUrl: 'https://cdn.example.com/video.mp4',
    }))
    expect(mocks.publishToTikTok).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'social-1',
      videoUrl: 'https://cdn.example.com/video.mp4',
    }))
    expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'published',
    }))
  })

  it('dispatches YouTube publishing with final video metadata', async () => {
    const { queueUpdate } = installPublishRouteSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Post text',
        cta_text: 'CTA',
        cta_url: 'https://example.com',
        hashtags: ['AI'],
        image_url: null,
        video_url: 'https://cdn.example.com/video.mp4',
        youtube_title: 'YouTube title',
        youtube_description: 'YouTube description',
        carousel_slide_urls: null,
        rag_context: approvedGate(['youtube']),
      },
      publishes: [
        { platform: 'youtube', status: 'pending' },
      ],
    })
    mocks.publishToYouTube.mockResolvedValue({
      success: true,
      status: 'published',
      platformPostId: 'youtube-video-1',
      platformPostUrl: 'https://www.youtube.com/watch?v=youtube-video-1',
    })

    const response = await POST(request({ platforms: ['youtube'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.published).toBe(true)
    expect(mocks.publishToYouTube).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'social-1',
      videoUrl: 'https://cdn.example.com/video.mp4',
      youtubeTitle: 'YouTube title',
      youtubeDescription: 'YouTube description',
    }))
    expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'published',
    }))
  })

  it('blocks final-approved YouTube publish when the final video URL is missing', async () => {
    installPublishRouteSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Post text',
        cta_text: 'CTA',
        cta_url: 'https://example.com',
        hashtags: ['AI'],
        image_url: null,
        video_url: null,
        youtube_title: 'YouTube title',
        youtube_description: 'YouTube description',
        carousel_slide_urls: null,
        rag_context: approvedGate(['youtube']),
      },
      publishes: [
        { platform: 'youtube', status: 'pending' },
      ],
    })

    const response = await POST(request({ platforms: ['youtube'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Platform submission requires final approval and connected platform configuration.')
    expect(body.blockers).toEqual(['YouTube: YouTube needs a final video URL before submission.'])
    expect(mocks.publishToYouTube).not.toHaveBeenCalled()
  })

  it('dispatches Facebook publishing from approved content', async () => {
    const { queueUpdate } = installPublishRouteSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Post text',
        cta_text: 'CTA',
        cta_url: 'https://example.com',
        hashtags: ['AI'],
        image_url: 'https://cdn.example.com/image.png',
        video_url: null,
        youtube_title: null,
        youtube_description: null,
        carousel_slide_urls: null,
        rag_context: approvedGate(['facebook']),
      },
      publishes: [
        { platform: 'facebook', status: 'pending' },
      ],
    })
    mocks.publishToFacebook.mockResolvedValue({
      success: true,
      status: 'published',
      platformPostId: 'facebook-post-1',
      platformPostUrl: 'https://www.facebook.com/page/posts/facebook-post-1',
    })

    const response = await POST(request({ platforms: ['facebook'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.published).toBe(true)
    expect(mocks.publishToFacebook).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'social-1',
      imageUrl: 'https://cdn.example.com/image.png',
    }))
    expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'published',
    }))
  })

  it('does not mark the queue published for TikTok async processing alone', async () => {
    const { queueUpdate } = installPublishRouteSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Post text',
        cta_text: null,
        cta_url: null,
        hashtags: [],
        image_url: null,
        video_url: 'https://cdn.example.com/video.mp4',
        carousel_slide_urls: null,
        rag_context: approvedGate(['tiktok']),
      },
      publishes: [
        { platform: 'tiktok', status: 'pending' },
      ],
    })
    mocks.publishToTikTok.mockResolvedValue({
      success: true,
      status: 'publishing',
      platformPostId: 'tt-publish-1',
    })

    const response = await POST(request({ platforms: ['tiktok'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.published).toBe(false)
    expect(queueUpdate).not.toHaveBeenCalled()
  })
})
