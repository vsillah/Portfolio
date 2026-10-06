import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), prepare: vi.fn(), save: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (a: any) => Boolean(a.error) }))
vi.mock('@/lib/campaign-review-backlog', () => ({ getCampaignReviewBacklog: mocks.read, prepareCampaignReviewBatch: mocks.prepare, saveCampaignReviewCadence: mocks.save }))
import { GET, POST, PATCH } from './route'
const params = { params: { id: 'campaign' } }
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin' } }); mocks.read.mockResolvedValue({ ready: 0 }); mocks.prepare.mockResolvedValue({ prepared_count: 2 }); mocks.save.mockResolvedValue({}) })
it.each(['GET', 'POST', 'PATCH'])('rejects unauthenticated %s before data access', async method => {
  mocks.auth.mockResolvedValue({ error: 'Unauthorized', status: 401 })
  const r = await GET(new NextRequest('http://localhost/review', { method }), params)
  expect(r.status).toBe(401); expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled()
})
it('dispatches only explicit internal preparation, never arbitrary action names', async () => {
  expect((await POST(new NextRequest('http://localhost/review', { method: 'POST', body: JSON.stringify({ action: 'publish' }) }), params)).status).toBe(400)
  expect(mocks.prepare).not.toHaveBeenCalled()
  expect((await POST(new NextRequest('http://localhost/review', { method: 'POST', body: JSON.stringify({ action: 'prepare' }) }), params)).status).toBe(200)
  expect(mocks.prepare).toHaveBeenCalledWith('campaign')
})
it('saves config and exposes actionable persistence errors', async () => {
  await PATCH(new NextRequest('http://localhost/review', { method: 'PATCH', body: JSON.stringify({ config: { target_ready: 7 } }) }), params)
  expect(mocks.save).toHaveBeenCalledWith('campaign', { target_ready: 7 })
  mocks.read.mockRejectedValue(new Error('Calendar changed. Refresh.'))
  const r = await GET(new NextRequest('http://localhost/review'), params)
  expect(r.status).toBe(409); expect(await r.json()).toEqual({ error: 'Calendar changed. Refresh.' })
})
