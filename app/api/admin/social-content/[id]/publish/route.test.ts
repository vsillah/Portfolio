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
