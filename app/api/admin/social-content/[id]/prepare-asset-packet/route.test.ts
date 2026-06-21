import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  socialSelect: vi.fn(),
  socialEq: vi.fn(),
  socialSingle: vi.fn(),
  brollSelect: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
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

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/prepare-asset-packet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/[id]/prepare-asset-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.socialSingle.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Use /admin/social-content/social-1 as internal proof.',
        cta_text: 'Build with receipts.',
        hashtags: ['#AI'],
        image_prompt: 'Mission Control illustration.',
        framework_visual_type: 'architecture',
        rag_context: {
          source: 'agent_ops_social_outreach_goal',
          goal_id: 'goal-123',
          chronicle_evidence_notes: ['Raw Chronicle screen note with vambah@example.com.'],
          open_brain_references: ['approved-memory'],
        },
      },
      error: null,
    })
    mocks.socialEq.mockReturnValue({ single: mocks.socialSingle })
    mocks.socialSelect.mockReturnValue({ eq: mocks.socialEq })
    mocks.brollSelect.mockResolvedValue({
      data: [{
        id: 'asset-1',
        route: '/admin/agents/swarm-board',
        route_description: 'Agent Swarm Board',
        filename: 'swarm-board',
        screenshot_path: '/tmp/swarm.png',
        clip_path: '/tmp/swarm.webm',
        captured_at: '2026-06-18T10:00:00.000Z',
      }],
      error: null,
    })
    mocks.updateEq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.updateEq })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') {
        return {
          select: mocks.socialSelect,
          update: mocks.update,
        }
      }
      if (table === 'broll_library') {
        return {
          select: mocks.brollSelect,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires an explicit Chronicle ingestion scope', async () => {
    const response = await POST(request({}), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Explicit Chronicle ingestion scope is required before preparing production assets.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a review-only production asset packet with redaction items', async () => {
    const response = await POST(request({
      chronicle_scope: {
        approved: true,
        source: 'social_content_detail',
        window_label: 'current production review',
      },
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.production_assets).toMatchObject({
      version: 'social_production_assets_v2',
      status: 'review_ready',
      chronicle_evidence: {
        ingestion_mode: 'direct_scoped_review',
      },
      video_redaction_manifest: {
        policy: 'hard_gate_auto_blur_first',
        status: 'requires_review',
      },
    })
    expect(body.production_assets.video_redaction_manifest.items.length).toBeGreaterThan(0)
    expect(mocks.update).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        production_assets: expect.objectContaining({
          version: 'social_production_assets_v2',
        }),
      }),
    })
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'social-1')
  })
})
