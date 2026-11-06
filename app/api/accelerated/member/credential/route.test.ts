import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: { error: 'Authentication required' } as Record<string, unknown>, rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: vi.fn(async () => mocks.auth), isAuthError: (value: Record<string, unknown>) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }))
import { GET, POST } from './route'

const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member/credential', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
describe('completion credential', () => {
  beforeEach(() => { mocks.auth = { error: 'Authentication required' }; mocks.rpc.mockReset(); mocks.from.mockReset() })
  it('keeps credential status and claim behind authentication', async () => {
    expect((await GET(new NextRequest('http://localhost/api/accelerated/member/credential'))).status).toBe(401)
    expect((await POST(request({ action: 'claim', name: 'Learner' }))).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('requires a fixed claim identity and database eligibility check', async () => {
    mocks.auth = { user: { id: 'member-1' } }
    expect((await POST(request({ action: 'claim', name: '' }))).status).toBe(400)
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Complete and save all sixteen lessons before claiming' } })
    expect((await POST(request({ action: 'claim', name: 'Learner' }))).status).toBe(409)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_claim_completion_credential', expect.objectContaining({ p_user_id: 'member-1', p_name: 'Learner' }))
  })
  it('rejects stale link changes and returns a revocation receipt', async () => {
    mocks.auth = { user: { id: 'member-1' } }
    expect((await POST(request({ action: 'revoke', expectedRevision: 0 }))).status).toBe(400)
    mocks.rpc.mockResolvedValueOnce({ error: { code: 'P0001', message: 'Credential link changed' } }).mockResolvedValueOnce({ data: [{ verification_token: null, revision: 2 }] })
    expect((await POST(request({ action: 'revoke', expectedRevision: 1 }))).status).toBe(409)
    expect((await POST(request({ action: 'revoke', expectedRevision: 1 }))).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_change_completion_link', expect.objectContaining({ p_action: 'revoke', p_token: null }))
  })
  it('keeps the legacy dashboard available before the credential migration reaches production', async () => {
    mocks.auth = { user: { id: 'member-1' } }
    const chain = { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: '42P01' } }), not: async () => ({ data: [], error: null }) }) }) }) }
    mocks.from.mockReturnValue(chain)
    const response = await GET(new NextRequest('http://localhost/api/accelerated/member/credential'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ available: false, credential: null })
  })
})
