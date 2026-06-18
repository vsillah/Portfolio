import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  selectEq: vi.fn(),
  single: vi.fn(),
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

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/review-video-redaction', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseRagContext = {
  production_assets: {
    version: 'social_production_assets_v2',
    status: 'review_ready',
    video_redaction_manifest: {
      policy: 'hard_gate_auto_blur_first',
      status: 'requires_review',
      unresolved_count: 1,
      publish_blocker: 'Video privacy review required: 1 redaction item unresolved.',
      items: [{
        id: 'item-1',
        issue_type: 'email',
        source: 'chronicle',
        original_asset: { label: 'Chronicle note', url_or_path: null },
        redacted_asset: null,
        timestamp_ranges: [{ start_ms: 0, end_ms: 4000 }],
        bounding_boxes: [{ x: 0, y: 0, width: 1, height: 1, label: 'full_frame_review' }],
        proposed_action: 'auto_blur',
        confidence: 0.98,
        reviewer_decision: null,
        status: 'pending',
        evidence: 'vambah@example.com',
      }],
      generated_at: '2026-06-18T10:00:00.000Z',
      reviewer_required: true,
    },
  },
}

describe('POST /api/admin/social-content/[id]/review-video-redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({ data: { rag_context: baseRagContext }, error: null })
    mocks.selectEq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.selectEq })
    mocks.updateEq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.updateEq })
    mocks.from.mockReturnValue({ select: mocks.select, update: mocks.update })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('approves a redaction item and clears the publish blocker', async () => {
    const response = await POST(request({
      item_id: 'item-1',
      decision: 'approve_redaction',
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.redaction_gate.ready).toBe(true)
    expect(body.production_assets.video_redaction_manifest).toMatchObject({
      status: 'ready',
      unresolved_count: 0,
      publish_blocker: null,
    })
    expect(body.production_assets.video_redaction_manifest.items[0]).toMatchObject({
      reviewer_decision: 'approve_redaction',
      status: 'approved',
    })
    expect(mocks.update).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        production_assets: expect.objectContaining({
          video_redaction_manifest: expect.objectContaining({
            status: 'ready',
          }),
        }),
      }),
    })
  })

  it('keeps adjusted redactions unresolved', async () => {
    const response = await POST(request({
      item_id: 'item-1',
      decision: 'adjust_redaction',
    }), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.redaction_gate.ready).toBe(false)
    expect(body.production_assets.video_redaction_manifest).toMatchObject({
      status: 'requires_review',
      unresolved_count: 1,
    })
  })
})
