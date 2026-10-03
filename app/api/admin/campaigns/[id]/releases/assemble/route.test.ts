import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (r: object) => 'error' in r }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { POST } from './route'
import { campaignSourceFingerprint, releaseHash } from '@/lib/campaign-release-manifest'
import { fixture } from '@/lib/campaign-release-test-fixture'
const m = fixture(), { actions, ...header } = m, { copy: _copy, source, ...binding } = actions[0]
const canonical = { id: source.id, campaign_id: m.campaignId, status: 'approved', platform: 'linkedin', post_text: 'Canonical', hashtags: [] }
const body = { ...header, selections: [{ ...binding, source: { table: source.table, id: source.id }, review: { sourceFingerprint: campaignSourceFingerprint(canonical), contentHash: releaseHash({ copy: { title: '', body: 'Canonical', metadata: { cta_text: '', cta_url: '', hashtags: '[]' } }, assets: binding.assets }), accountId: binding.accountId, recipientHash: releaseHash(binding.recipients), expiresAt: binding.evidenceExpiresAt } }] }
const ctx = { params: { id: m.campaignId } }
const request = (value: unknown = body) => new NextRequest('http://localhost/assemble', { method: 'POST', body: JSON.stringify(value) })
describe('read-only canonical assembly endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'synthetic-admin' } })
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: (_key: string, id: string) => ({ single: async () => ({ data: table === 'attraction_campaigns' ? { id, name: 'Synthetic' } : { id, campaign_id: m.campaignId, status: 'approved', platform: 'linkedin', post_text: 'Canonical', hashtags: [] }, error: null }) }) }), insert: mocks.insert, update: mocks.update }))
  })
  it('rejects unauthenticated callers before reading sources', async () => {
    mocks.auth.mockResolvedValue({ error: 'Sign in', status: 401 })
    expect((await POST(request(), ctx)).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rejects campaign mismatch before reading sources', async () => {
    expect((await POST(request({ ...body, campaignId: m.releaseId }), ctx)).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled()
  })
  it('returns a canonical packet without persistence or provider activation', async () => {
    const response = await POST(request(), ctx), result = await response.json()
    expect(response.status).toBe(200); expect(result.saved).toBe(false); expect(result.providerExecutionEnabled).toBe(false)
    expect(result.packet.manifest.actions[0].copy.body).toBe('Canonical')
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled()
  })
  it('fails closed on missing sources', async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'unavailable' } }) }) }) })
    expect((await POST(request(), ctx)).status).toBe(409)
  })
})
