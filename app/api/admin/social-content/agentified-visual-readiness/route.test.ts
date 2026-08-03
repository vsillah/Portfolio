import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
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

import { POST } from './route'

function request(body?: Record<string, unknown>) {
  return new NextRequest('https://amadutown.com/api/admin/social-content/agentified-visual-readiness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function installSupabase(rows: Array<Record<string, unknown>>) {
  const queueIn = vi.fn().mockResolvedValue({ data: rows, error: null })
  const queueSelect = vi.fn(() => ({ in: queueIn }))

  const updates: Array<Record<string, unknown>> = []
  const queueUpdate = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload)
    return {
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'updated-row',
              ...payload,
            },
            error: null,
          }),
        })),
      })),
    }
  })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') {
      return { select: queueSelect, update: queueUpdate }
    }
    return {}
  })

  return { queueIn, queueUpdate, updates }
}

describe('POST /api/admin/social-content/agentified-visual-readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before reading or writing visual readiness', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)
    installSupabase([])

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('applies the full Amina visual packet batch without publishing', async () => {
    const ids = [
      '0cec63b3-5f8a-49bd-90f8-e3dff6757308',
      '470afc63-81bf-4acd-b2c3-4ec6b9c231fc',
      'f6f7c5be-13f1-43e3-9044-7b063cb2cb90',
      'b44527a4-2840-4be1-bf10-47ff945425a4',
    ]
    const { queueIn, updates } = installSupabase(ids.map((id) => ({
      id,
      status: 'approved',
      rag_context: { existing: true },
    })))

    const response = await POST(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.summary).toMatchObject({
      requested: 4,
      applied: 4,
      singleImage: 3,
      carousel: 1,
    })
    expect(body.remainingExternalGates).toEqual([
      'linkedin_provider_reconnect_if_token_expired',
      'final_platform_submission',
      'external_publish',
    ])
    expect(queueIn).toHaveBeenCalledWith('id', expect.arrayContaining(ids))
    expect(updates).toHaveLength(4)
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        content_format: 'single_image',
        image_url: 'https://amadutown.com/agentified/social-visuals/2026-07-31/linkedin-flagship-agentic-operating-system.png',
        carousel_slide_urls: null,
      }),
      expect.objectContaining({
        content_format: 'carousel',
        image_url: 'https://amadutown.com/agentified/social-visuals/2026-07-31/carousel-seven-things-after-agent-demo/slide-01-cover.png',
        carousel_slide_urls: expect.arrayContaining([
          'https://amadutown.com/agentified/social-visuals/2026-07-31/carousel-seven-things-after-agent-demo/slide-01-cover.png',
          'https://amadutown.com/agentified/social-visuals/2026-07-31/carousel-seven-things-after-agent-demo/slide-09-close.png',
        ]),
      }),
    ]))

    const carouselUpdate = updates.find((update) => Array.isArray(update.carousel_slide_urls))!
    expect(carouselUpdate.carousel_slide_urls).toHaveLength(9)
    expect(carouselUpdate.rag_context).toMatchObject({
      existing: true,
      section_gate_reviews: {
        visual_assets: { status: 'approved', decided_by: 'admin-1' },
        asset_packet: { status: 'approved', decided_by: 'admin-1' },
        privacy: { status: 'approved', decided_by: 'admin-1' },
      },
      agentified_visual_strategy_qa: {
        status: 'approved',
        format: 'carousel',
        linkedin_provider_capability: {
          publish_mode: 'multi_image_post',
          native_organic_carousel_supported: false,
        },
        side_effect_boundary: {
          external_publish: false,
          external_schedule: false,
          provider_upload: false,
          provider_generation: false,
        },
      },
    })
  })

  it('rejects ids outside the approved Agentified visual QA packet', async () => {
    const { queueUpdate } = installSupabase([])

    const response = await POST(request({ social_content_ids: ['unknown-id'] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unknown Agentified visual QA social content id',
      invalidIds: ['unknown-id'],
    })
    expect(queueUpdate).not.toHaveBeenCalled()
  })

  it('returns missing rows before applying a partial batch', async () => {
    const knownId = '0cec63b3-5f8a-49bd-90f8-e3dff6757308'
    const { queueUpdate } = installSupabase([])

    const response = await POST(request({ social_content_ids: [knownId] }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: 'One or more Social Content rows are missing.',
      missingIds: [knownId],
    })
    expect(queueUpdate).not.toHaveBeenCalled()
  })
})
