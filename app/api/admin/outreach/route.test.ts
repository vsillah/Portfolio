import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ from: vi.fn(), verifyAdmin: vi.fn(), isAuthError: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { PATCH } from './route'

const VERSION = '2026-09-08T12:00:00.000Z'
function setup(row: Record<string, unknown>, changed = [{ id: 'draft-1', updated_at: '2026-09-08T12:01:00.000Z' }]) {
  const update = vi.fn()
  const chain: Record<string, unknown> = {}
  for (const key of ['select', 'in', 'eq']) chain[key] = vi.fn(() => chain)
  chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: changed, error: null })
  update.mockReturnValue(chain)
  mocks.from.mockReturnValueOnce({ select: () => ({ in: async () => ({ data: [{ updated_at: VERSION, ...row }], error: null }) }) })
  mocks.from.mockReturnValue({ update })
  Object.assign(update, { filters: chain.eq })
  return update
}
const request = (action: string, updates?: Record<string, unknown>, version = VERSION) => new NextRequest('http://localhost/api/admin/outreach', {
  method: 'PATCH', body: JSON.stringify({ action, ids: ['draft-1'], updates, expectedVersions: { 'draft-1': version } }),
})
beforeEach(() => { vi.clearAllMocks(); mocks.from.mockReset(); mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin' } }); mocks.isAuthError.mockReturnValue(false) })
describe('canonical draft edit and review', () => {
  it.each(['approved', 'rejected'])('returns %s copy to draft and clears approval', async (status) => {
    const update = setup({ id: 'draft-1', status, body: 'Old final copy', generation_inputs: { warm_gmail_send_authorization: { status: 'approved' }, warm_gmail_send_slack_approval_request: { status: 'approved' } } })
    expect((await PATCH(request('edit', { body: 'Hi Ada, would Tuesday work for our workshop follow-up?' }))).status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', approved_at: null, approved_by: null, generation_inputs: expect.objectContaining({ warm_gmail_send_authorization: null, warm_gmail_send_slack_approval_request: null }) }))
  })
  it('blocks approving planner output without mutation', async () => {
    const update = setup({ id: 'draft-1', status: 'draft', body: 'Draft direction: warm follow-up', generation_inputs: {} })
    expect((await PATCH(request('approve'))).status).toBe(409)
    expect(update).not.toHaveBeenCalled()
  })
  it('blocks edits after an ambiguous provider attempt', async () => {
    const update = setup({ id: 'draft-1', status: 'approved', body: 'Old final copy', generation_inputs: { warm_gmail_send_execution: { status: 'sending' } } })
    expect((await PATCH(request('edit', { body: 'Revised message' }))).status).toBe(409)
    expect(update).not.toHaveBeenCalled()
  })
  it('reports concurrent edit instead of claiming success', async () => {
    setup({ id: 'draft-1', status: 'draft', body: 'Old final copy', generation_inputs: {} }, [])
    expect((await PATCH(request('edit', { body: 'Revised final copy' }))).status).toBe(409)
  })
  it.each(['approve', 'reject', 'edit'])('rejects %s from a stale displayed version without mutation', async (action) => {
    const update = setup({ id: 'draft-1', status: 'draft', body: 'Current copy', generation_inputs: {}, updated_at: '2026-09-08T12:02:00.000Z' })
    expect((await PATCH(request(action, { body: 'Changed copy' }))).status).toBe(409)
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['approve', 'reject', 'edit'])('uses updated_at CAS for %s and reports an intervening metadata/subject edit', async (action) => {
    const update = setup({ id: 'draft-1', status: 'draft', body: 'Current copy', generation_inputs: {} }, [])
    const response = await PATCH(request(action, { subject: 'Revised subject' }))
    expect(response.status).toBe(409)
    expect((update as unknown as { filters: ReturnType<typeof vi.fn> }).filters).toHaveBeenCalledWith('updated_at', VERSION)
    expect(await response.json()).toMatchObject({ changedIds: [], unchangedIds: ['draft-1'] })
  })
  it.each([{ body: 'Current copy', subject: {} }, { body: null, subject: 'Subject' }, { body: ['text'] }, { subject: 42 }])('rejects non-string copy fields without reopening a rejected draft: %j', async (updates) => {
    const update = setup({ id: 'draft-1', status: 'rejected', body: 'Current copy', subject: 'Subject', generation_inputs: {} })
    expect((await PATCH(request('edit', updates))).status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })
  it('does not reopen unchanged rejected copy', async () => {
    const update = setup({ id: 'draft-1', status: 'rejected', body: 'Current copy', subject: 'Subject', generation_inputs: {} })
    expect((await PATCH(request('edit', { body: 'Current copy', subject: 'Subject' }))).status).toBe(409)
    expect(update).not.toHaveBeenCalled()
  })
  it('reports a partial bulk result with exact changed and remaining IDs', async () => {
    const rows = ['draft-1', 'draft-2'].map(id => ({ id, status: 'draft', body: 'Reviewed copy', updated_at: VERSION }))
    mocks.from.mockReturnValueOnce({ select: () => ({ in: async () => ({ data: rows, error: null }) }) })
    let call = 0
    mocks.from.mockImplementation(() => ({ update: () => {
      const chain: Record<string, unknown> = {}
      for (const key of ['eq', 'select']) chain[key] = () => chain
      const changed = call++ === 0 ? [{ id: 'draft-1', updated_at: 'new-version' }] : []
      chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: changed, error: null })
      return chain
    } }))
    const response = await PATCH(new NextRequest('http://localhost/api/admin/outreach', { method: 'PATCH', body: JSON.stringify({ action: 'approve', ids: ['draft-1', 'draft-2'], expectedVersions: { 'draft-1': VERSION, 'draft-2': VERSION } }) }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ changedIds: ['draft-1'], unchangedIds: ['draft-2'], message: '1 of 2 items updated.' })
  })

})
