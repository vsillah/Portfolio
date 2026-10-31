import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), from: vi.fn(), rpc: vi.fn(), single: vi.fn(), calendars: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }))

import { GET, POST } from './route'
import { DARK_CASTLE_COPY_CALENDAR_ID, DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'

const version = '2026-10-29T12:00:00.000Z'
const request = (method: string) => new NextRequest(`http://localhost/api/admin/social-content/${DARK_CASTLE_COPY_CONTENT_ID}/bind-copy-review`, { method })
const params = { params: { id: DARK_CASTLE_COPY_CONTENT_ID } }
const receipt = (key: string) => ({ receipt_id: `${key}-1`, status: 'approved', content_updated_at: version })
const item = () => ({ id: DARK_CASTLE_COPY_CONTENT_ID, updated_at: version, rag_context: { current_gate: 'copy_review',
  copy_review_candidate_projection: { title: 'Existing candidate' }, copy_review_evidence_receipts: Object.fromEntries(
    ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map(key => [key, receipt(key)])),
} })

describe('Dark Castle copy-review operator route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'operator' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.single.mockResolvedValue({ data: item(), error: null })
    mocks.calendars.mockResolvedValue({ data: [{ id: DARK_CASTLE_COPY_CALENDAR_ID, social_content_id: DARK_CASTLE_COPY_CONTENT_ID, due_status: 'due_soon' }], error: null })
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => table === 'social_content_queue'
      ? { single: mocks.single } : mocks.calendars() }) }))
    mocks.rpc.mockResolvedValue({ data: { work_item_id: 'work-1', current_gate: 'copy_review', external_execution: false }, error: null })
  })

  it('reports readiness without writing', async () => {
    expect((await GET(request('GET'), params)).status).toBe(200)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects a missing receipt before invoking preparation', async () => {
    const value = item(); delete value.rag_context.copy_review_evidence_receipts.source
    mocks.single.mockResolvedValue({ data: value, error: null })
    const response = await POST(request('POST'), params)
    expect(response.status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('invokes exactly one trigger-bound preparation and returns its canonical queue link', async () => {
    const response = await POST(request('POST'), params)
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_social_content_copy_review', {
      p_social_content_id: DARK_CASTLE_COPY_CONTENT_ID, p_expected_content_updated_at: version, p_triggered_by_user_id: 'operator',
    })
    await expect(response.json()).resolves.toMatchObject({ external_execution: false,
      canonical_href: `/admin/social-content/${DARK_CASTLE_COPY_CONTENT_ID}?step=copy&review=mobile&proposal=work-1#social-copy-gate`,
    })
  })

  it('rejects unauthorized and unrelated records before reading or writing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    expect((await POST(request('POST'), params)).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    mocks.isAuthError.mockReturnValue(false)
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'operator' } })
    expect((await POST(request('POST'), { params: { id: 'other' } })).status).toBe(404)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
