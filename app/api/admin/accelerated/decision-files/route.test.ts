import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), rpc: vi.fn(), intakes: vi.fn(), services: vi.fn(), products: vi.fn(), approved: vi.fn(), intake: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (value: { error?: string }) => Boolean(value.error) }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }))
import { GET, PATCH, POST } from './route'
const id = '12345678-1234-1234-1234-123456789abc'
const offer = '87654321-4321-4321-4321-cba987654321'
const request = (method: string, body?: unknown) => new NextRequest('http://localhost/api/admin/accelerated/decision-files', body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: id } })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'accelerated_decision_file_intakes') return { select: () => ({ order: () => ({ limit: mocks.intakes }), eq: () => ({ maybeSingle: mocks.intake }) }) }
    if (table === 'services') return { select: () => ({ eq: () => ({ limit: mocks.services }) }) }
    if (table === 'products') return { select: () => ({ eq: () => ({ limit: mocks.products }) }) }
    if (table === 'accelerated_member_recommendations') return { select: () => ({ eq: () => ({ in: mocks.approved }) }) }
  })
  mocks.intakes.mockResolvedValue({ data: [{ id, answers: { L01: 'Need intake automation' } }] })
  mocks.intake.mockResolvedValue({ data: { answers: { L01: 'Need intake automation' }, review_status: 'linked', linked_audit_id: 42 } })
  mocks.services.mockResolvedValue({ data: [{ id: offer, title: 'Intake automation workshop', is_active: true }] })
  mocks.products.mockResolvedValue({ data: [] })
  mocks.approved.mockResolvedValue({ data: [] })
  mocks.rpc.mockResolvedValue({ data: [{ id, review_status: 'linked', linked_audit_id: 42 }] })
})
describe('protected Decision File review', () => {
  it('denies unauthorized review before accessing data', async () => {
    mocks.auth.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    expect((await GET(request('GET'))).status).toBe(401)
    expect((await PATCH(request('PATCH', { id, status: 'linked', auditId: 42, note: 'Reviewed' }))).status).toBe(401)
    expect((await POST(request('POST', { id, kind: 'service', offerId: offer }))).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('returns evidence-matched catalog candidates and approved receipts', async () => {
    mocks.approved.mockResolvedValue({ data: [{ intake_id: id, offer_kind: 'service', offer_id: offer }] })
    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    const item = (await response.json()).items[0]
    expect(item.candidates[0].id).toBe(offer)
    expect(item.approvedOfferKeys).toEqual([`service:${offer}`])
  })
  it('requires a valid audit ID before calling the atomic review command', async () => {
    expect((await PATCH(request('PATCH', { id, status: 'linked', note: 'Reviewed' }))).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('uses one atomic review command and propagates identity conflict', async () => {
    const body = { id, status: 'linked', auditId: 42, note: 'Reviewed' }
    expect((await PATCH(request('PATCH', body))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_review_decision_file', expect.objectContaining({ p_intake_id: id, p_audit_id: 42, p_reviewer: id }))
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Assessment contact does not match the worksheet learner' } })
    expect((await PATCH(request('PATCH', body))).status).toBe(409)
  })
  it('approves only evidence-matched offers for a linked audit and member', async () => {
    expect((await POST(request('POST', { id, kind: 'service', offerId: offer }))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_approve_member_recommendation', expect.objectContaining({ p_intake_id: id, p_audit_id: 42, p_offer_id: offer, p_reviewer: id }))
    expect((await POST(request('POST', { id, kind: 'service', offerId: 'no-match' }))).status).toBe(409)
    mocks.intake.mockResolvedValue({ data: { answers: { L01: 'Need intake automation' }, review_status: 'pending', linked_audit_id: null } })
    expect((await POST(request('POST', { id, kind: 'service', offerId: offer }))).status).toBe(409)
  })
})
