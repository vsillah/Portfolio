import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildVideoRenderApproval } from '@/lib/video-render-approval'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
  getHeyGenDefaults: vi.fn(),
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

vi.mock('@/lib/heygen', () => ({
  createVideo: mocks.createVideo,
}))

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenDefaults: mocks.getHeyGenDefaults,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/prepare-avatar-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function productionAssets(overrides: Record<string, unknown> = {}) {
  return {
    version: 'social_production_assets_v2',
    status: 'review_ready',
    generated_at: '2026-08-04T12:00:00.000Z',
    source: 'social_content_asset_packet',
    approval_boundary: 'Review only.',
    references: {
      open_brain: ['open-brain:agentified'],
      public_sources: [],
      placement_guidance: [],
    },
    chronicle_evidence: {
      ingestion_mode: 'direct_scoped_review',
      scope: { approved: true, source: 'test', window_label: 'test' },
      proposals: [],
      boundary: 'Review only.',
    },
    illustration: {
      status: 'prompt_ready',
      image_prompt: null,
      framework_visual_type: null,
    },
    app_screenshot_carousel: {
      status: 'recommended',
      routes: [],
      existing_asset_count: 0,
    },
    broll: {
      status: 'matched',
      hints: ['Portfolio workflow'],
      assets: [{
        id: 'broll-1',
        route: '/admin/social-content/social-1',
        route_description: 'Social Content visual review surface',
        filename: 'social-content-review.mp4',
        screenshot_path: '/design-files/broll/social-content-review.png',
        clip_path: '/design-files/broll/social-content-review.mp4',
        captured_at: '2026-08-04T12:00:00.000Z',
      }],
    },
    video_script: {
      status: 'draft_ready',
      title: 'Agentified review gates',
      script_text: [
        'The problem is that AI can create faster than teams can govern the work.',
        'By the end, the viewer sees the operating layer that keeps speed accountable.',
        'I built the Portfolio workflow to show the receipt: source basis, copy review, B-roll, and privacy gates before a platform handoff.',
        'Join the Agentified review path if your team needs a practical operating loop before publishing.',
      ].join('\n\n'),
      broll_hints: ['Portfolio workflow'],
    },
    video_redaction_manifest: {
      policy: 'hard_gate_auto_blur_first',
      status: 'ready',
      items: [],
      unresolved_count: 0,
      generated_at: '2026-08-04T12:00:00.000Z',
      reviewer_required: true,
      publish_blocker: null,
    },
    visual_qa: {
      status: 'required',
      checklist: [],
    },
    ...overrides,
  }
}

function socialItem(ragOverrides: Record<string, unknown> = {}) {
  return {
    id: 'social-1',
    status: 'approved',
    platform: 'youtube',
    target_platforms: ['youtube'],
    post_text: 'Approved copy',
    video_url: null,
    image_url: 'https://cdn.example.com/thumb.png',
    youtube_title: 'Agentified review gates',
    rag_context: {
      source: 'social_content_calendar_authorization',
      calendar_item_id: 'calendar-1',
      production_assets: productionAssets(),
      ...ragOverrides,
    },
  }
}

function queueFetchBuilder(item: Record<string, unknown>) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: item, error: null }),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }
}

function jobInsertBuilder(existingJobs: Record<string, unknown>[] = []) {
  const lookupChain = {
    eq: vi.fn(() => lookupChain),
    order: vi.fn(() => lookupChain),
    limit: vi.fn().mockResolvedValue({ data: existingJobs, error: null }),
  }

  return {
    select: vi.fn(() => lookupChain),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'job-1',
            heygen_video_id: 'heygen-1',
            heygen_status: 'pending',
            video_url: null,
            video_share_url: null,
            thumbnail_url: null,
            avatar_id: 'avatar-1',
            voice_id: 'voice-1',
            broll_asset_ids: ['broll-1'],
            created_at: '2026-08-04T12:05:00.000Z',
            updated_at: '2026-08-04T12:05:00.000Z',
          },
          error: null,
        }),
      })),
    })),
  }
}

describe('POST /api/admin/social-content/[id]/prepare-avatar-video', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-1', error: null })
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: 'avatar-1', voiceId: 'voice-1' })
  })

  it('requires render approval before calling HeyGen or creating a job', async () => {
    const response = await POST(request({}), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('surfaces missing HeyGen defaults as a blocked preparation state', async () => {
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: null, voiceId: null })
    mocks.from.mockReturnValueOnce(queueFetchBuilder(socialItem()))

    const response = await POST(request({ renderApproval: buildVideoRenderApproval(true) }), { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('Default Vambah HeyGen avatar and voice')
    expect(body.social_video_production.selectedAvatarId).toBeNull()
    expect(body.social_video_production.readiness.blockers).toContain('Default Vambah HeyGen avatar is missing.')
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('blocks preparation when the production packet has no B-roll candidates', async () => {
    const item = socialItem({
      production_assets: productionAssets({
        broll: { status: 'missing', hints: ['Portfolio workflow'], assets: [] },
      }),
    })
    mocks.from.mockReturnValueOnce(queueFetchBuilder(item))

    const response = await POST(request({ renderApproval: buildVideoRenderApproval(true) }), { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('Select or capture B-roll')
    expect(body.social_video_production.broll.status).toBe('missing')
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('relinks a matching existing HeyGen job before creating another render', async () => {
    const queueBuilder = queueFetchBuilder(socialItem())
    const jobBuilder = jobInsertBuilder([{
      id: 'job-existing',
      heygen_video_id: 'heygen-existing',
      heygen_status: 'pending',
      video_url: null,
      video_share_url: null,
      thumbnail_url: null,
      avatar_id: 'avatar-1',
      voice_id: 'voice-1',
      broll_asset_ids: ['broll-1'],
      created_at: '2026-08-04T12:04:00.000Z',
      updated_at: '2026-08-04T12:04:00.000Z',
    }])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') return queueBuilder
      if (table === 'video_generation_jobs') return jobBuilder
      return {}
    })

    const response = await POST(request({ renderApproval: buildVideoRenderApproval(true) }), { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      reused_existing_job: true,
      job_id: 'job-existing',
      heygen_video_id: 'heygen-existing',
      social_video_production: {
        status: 'render_requested',
        job: { id: 'job-existing', heygenStatus: 'pending' },
      },
    })
    expect(mocks.createVideo).not.toHaveBeenCalled()
    expect(jobBuilder.insert).not.toHaveBeenCalled()
  })

  it('creates one HeyGen job and stores a Social Content projection link', async () => {
    const queueBuilder = queueFetchBuilder(socialItem())
    const jobBuilder = jobInsertBuilder()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') return queueBuilder
      if (table === 'video_generation_jobs') return jobBuilder
      return {}
    })

    const response = await POST(request({ renderApproval: buildVideoRenderApproval(true) }), { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      job_id: 'job-1',
      heygen_video_id: 'heygen-1',
      social_video_production: {
        status: 'render_requested',
        selectedAvatarId: 'avatar-1',
        selectedVoiceId: 'voice-1',
        job: { id: 'job-1', heygenStatus: 'pending' },
      },
    })
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'youtube',
      avatarId: 'avatar-1',
      voiceId: 'voice-1',
    }))
  })
})
