import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(), isAuthError: vi.fn(), from: vi.fn(),
  select: vi.fn(), eq: vi.fn(), single: vi.fn(), rpc: vi.fn(),
}))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }))

import { POST } from './route'

const request = () => new NextRequest('http://localhost/api/admin/social-content/item-1/prepare-stage-review', { method: 'POST' })
const context = { params: { id: 'item-1' } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
  mocks.isAuthError.mockReturnValue(false)
  mocks.single.mockResolvedValue({ data: { id: 'item-1', updated_at: '2026-10-31T20:55:13Z', rag_context: { current_gate: 'visual_review' } }, error: null })
  mocks.eq.mockReturnValue({ single: mocks.single })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.rpc.mockResolvedValue({ data: { work_item_id: 'work-1', current_gate: 'visual_review', next_gate: 'asset_packet', external_execution: false }, error: null })
})

describe('visual review packet preparation route', () => {
  it('passes only the current version and visual gate to the service-role RPC', async () => {
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_social_content_stage_review', {
      p_social_content_id: 'item-1',
      p_expected_content_updated_at: '2026-10-31T20:55:13Z',
      p_current_gate: 'visual_review',
      p_triggered_by_user_id: 'admin-1',
      p_idempotency_key: 'social-stage-review:item-1:visual_review:2026-10-31T20:55:13Z',
    })
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      canonical_href: '/admin/social-content/item-1?step=visuals&review=mobile&proposal=work-1#social-visual-assets-gate',
      external_execution: false,
    })
  })

  it.each(['copy_revision', 'platform_submission', ''])('refuses the %s gate before calling the RPC', async gate => {
    mocks.single.mockResolvedValue({ data: { id: 'item-1', updated_at: '2026-10-31T20:55:13Z', rag_context: { current_gate: gate } }, error: null })
    expect((await POST(request(), context)).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('keeps stale and missing evidence failures closed', async () => {
    for (const message of [
      'Social Content stage preparation is stale',
      'Exact approved prior copy decision receipt is required',
      'Safe exact visual asset hash and path are required',
      'Current copy, CTA, visual, or candidate projection identity mismatch',
      'Approved visual receipt is not bound to the exact asset hash',
      'Approved visual receipt is not bound to the exact asset path',
      'An approved visual receipt is required',
      'Lead-magnet receipt identity or URL mismatch',
      'Existing review packet is stale',
      'Duplicate or ambiguous prior-stage receipt identity for visual',
    ]) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { message } })
      const response = await POST(request(), context)
      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({ error: message })
    }
  })
})
