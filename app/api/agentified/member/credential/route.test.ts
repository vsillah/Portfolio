import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'

const mocks = vi.hoisted(() => ({ auth: { error: 'Authentication required' } as Record<string, unknown>, rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: vi.fn(async () => mocks.auth), isAuthError: (value: Record<string, unknown>) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }))
import { GET, POST } from './route'

const request = (body: unknown) => new NextRequest('http://localhost/api/agentified/member/credential', { method: 'POST', body: JSON.stringify(body) })
describe('Agentified completion identity', () => {
  beforeEach(() => { mocks.auth = { error: 'Authentication required' }; mocks.rpc.mockReset(); mocks.from.mockReset() })
  it('requires authentication for status and claim', async () => {
    expect((await GET(new NextRequest('http://localhost/api/agentified/member/credential'))).status).toBe(401)
    expect((await POST(request({ action: 'claim', name: 'Learner' }))).status).toBe(401)
  })
  it('claims through the existing credential RPC with the Agentified edition', async () => {
    mocks.auth = { user: { id: 'member-1' } }
    mocks.rpc.mockResolvedValue({ data: [{ learner_name: 'Learner', replay: false }] })
    const response = await POST(request({ action: 'claim', name: 'Learner' }))
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_claim_completion_credential', expect.objectContaining({ p_user_id: 'member-1', p_version: AGENTIFIED_VERSION }))
  })
  it('fails closed when another workshop edition is supplied by the browser', async () => {
    mocks.auth = { user: { id: 'member-1' } }
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Complete and save all sixteen lessons before claiming' } })
    expect((await POST(request({ action: 'claim', name: 'Learner', version: 'accelerated-l01-l16-ed73dee7' }))).status).toBe(409)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_claim_completion_credential', expect.objectContaining({ p_version: AGENTIFIED_VERSION }))
  })
})
