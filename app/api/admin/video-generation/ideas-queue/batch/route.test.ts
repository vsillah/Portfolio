import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildVideoRenderApproval } from '@/lib/video-render-approval'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createVideo: vi.fn(),
  isOverVideoGenerationLimit: vi.fn(),
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

vi.mock('@/lib/video-generation-rate-limit', () => ({
  isOverVideoGenerationLimit: mocks.isOverVideoGenerationLimit,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/ideas-queue/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isOverVideoGenerationLimit.mockResolvedValue(false)
  })

  it('requires render approval before batch generation can touch HeyGen', async () => {
    const response = await POST(makeRequest({ items: [{ id: 'draft-1' }] }))

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Render approval confirmation')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createVideo).not.toHaveBeenCalled()
  })

  it('skips a live-blocked script and still starts the eligible idea', async () => {
    const eligibleScript = 'The problem is that AI can create faster than teams can govern. I built the Portfolio workflow to show the receipt. Join the Accelerated Workshop interest path if you want the operating loop.'
    const outline = {
      pain_point: 'AI can create faster than teams can govern.',
      hook: 'AI can create faster than teams can govern.',
      open_loop: 'Show the operating loop that closes the gap.',
      proof_demo: 'I built the Portfolio workflow to show the receipt.',
      cta: 'Join the Accelerated Workshop interest path.',
      source_distance_notes: 'AmaduTown original proof.',
    }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'video_ideas_queue') {
        return {
          select: () => ({
            in: () => ({
              eq: async () => ({
                data: [
                  {
                    id: 'draft-blocked',
                    title: 'Blocked',
                    script_text: 'Audience: operators\nRequirements: show the workflow',
                    script_outline: null,
                    script_scorecard: { blockers: [] },
                    research_packet_ids: [],
                  },
                  {
                    id: 'draft-eligible',
                    title: 'Eligible',
                    script_text: eligibleScript,
                    script_outline: outline,
                    script_scorecard: { blockers: ['stale stored blocker that must not veto a live pass'] },
                    research_packet_ids: [],
                  },
                ],
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        }
      }
      if (table === 'video_generation_jobs') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'job-eligible', heygen_video_id: 'heygen-1' }, error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })
    mocks.createVideo.mockResolvedValue({ videoId: 'heygen-1' })

    const response = await POST(makeRequest({
      items: [{ id: 'draft-blocked' }, { id: 'draft-eligible' }],
      templateId: 'template-1',
      renderApproval: buildVideoRenderApproval(true),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.started).toBe(1)
    expect(body.jobs).toEqual([{ ideaId: 'draft-eligible', jobId: 'job-eligible', heygenVideoId: 'heygen-1' }])
    expect(mocks.createVideo).toHaveBeenCalledTimes(1)
    expect(mocks.createVideo).toHaveBeenCalledWith(expect.objectContaining({ script: eligibleScript }))
  })
})
