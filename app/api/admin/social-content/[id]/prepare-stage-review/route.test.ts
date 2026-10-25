import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}))

import { POST } from './route'

const request = () => new NextRequest('http://localhost/api/admin/social-content/social-1/prepare-stage-review', {
  method: 'POST',
})

describe('POST /api/admin/social-content/[id]/prepare-stage-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({
      data: {
        id: 'social-1',
        updated_at: '2026-10-25T10:00:00.000Z',
        rag_context: { current_gate: 'asset_packet' },
      },
      error: null,
    })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.rpc.mockResolvedValue({
      data: {
        work_item_id: 'work-1',
        approval_id: 'approval-1',
        current_gate: 'asset_packet',
        next_gate: 'privacy',
        external_execution: false,
      },
      error: null,
    })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed when the current gate cannot be prepared', async () => {
    mocks.single.mockResolvedValue({
      data: {
        id: 'social-1',
        updated_at: '2026-10-25T10:00:00.000Z',
        rag_context: { current_gate: 'copy' },
      },
      error: null,
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('prepares the version-bound packet and returns its canonical route', async () => {
    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_social_content_stage_review', {
      p_social_content_id: 'social-1',
      p_expected_content_updated_at: '2026-10-25T10:00:00.000Z',
      p_current_gate: 'asset_packet',
      p_triggered_by_user_id: 'admin-1',
      p_idempotency_key: 'social-stage-review:social-1:asset_packet:2026-10-25T10:00:00.000Z',
    })
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      canonical_href: '/admin/social-content/social-1?step=visuals&review=mobile&proposal=work-1#social-asset-packet-gate',
      external_execution: false,
    })
  })

  it('returns a conflict when the version binding is stale', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Social Content stage preparation is stale' } })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(409)
  })
})
