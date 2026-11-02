// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), projection: vi.fn(), route: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (v: any) => Boolean(v.error) }))
vi.mock('@/lib/campaign-slack-bridge', () => ({ campaignSlackProjection: mocks.projection, routeCampaignToSlack: mocks.route }))
import { GET, POST } from './route'
const releaseId = '11111111-1111-4111-8111-111111111111'
const context = { params: { id: 'campaign-1' } }
const body = { releaseId, hash: 'a'.repeat(64), version: 1, dispatch: false }
const request = (data = body) => new NextRequest('https://example.invalid/api?release=' + releaseId, { method: 'POST', body: JSON.stringify(data) })
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } }); mocks.route.mockResolvedValue({ sent: false, intent: { state: 'prepared' } }); mocks.projection.mockResolvedValue({ receipts: [] }) })
it.each([401, 403])('requires admin for reads and writes (%s)', async status => {
  mocks.auth.mockResolvedValue({ error: 'Denied', status })
  expect((await GET(request(), context)).status).toBe(status); expect((await POST(request(), context)).status).toBe(status)
  expect(mocks.route).not.toHaveBeenCalled(); expect(mocks.projection).not.toHaveBeenCalled()
})
it('passes authenticated actor and campaign scope, never client actor', async () => {
  const result = await POST(request(), context)
  expect(mocks.route).toHaveBeenCalledWith({ ...body, campaignId: 'campaign-1', actor: 'admin-1' })
  expect(await result.json()).toMatchObject({ sent: false, providerExecutionEnabled: false })
})
it.each([{ ...body, actor: 'forged' }, { ...body, version: 0 }, { ...body, releaseId: 'bad' }, { ...body, hash: 'bad' }, { ...body, dispatch: 'true' }])('rejects malformed input %j', async input => {
  expect((await POST(request(input as typeof body), context)).status).toBe(409); expect(mocks.route).not.toHaveBeenCalled()
})
it('scopes reads and reports storage failure without false success', async () => {
  expect((await GET(request(), context)).status).toBe(200); expect(mocks.projection).toHaveBeenCalledWith('campaign-1', releaseId)
  mocks.projection.mockRejectedValue(new Error('unavailable')); expect((await GET(request(), context)).status).toBe(503)
  mocks.route.mockRejectedValue(new Error('database password=secret-token')); const failed = await POST(request(), context)
  expect(failed.status).toBe(409); expect(await failed.json()).toEqual({ error: 'Slack request unconfirmed. Refresh the release and receipt before retrying.' })
})
it('hides an invalid release id instead of querying storage', async () => {
  const missing = await GET(new NextRequest('https://example.invalid/api'), context)
  const malformed = await GET(new NextRequest('https://example.invalid/api?release=not-a-uuid'), context)
  expect(missing.status).toBe(503); expect(malformed.status).toBe(503)
  expect(await malformed.json()).toEqual({ error: 'Slack outcome unavailable. Refresh before retrying.' })
  expect(mocks.projection).not.toHaveBeenCalled()
})
