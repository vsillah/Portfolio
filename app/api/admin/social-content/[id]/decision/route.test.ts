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

const CONTENT_ID = '11111111-1111-4111-8111-111111111111'
const APPROVAL_ID = '22222222-2222-4222-8222-222222222222'
const VERSION = '2026-10-12T18:30:00.000Z'

function receipt() {
  return { receipt_id: crypto.randomUUID(), status: 'approved', content_updated_at: VERSION }
}

function reviewItem(version = VERSION) {
  return {
    id: CONTENT_ID,
    status: 'draft',
    updated_at: version,
    rag_context: {
      mobile_decision_review: {
        version: 'social-content-decision-review/v1',
        approval_id: APPROVAL_ID,
        run_id: '33333333-3333-4333-8333-333333333333',
        work_item_id: '44444444-4444-4444-8444-444444444444',
        content_id: CONTENT_ID,
        content_updated_at: VERSION,
        current_gate: 'copy_review',
        next_gate: 'visual_review',
        receipts: {
          source: receipt(),
          voice: receipt(),
          framework: receipt(),
          privacy: receipt(),
          visual: receipt(),
          challenger: receipt(),
        },
        candidate_projection: { headline: 'Read only' },
      },
    },
  }
}

function request(decision: string) {
  return new NextRequest(`http://localhost/api/admin/social-content/${CONTENT_ID}/decision`, {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: JSON.stringify({ decision, work_item_id: '44444444-4444-4444-8444-444444444444' }),
  })
}

describe('POST /api/admin/social-content/[id]/decision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.single
      .mockResolvedValueOnce({ data: reviewItem(), error: null })
      .mockResolvedValueOnce({ data: { ...reviewItem(), status: 'approved' }, error: null })
    mocks.rpc.mockResolvedValue({
      data: {
        id: '55555555-5555-4555-8555-555555555555',
        decision: 'approve',
        next_internal_gate: 'visual_review',
        external_execution: false,
      },
      error: null,
    })
  })

  it('records a receipt-complete decision through the transactional command only', async () => {
    const response = await POST(request('approve'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      decision: 'approve',
      next_internal_gate: 'visual_review',
      external_execution: false,
    }))
    expect(mocks.rpc).toHaveBeenCalledWith('record_social_content_stage_decision', expect.objectContaining({
      p_social_content_id: CONTENT_ID,
      p_approval_id: APPROVAL_ID,
      p_content_updated_at: VERSION,
      p_decision: 'approve',
      p_decided_by_user_id: 'admin-1',
      p_command_name: 'approve_copy',
      p_idempotency_key: expect.stringContaining(`${APPROVAL_ID}:`),
    }))
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('lets the transactional command distinguish an idempotent replay from a stale first attempt', async () => {
    mocks.single.mockReset()
    mocks.single.mockResolvedValueOnce({
      data: reviewItem('2026-10-12T18:31:00.000Z'),
      error: null,
    })
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Social Content review packet is stale' },
    })

    const response = await POST(request('hold'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Social Content review packet is stale' })
    expect(mocks.rpc).toHaveBeenCalledWith('record_social_content_stage_decision', expect.objectContaining({
      p_decision: 'hold',
      p_content_updated_at: VERSION,
    }))
  })

  it('returns the existing immutable receipt on a retry after the item version advanced', async () => {
    const advancedItem = reviewItem('2026-10-12T18:31:00.000Z')
    Object.assign(advancedItem.rag_context, {
      current_gate: 'visual_review',
      latest_internal_decision_receipt_id: '55555555-5555-4555-8555-555555555555',
      latest_internal_decision: 'approve',
    })
    mocks.single.mockReset()
    mocks.single
      .mockResolvedValueOnce({ data: advancedItem, error: null })
      .mockResolvedValueOnce({ data: { ...advancedItem, status: 'approved' }, error: null })
    mocks.rpc.mockResolvedValueOnce({
      data: {
        id: '55555555-5555-4555-8555-555555555555',
        decision: 'approve',
        next_internal_gate: 'visual_review',
        idempotent_replay: true,
        external_execution: false,
      },
      error: null,
    })

    const response = await POST(request('approve'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      receipt: expect.objectContaining({ idempotent_replay: true }),
      external_execution: false,
    }))
  })

  it('fails closed before the RPC when a required receipt is missing', async () => {
    const incomplete = reviewItem()
    delete (incomplete.rag_context.mobile_decision_review.receipts as Record<string, unknown>).visual
    mocks.single.mockReset()
    mocks.single.mockResolvedValueOnce({ data: incomplete, error: null })

    const response = await POST(request('request_revision'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({
      code: 'SOCIAL_DECISION_RECEIPTS_REQUIRED',
    }))
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects unknown actions without reading or mutating data', async () => {
    const response = await POST(request('publish'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid decision' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
