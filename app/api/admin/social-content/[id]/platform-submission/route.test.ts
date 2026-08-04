import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  syncCampaignCalendarForSocialContent: vi.fn(),
  from: vi.fn(),
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

vi.mock('@/lib/social-content-calendar-linkage', () => ({
  syncCampaignCalendarForSocialContent: mocks.syncCampaignCalendarForSocialContent,
}))

import { POST } from './route'

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/platform-submission', {
    method: 'POST',
    headers: {
      authorization: 'Bearer admin-token',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function installSupabase({
  item,
  publishes,
  configs,
  fetchError = null,
}: {
  item: Record<string, unknown> | null
  publishes: Array<Record<string, unknown>>
  configs: Array<Record<string, unknown>>
  fetchError?: { code: string; message: string } | null
}) {
  const itemRecord = item ?? {}
  const queueSingle = vi.fn().mockResolvedValue({ data: item, error: fetchError })
  const queueSelectEq = vi.fn(() => ({ single: queueSingle }))
  const queueSelect = vi.fn(() => ({ eq: queueSelectEq }))

  const queueUpdateSingle = vi.fn().mockResolvedValue({
    data: {
      ...itemRecord,
      rag_context: {
        ...((itemRecord.rag_context as Record<string, unknown> | null) ?? {}),
        platform_submission_gate: {
          status: 'approved',
          approved_by: 'admin-1',
        },
      },
    },
    error: null,
  })
  const queueUpdateSelect = vi.fn(() => ({ single: queueUpdateSingle }))
  const queueUpdateEq = vi.fn(() => ({ select: queueUpdateSelect }))
  const queueUpdate = vi.fn(() => ({ eq: queueUpdateEq }))

  const publishUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const publishSelectEq = vi.fn().mockResolvedValue({ data: publishes, error: null })
  const publishSelect = vi.fn(() => ({ eq: publishSelectEq }))

  const configSelect = vi.fn().mockResolvedValue({ data: configs, error: null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') return { select: queueSelect, update: queueUpdate }
    if (table === 'social_content_publishes') return { upsert: publishUpsert, select: publishSelect }
    if (table === 'social_content_config') return { select: configSelect }
    return {}
  })

  return { publishUpsert, queueUpdate, queueUpdateSingle }
}

describe('POST /api/admin/social-content/[id]/platform-submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.syncCampaignCalendarForSocialContent.mockResolvedValue({
      matched: 0,
      updated: 0,
      skipped: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    { label: 'unauthenticated requests', authResult: { error: 'Authentication required', status: 401 } },
    { label: 'authenticated non-admin requests', authResult: { error: 'Admin access required', status: 403 } },
  ])('fails closed for $label before database access', async ({ authResult }) => {
    mocks.verifyAdmin.mockResolvedValueOnce(authResult)
    mocks.isAuthError.mockReturnValueOnce(true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )
    const adminRequest = request({ platforms: ['linkedin'] })

    const response = await POST(adminRequest, { params: { id: 'social-1' } })

    expect(response.status).toBe(authResult.status)
    await expect(response.json()).resolves.toEqual({ error: authResult.error })
    expect(mocks.verifyAdmin).toHaveBeenCalledWith(adminRequest)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns not found without preparing or publishing rows when content is missing', async () => {
    const { publishUpsert, queueUpdate } = installSupabase({
      item: null,
      publishes: [],
      configs: [],
      fetchError: { code: 'PGRST116', message: 'The result contains 0 rows' },
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['linkedin'] }), { params: { id: 'missing-content' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Content not found' })
    expect(publishUpsert).not.toHaveBeenCalled()
    expect(queueUpdate).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects draft content before recording or triggering platform submission', async () => {
    const { publishUpsert, queueUpdate } = installSupabase({
      item: {
        id: 'social-1',
        status: 'draft',
        platform: 'linkedin',
        target_platforms: ['linkedin'],
        rag_context: null,
      },
      publishes: [],
      configs: [],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['linkedin'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Content must be approved before platform submission.',
    })
    expect(publishUpsert).not.toHaveBeenCalled()
    expect(queueUpdate).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('records final approval and triggers automatic submission through the publish route', async () => {
    const { publishUpsert, queueUpdate } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'linkedin',
        target_platforms: ['instagram', 'tiktok'],
        post_text: 'Post text',
        image_url: 'https://cdn.example.com/image.png',
        video_url: 'https://cdn.example.com/video.mp4',
        carousel_slide_urls: null,
        rag_context: null,
      },
      publishes: [
        { platform: 'instagram', status: 'pending', platform_post_url: null },
        { platform: 'tiktok', status: 'pending', platform_post_url: null },
      ],
      configs: [
        {
          platform: 'instagram',
          is_active: true,
          credentials: { access_token: 'token', ig_user_id: 'ig-user-1' },
          settings: {},
        },
        {
          platform: 'tiktok',
          is_active: true,
          credentials: { access_token: 'token' },
          settings: { creator_info_confirmed: true, source_url_approved: true },
        },
      ],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['instagram', 'tiktok'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.submit_triggered).toBe(true)
    expect(publishUpsert).toHaveBeenCalledWith([
      { content_id: 'social-1', platform: 'instagram', status: 'pending' },
      { content_id: 'social-1', platform: 'tiktok', status: 'pending' },
    ], { onConflict: 'content_id,platform', ignoreDuplicates: true })
    expect(queueUpdate).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        platform_submission_gate: expect.objectContaining({
          status: 'approved',
          approved_by: 'admin-1',
          platforms: ['instagram', 'tiktok'],
        }),
      }),
    })
    expect(mocks.syncCampaignCalendarForSocialContent).toHaveBeenCalledWith({
      admin: { from: mocks.from },
      socialContentId: 'social-1',
      event: expect.objectContaining({
        type: 'platform_submission_approved',
        userId: 'admin-1',
        platforms: ['instagram', 'tiktok'],
        submitAfterApproval: true,
      }),
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost/api/admin/social-content/social-1/publish',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ platforms: ['instagram', 'tiktok'] }),
      }),
    )
  })

  it('records final approval without calling publish when auto-submit is disabled', async () => {
    const { publishUpsert, queueUpdate } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'instagram',
        target_platforms: ['instagram'],
        post_text: 'Post text',
        image_url: 'https://cdn.example.com/image.png',
        video_url: null,
        carousel_slide_urls: null,
        rag_context: null,
      },
      publishes: [
        { platform: 'instagram', status: 'pending', platform_post_url: null },
      ],
      configs: [
        {
          platform: 'instagram',
          is_active: true,
          credentials: { access_token: 'token', ig_user_id: 'ig-user-1' },
          settings: {},
        },
      ],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(
      request({ platforms: ['instagram'], submit_after_approval: false }),
      { params: { id: 'social-1' } },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.submit_triggered).toBe(false)
    expect(body.publish_response).toBeNull()
    expect(publishUpsert).toHaveBeenCalledWith([
      { content_id: 'social-1', platform: 'instagram', status: 'pending' },
    ], { onConflict: 'content_id,platform', ignoreDuplicates: true })
    expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      rag_context: expect.objectContaining({
        platform_submission_gate: expect.objectContaining({
          status: 'approved',
          platforms: ['instagram'],
          submit_after_approval: false,
        }),
      }),
    }))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('records YouTube final approval without auto-triggering upload from the readiness gate', async () => {
    const { publishUpsert, queueUpdate } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'youtube',
        target_platforms: ['youtube'],
        post_text: 'Post text',
        image_url: 'https://cdn.example.com/youtube-thumbnail.png',
        video_url: 'https://cdn.example.com/video.mp4',
        youtube_title: 'YouTube title',
        youtube_description: 'YouTube description',
        carousel_slide_urls: null,
        rag_context: { source_packet_path: 'docs/youtube/source-packet.md' },
      },
      publishes: [
        { platform: 'youtube', status: 'pending', platform_post_url: null },
      ],
      configs: [
        {
          platform: 'youtube',
          is_active: true,
          credentials: { access_token: 'token' },
          settings: { default_privacy: 'unlisted', channel_title: 'AmaduTown' },
        },
      ],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['youtube'], submit_after_approval: true }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.submit_triggered).toBe(false)
    expect(body.auto_submit_blocked_platforms).toEqual(['youtube'])
    expect(publishUpsert).toHaveBeenCalledWith([
      { content_id: 'social-1', platform: 'youtube', status: 'pending' },
    ], { onConflict: 'content_id,platform', ignoreDuplicates: true })
    expect(queueUpdate).toHaveBeenCalledWith(expect.objectContaining({
      rag_context: expect.objectContaining({
        platform_submission_gate: expect.objectContaining({
          status: 'approved',
          platforms: ['youtube'],
          submit_after_approval: false,
          auto_submit_blocked_platforms: ['youtube'],
        }),
      }),
    }))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not approve final submission while video redaction items are unresolved', async () => {
    const { publishUpsert, queueUpdateSingle } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'linkedin',
        target_platforms: ['linkedin'],
        post_text: 'Post text',
        image_url: null,
        video_url: 'https://cdn.example.com/video.mp4',
        carousel_slide_urls: null,
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
      publishes: [
        { platform: 'linkedin', status: 'pending', platform_post_url: null },
      ],
      configs: [
        {
          platform: 'linkedin',
          is_active: true,
          credentials: { access_token: 'token', author_urn: 'urn:li:person:123' },
          settings: {},
        },
      ],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['linkedin'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Video privacy review required: 1 redaction item unresolved.',
      unresolved_redaction_items: 1,
    })
    expect(publishUpsert).not.toHaveBeenCalled()
    expect(queueUpdateSingle).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not approve final submission when platform configuration is blocked', async () => {
    const { queueUpdateSingle } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'tiktok',
        target_platforms: ['tiktok'],
        post_text: 'Post text',
        image_url: null,
        video_url: 'https://cdn.example.com/video.mp4',
        carousel_slide_urls: null,
        rag_context: null,
      },
      publishes: [
        { platform: 'tiktok', status: 'pending', platform_post_url: null },
      ],
      configs: [],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['tiktok'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Platform submission is blocked.')
    expect(body.blockers).toEqual(['TikTok: Connect and activate TikTok in Social Content settings.'])
    expect(queueUpdateSingle).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not approve final submission when required platform media is missing', async () => {
    const { queueUpdateSingle } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'youtube',
        target_platforms: ['youtube', 'tiktok'],
        post_text: 'Post text',
        image_url: 'https://cdn.example.com/youtube-thumbnail.png',
        video_url: null,
        youtube_title: 'YouTube title',
        youtube_description: 'YouTube description',
        carousel_slide_urls: null,
        rag_context: null,
      },
      publishes: [
        { platform: 'youtube', status: 'pending', platform_post_url: null },
        { platform: 'tiktok', status: 'pending', platform_post_url: null },
      ],
      configs: [
        {
          platform: 'youtube',
          is_active: true,
          credentials: { access_token: 'token' },
          settings: { default_privacy: 'private', channel_title: 'AmaduTown' },
        },
        {
          platform: 'tiktok',
          is_active: true,
          credentials: { access_token: 'token' },
          settings: { creator_info_confirmed: true, source_url_approved: true },
        },
      ],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['youtube', 'tiktok'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Platform submission is blocked.')
    expect(body.blockers).toEqual([
      'YouTube: YouTube needs a final video URL before submission.',
      'TikTok: TikTok needs a final video URL before Direct Post submission.',
    ])
    expect(queueUpdateSingle).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not approve YouTube final submission when release metadata and thumbnail readiness are missing', async () => {
    const { queueUpdateSingle } = installSupabase({
      item: {
        id: 'social-1',
        status: 'approved',
        platform: 'youtube',
        target_platforms: ['youtube'],
        post_text: 'Post text',
        image_url: null,
        video_url: 'https://cdn.example.com/video.mp4',
        youtube_title: null,
        youtube_description: null,
        carousel_slide_urls: null,
        rag_context: { source_packet_path: 'docs/youtube/source-packet.md' },
      },
      publishes: [
        { platform: 'youtube', status: 'pending', platform_post_url: null },
      ],
      configs: [
        {
          platform: 'youtube',
          is_active: true,
          credentials: { access_token: 'token' },
          settings: { default_privacy: 'unlisted', channel_title: 'AmaduTown' },
        },
      ],
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ published: true }), { status: 200 }),
    )

    const response = await POST(request({ platforms: ['youtube'] }), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Platform submission is blocked.')
    expect(body.blockers).toEqual([
      'YouTube: Add the final YouTube title and description before submission. YouTube title is required. YouTube description is required. Reviewed thumbnail or thumbnail readiness is required.',
    ])
    expect(body.platform_submission_orchestration.platforms[0].youtubeReadiness.reviewValues).toMatchObject({
      title: null,
      description: null,
      thumbnail: null,
      finalVideoUrl: 'https://cdn.example.com/video.mp4',
      visibility: 'unlisted',
      targetChannel: 'AmaduTown',
    })
    expect(queueUpdateSingle).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
