import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), get: vi.fn(), decide: vi.fn(), create: vi.fn(), blocks: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (r: object) => 'error' in r }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/campaign-release-store', () => ({ CAMPAIGN_RELEASE_KIND: 'campaign_release_manifest', getCampaignRelease: mocks.get, decideStoredCampaignRelease: mocks.decide, createCampaignRelease: mocks.create }))
vi.mock('@/lib/campaign-release-slack', () => ({ campaignReleaseSlackBlocks: mocks.blocks }))
import { GET, POST, PATCH } from './route'
import { fixture } from '@/lib/campaign-release-test-fixture'
const manifest = fixture(), ctx = { params: { id: manifest.campaignId } }
const req = (method: string, body?: unknown) => new NextRequest(`http://localhost/api/admin/campaigns/${manifest.campaignId}/releases`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
describe('campaign release API authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } }) })
  it('rejects unauthenticated reads and writes before touching storage', async () => {
    mocks.auth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    expect((await GET(req('GET'), ctx)).status).toBe(401)
    expect((await POST(req('POST', manifest), ctx)).status).toBe(401)
    expect((await PATCH(req('PATCH', {}), ctx)).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.decide).not.toHaveBeenCalled()
  })
  it('rejects cross-campaign creation', async () => {
    expect((await POST(req('POST', { ...manifest, campaignId: manifest.releaseId }), ctx)).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('loads an exact linked release and rejects cross-campaign links', async () => {
    const request = new NextRequest(`http://localhost/api/admin/campaigns/${manifest.campaignId}/releases?release=${manifest.releaseId}`)
    mocks.get.mockResolvedValue({ manifest })
    expect((await GET(request, ctx)).status).toBe(200)
    mocks.get.mockResolvedValue({ manifest: { ...manifest, campaignId: manifest.releaseId } })
    expect((await GET(request, ctx)).status).toBe(404)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rejects cross-campaign decisions and generic approval payloads', async () => {
    mocks.get.mockResolvedValue({ manifest: { campaignId: manifest.releaseId } })
    const body = { releaseId: manifest.releaseId, hash: 'a'.repeat(64), decision: 'approve' }
    expect((await PATCH(req('PATCH', body), ctx)).status).toBe(400)
    expect((await PATCH(req('PATCH', { decision: 'approve' }), ctx)).status).toBe(409)
    expect(mocks.decide).not.toHaveBeenCalled()
  })
  it('passes exact decision scope to canonical storage without dispatch', async () => {
    mocks.get.mockResolvedValue({ manifest }); mocks.decide.mockResolvedValue({ manifest, state: 'approved' })
    const body = { releaseId: manifest.releaseId, hash: 'a'.repeat(64), decision: 'approve' }
    const response = await PATCH(req('PATCH', body), ctx)
    expect(response.status).toBe(200)
    expect(mocks.decide).toHaveBeenCalledWith(manifest.releaseId, body.hash, 'approve', 'portfolio:admin-1')
    expect((await response.json()).providerExecutionEnabled).toBe(false)
  })
})
