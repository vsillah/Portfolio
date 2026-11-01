import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
import { POST } from './route'

const socialId = '00000000-0000-4000-8000-000000000001'
const workId = '00000000-0000-4000-8000-000000000002'
const privacyId = 'e935496a-e026-494a-9ab2-c9ae78d56060'
function request(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/admin/social-content/${socialId}/linkedin-handoff-review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
const binding = { work_item_id: workId, privacy_receipt_id: privacyId, handoff_created_at: '2026-11-01T10:00:00Z' }

describe('LinkedIn handoff internal decision route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: '72f4bc0c-5763-4c67-bf19-8e725dcc783a' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.rpc.mockResolvedValue({ data: { id: 'receipt', external_execution: false }, error: null })
  })

  it('requires exact UUID bindings and a revision reason', async () => {
    expect((await POST(request({ ...binding, privacy_receipt_id: 'wrong', decision: 'approve' }), { params: { id: socialId } })).status).toBe(400)
    expect((await POST(request({ ...binding, decision: 'request_revision', note: ' ' }), { params: { id: socialId } })).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('records only the bound internal approval command', async () => {
    const response = await POST(request({ ...binding, decision: 'approve' }), { params: { id: socialId } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ external_execution: false })
    expect(mocks.rpc).toHaveBeenCalledWith('record_social_linkedin_handoff_decision', {
      p_social_content_id: socialId, p_work_item_id: workId, p_privacy_receipt_id: privacyId,
      p_expected_handoff_created_at: binding.handoff_created_at, p_decision: 'approve',
      p_decided_by_user_id: '72f4bc0c-5763-4c67-bf19-8e725dcc783a', p_note: null,
      p_idempotency_key: `linkedin-handoff-review:${workId}:${privacyId}:approve`,
    })
  })

  it('fails closed when the atomic command rejects stale evidence', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'LinkedIn handoff is stale, incomplete, duplicate, or mismatched' } })
    const response = await POST(request({ ...binding, decision: 'approve' }), { params: { id: socialId } })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain('stale')
  })
})
