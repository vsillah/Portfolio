import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
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

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenDefaults: mocks.getHeyGenDefaults,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/draft-1/render-readiness', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function queueFetchBuilder(overrides: Record<string, unknown> = {}) {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'draft-1',
      title: 'The Receipt Every Agent Needs',
      script_text: 'The problem is that AI can create faster than teams can govern. I built the Portfolio workflow to show the receipt. Join the workshop interest path if you want the operating loop.',
      script_outline: {
        pain_point: 'AI can create faster than teams can govern.',
        hook: 'AI can create faster than teams can govern.',
        open_loop: 'Show the operating loop behind the work.',
        proof_demo: 'I built the Portfolio workflow to show the receipt.',
        cta: 'Join the workshop interest path.',
        source_distance_notes: 'AmaduTown original proof.',
      },
      script_scorecard: null,
      research_packet_ids: [],
      storyboard_json: { scenes: [{ brollHint: 'admin' }] },
      status: 'pending',
      video_generation_job_id: null,
      ...overrides,
    },
    error: null,
  })
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single })),
    })),
  }
}

function brollBuilder() {
  return {
    select: vi.fn().mockResolvedValue({
      data: [{ id: 'asset-1', filename: 'admin-dashboard.mp4', route_description: 'Admin mission control' }],
      error: null,
    }),
  }
}

describe('POST /api/admin/video-generation/ideas-queue/[id]/render-readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('HEYGEN_TEMPLATE_ID', '')
    vi.stubEnv('HEYGEN_AVATAR_ID', '')
    vi.stubEnv('HEYGEN_VOICE_ID', '')
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: null, voiceId: null })
  })

  it('returns a ready report without calling HeyGen or mutating jobs', async () => {
    mocks.from
      .mockReturnValueOnce(queueFetchBuilder())
      .mockReturnValueOnce(brollBuilder())

    const response = await POST(
      makeRequest({
        channel: 'youtube',
        aspectRatio: '16:9',
        templateId: 'template-1',
      }),
      { params: { id: 'draft-1' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.report.ready).toBe(true)
    expect(body.report.details.brollAssetIds).toEqual(['asset-1'])
    expect(body.report.details.approvalBoundary).toContain('does not start a render')
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('reports blocked readiness when HeyGen config is missing', async () => {
    mocks.from
      .mockReturnValueOnce(queueFetchBuilder({ storyboard_json: { scenes: [] } }))

    const response = await POST(
      makeRequest({ channel: 'youtube', aspectRatio: '16:9' }),
      { params: { id: 'draft-1' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.report.ready).toBe(false)
    expect(body.report.blockingIssues.join(' ')).toContain('HeyGen template or avatar and voice')
    expect(body.report.warnings).toContain('No storyboard scenes are attached for visual direction.')
  })

  it('uses synced HeyGen defaults before stale env avatar fallbacks', async () => {
    vi.stubEnv('HEYGEN_AVATAR_ID', 'stale-env-avatar')
    vi.stubEnv('HEYGEN_VOICE_ID', 'stale-env-voice')
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: 'db-avatar-1', voiceId: 'db-voice-1' })
    mocks.from
      .mockReturnValueOnce(queueFetchBuilder({ storyboard_json: { scenes: [] } }))

    const response = await POST(
      makeRequest({ channel: 'youtube', aspectRatio: '16:9' }),
      { params: { id: 'draft-1' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.report.ready).toBe(true)
    expect(body.report.details.avatarId).toBe('db-avatar-1')
    expect(body.report.details.voiceId).toBe('db-voice-1')
  })
})
