import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), read: vi.fn(), prepare: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: (value: { error?: string }) => Boolean(value.error) }))
vi.mock('@/lib/social-official-campaign-store', () => ({ readOfficialCampaignHandoff: mocks.read, prepareOfficialCampaignHandoff: mocks.prepare }))
import { GET, POST } from './route'

const request = (method: string, body?: unknown) => new NextRequest('http://localhost/api/admin/social-content/source-coverage/campaign-handoff', {
  method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
})

describe('exact official campaign handoff route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin' } })
    mocks.read.mockResolvedValue({ projection: { status: 'blocked', blockers: [{ code: 'official_review_pending' }], channel_reviews: [] }, backlog: null })
    mocks.prepare.mockResolvedValue({ projection: { status: 'blocked', blockers: [{ code: 'official_review_pending' }], channel_reviews: [] }, persistence: 'saved' })
  })
  it('returns read-only blockers without persisting', async () => {
    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ persistence: 'not_saved', review_only: true, projection: { status: 'blocked' } })
    expect(mocks.prepare).not.toHaveBeenCalled()
  })
  it('persists only the exact review-only action and never accepts embedded evidence', async () => {
    expect((await POST(request('POST', { action: 'approve', packet_ids: ['other'] }))).status).toBe(400)
    const response = await POST(request('POST', { action: 'prepare_review_only' }))
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ persistence: 'saved', projection: { status: 'blocked', channel_reviews: [] } })
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
  })
  it('requires admin access and fails closed on read/write errors', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Forbidden', status: 403 })
    expect((await GET(request('GET'))).status).toBe(403)
    mocks.read.mockRejectedValueOnce(new Error('database details'))
    const failedRead = await GET(request('GET'))
    expect(failedRead.status).toBe(503)
    expect(JSON.stringify(await failedRead.json())).not.toContain('database details')
    mocks.prepare.mockRejectedValueOnce(new Error('database details'))
    const failedWrite = await POST(request('POST', { action: 'prepare_review_only' }))
    expect(failedWrite.status).toBe(503)
    expect(JSON.stringify(await failedWrite.json())).not.toContain('database details')
  })
})
