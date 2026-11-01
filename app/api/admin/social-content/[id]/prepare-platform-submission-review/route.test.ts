import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))

import { POST } from './route'

const contentId = '563d3ee1-e5b9-41bb-89f3-9273ea017272'
const receiptId = 'a2255a62-b65e-4106-82b4-8eff44970ab8'
const version = '2026-11-01T12:30:00.000Z'
const request = (body: Record<string, unknown>) => new NextRequest(
  `http://localhost/api/admin/social-content/${contentId}/prepare-platform-submission-review`,
  { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } },
)

describe('POST prepare-platform-submission-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: '33333333-3333-4333-8333-333333333333' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.rpc.mockResolvedValue({ data: { work_item_id: '44444444-4444-4444-8444-444444444444' }, error: null })
  })

  it('prepares the exact receipt-bound packet without external execution', async () => {
    const response = await POST(request({ expected_content_updated_at: version, handoff_decision_receipt_id: receiptId }), { params: { id: contentId } })
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_linkedin_platform_submission_review', {
      p_social_content_id: contentId, p_expected_content_updated_at: version,
      p_handoff_decision_receipt_id: receiptId,
      p_triggered_by_user_id: '33333333-3333-4333-8333-333333333333',
      p_idempotency_key: `social-platform-submission-review:${contentId}:${receiptId}:${version}`,
    })
    await expect(response.json()).resolves.toMatchObject({
      canonical_href: `/admin/social-content/${contentId}?step=submit&review=mobile&proposal=44444444-4444-4444-8444-444444444444#social-platform-submission-gate`,
      external_execution: false,
    })
  })

  it('rejects incomplete identity input before calling the database', async () => {
    const response = await POST(request({ expected_content_updated_at: version }), { params: { id: contentId } })
    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns a conflict for stale or mismatched handoff evidence', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'LinkedIn handoff receipt identity mismatch' } })
    const response = await POST(request({ expected_content_updated_at: version, handoff_decision_receipt_id: receiptId }), { params: { id: contentId } })
    expect(response.status).toBe(409)
  })
})
