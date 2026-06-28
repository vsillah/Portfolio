import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildVideoRenderApproval } from '@/lib/video-render-approval'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
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

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/draft-1/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function queueFetchBuilder() {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'draft-1',
      title: 'The Receipt Every Agent Needs',
      script_text: 'The problem is that AI can create faster than teams can govern. I built the Portfolio workflow to show the receipt. Join the Accelerated Workshop interest path if you want the operating loop.',
      storyboard_json: { scenes: [{ brollHint: 'admin' }] },
      script_outline: {
        pain_point: 'AI can create faster than teams can govern.',
        hook: 'AI can create faster than teams can govern.',
        open_loop: 'Show the operating loop that closes the gap.',
        proof_demo: 'I built the Portfolio workflow to show the receipt.',
        cta: 'Join the Accelerated Workshop interest path.',
        source_distance_notes: 'AmaduTown original proof.',
      },
      script_scorecard: null,
      research_packet_ids: [],
      status: 'pending',
      source: 'manual',
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
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}

function jobInsertBuilder() {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'job-1',
      heygen_video_id: 'heygen-1',
      heygen_status: 'pending',
      created_at: '2026-05-27T22:30:00.000Z',
    },
    error: null,
  })
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({ single })),
    })),
  }
}

function queueUpdateBuilder() {
  return {
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }
}

describe('POST /api/admin/video-generation/ideas-queue/[id]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-1' })
  })

  it('requires render approval before reading the queue or calling HeyGen', async () => {
    const response = await POST(makeRequest({ channel: 'youtube' }), { params: { id: 'draft-1' } })

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Render approval confirmation')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('starts one HeyGen job when render approval is confirmed', async () => {
    mocks.from
      .mockReturnValueOnce(queueFetchBuilder())
      .mockReturnValueOnce(brollBuilder())
      .mockReturnValueOnce(jobInsertBuilder())
      .mockReturnValueOnce(queueUpdateBuilder())

    const response = await POST(
      makeRequest({
        channel: 'youtube',
        aspectRatio: '16:9',
        templateId: 'template-1',
        renderApproval: buildVideoRenderApproval(true),
      }),
      { params: { id: 'draft-1' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      jobId: 'job-1',
      heygenVideoId: 'heygen-1',
      status: 'pending',
    })
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      title: 'The Receipt Every Agent Needs',
      channel: 'youtube',
      templateId: 'template-1',
    }))
  })
})
