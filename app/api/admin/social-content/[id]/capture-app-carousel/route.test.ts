import { promises as fs } from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  captureBroll: vi.fn(),
  renderCarousel: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  selectEq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/playtest-broll', () => ({
  captureBroll: mocks.captureBroll,
}))

vi.mock('@/lib/carousel', () => ({
  renderCarousel: mocks.renderCarousel,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: mocks.storageFrom,
    },
  },
}))

import { POST } from './route'

function request(body?: unknown) {
  return new NextRequest('http://localhost:3016/api/admin/social-content/social-1/capture-app-carousel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const productionAssets = {
  version: 'social_production_assets_v2',
  status: 'review_ready',
  generated_at: '2026-06-18T10:00:00.000Z',
  source: 'social_content_asset_packet',
  approval_boundary: 'Review only.',
  references: { open_brain: ['memory-1'], public_sources: [], placement_guidance: [] },
  chronicle_evidence: {
    ingestion_mode: 'direct_scoped_review',
    scope: { approved: true, source: 'test', window_label: 'test' },
    proposals: [],
    boundary: 'Review only.',
  },
  illustration: { status: 'prompt_ready', image_prompt: 'Prompt', framework_visual_type: 'architecture' },
  app_screenshot_carousel: {
    status: 'recommended',
    routes: [{ route: '/admin/social-content/social-1', label: 'Social Content review' }],
    existing_asset_count: 0,
  },
  broll: { status: 'missing', hints: [], assets: [] },
  video_script: { status: 'draft_ready', title: 'Video', script_text: 'Script', broll_hints: [] },
  video_redaction_manifest: {
    policy: 'hard_gate_auto_blur_first',
    status: 'ready',
    items: [],
    unresolved_count: 0,
    generated_at: '2026-06-18T10:00:00.000Z',
    reviewer_required: true,
    publish_blocker: null,
  },
  visual_qa: { status: 'required', checklist: [] },
}

describe('POST /api/admin/social-content/[id]/capture-app-carousel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)

    mocks.single.mockResolvedValue({
      data: {
        post_text: 'A review surface should show what the agent understood.',
        cta_text: 'Build with receipts.',
        hashtags: ['AgentOps', 'AI'],
        rag_context: {
          source: 'agent_ops_social_outreach_goal',
          goal_id: 'goal-123',
          publish_gate: 'draft_only',
          production_assets: productionAssets,
        },
      },
      error: null,
    })
    mocks.selectEq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.selectEq })
    mocks.updateEq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.updateEq })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'social_content_queue') throw new Error(`Unexpected table: ${table}`)
      return {
        select: mocks.select,
        update: mocks.update,
      }
    })

    mocks.captureBroll.mockImplementation(async (config: { outputDir: string; routes: Array<{ filename: string }> }) => {
      await fs.mkdir(config.outputDir, { recursive: true })
      const screenshots = await Promise.all(config.routes.map(async (route) => {
        const file = path.join(config.outputDir, `${route.filename}.png`)
        await fs.writeFile(file, Buffer.from(`screenshot:${route.filename}`))
        return file
      }))
      return { screenshots, clips: [], outputDir: config.outputDir }
    })

    mocks.renderCarousel.mockImplementation(async (slides: unknown[]) => ({
      pngBuffers: slides.map((_, index) => Buffer.from(`slide-${index + 1}`)),
      pdfBuffer: Buffer.from('pdf'),
    }))
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockImplementation((fileName: string) => ({
      data: { publicUrl: `https://cdn.example.com/${fileName}` },
    }))
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      getPublicUrl: mocks.getPublicUrl,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before fetching content', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.captureBroll).not.toHaveBeenCalled()
  })

  it('rejects non-whitelisted routes before capture, upload, or database reads', async () => {
    const response = await POST(request({
      routes: [
        { route: '/admin/social-content/social-1', label: 'Allowed' },
        { route: 'https://evil.test/admin/agents/swarm-board', label: 'External admin lookalike' },
        { route: '/api/admin/social-content/social-1', label: 'API route' },
      ],
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Routes must be whitelisted internal Portfolio admin paths.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.captureBroll).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('uses default routes from the content item and goal id', async () => {
    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const captureConfig = mocks.captureBroll.mock.calls[0][0]
    expect(captureConfig).toEqual(expect.objectContaining({
      baseUrl: 'http://localhost:3016',
      noStartServer: true,
    }))
    expect(captureConfig.routes.map((route: { route: string; description: string }) => ({
      route: route.route,
      description: route.description,
    }))).toEqual([
      { route: '/admin/social-content/social-1', description: 'Social Content review' },
      { route: '/admin/agents/swarm-board', description: 'Agent Swarm Board' },
      { route: '/admin/agents/standup?goal=goal-123', description: 'Standup Room goal' },
      { route: '/admin/agents/open-brain', description: 'Open Brain references' },
    ])
  })

  it('uploads screenshots, renders carousel assets, and records screenshot assets', async () => {
    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.content_format).toBe('carousel')
    expect(body.app_screenshot_assets).toHaveLength(4)
    expect(body.carousel_slide_urls).toHaveLength(8)
    expect(body.carousel_pdf_url).toBe('https://cdn.example.com/carousels/social-1/carousel.pdf')
    expect(mocks.renderCarousel).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: 'screenshot', screenshot_url: 'https://cdn.example.com/app-screenshots/social-1/01-social-content-review.png' }),
    ]))
    expect(mocks.upload).toHaveBeenCalledWith(
      'app-screenshots/social-1/01-social-content-review.png',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png', upsert: true }),
    )
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      content_format: 'carousel',
      carousel_slides: expect.any(Array),
      carousel_slide_urls: expect.any(Array),
      carousel_pdf_url: 'https://cdn.example.com/carousels/social-1/carousel.pdf',
      rag_context: expect.objectContaining({
        app_screenshot_assets: expect.any(Array),
        app_screenshot_carousel: expect.objectContaining({
          status: 'ready',
          route_count: 4,
          slide_count: 8,
        }),
        production_assets: expect.objectContaining({
          app_screenshot_carousel: expect.objectContaining({
            status: 'ready',
            routes: [
              { route: '/admin/social-content/social-1', label: 'Social Content review' },
              { route: '/admin/agents/swarm-board', label: 'Agent Swarm Board' },
              { route: '/admin/agents/standup?goal=goal-123', label: 'Standup Room goal' },
              { route: '/admin/agents/open-brain', label: 'Open Brain references' },
            ],
            existing_asset_count: 4,
            carousel_pdf_url: 'https://cdn.example.com/carousels/social-1/carousel.pdf',
            carousel_slide_urls: expect.any(Array),
          }),
        }),
      }),
    }))
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'social-1')
  })
})
