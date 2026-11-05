import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verifyAuth: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: (value: object) => 'error' in value,
}))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
import { POST } from './route'

const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member/quotes/submit', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

describe('POST member quote submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'member-1', email: 'member@example.invalid' } })
  })

  it('requires a signed-in member and never calls the service RPC anonymously', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Sign in', status: 401 })
    const response = await POST(request({ orderId: 1203, name: 'Member', message: 'Scope' }))
    expect(response.status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('binds the structured order reference to the authenticated account email', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ contact_id: 82, replay: false }], error: null })
    const response = await POST(request({ orderId: 1203, name: 'Member', message: '  A scoped request  ', email: 'attacker@example.invalid' }))
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_submit_member_quote', {
      p_user_id: 'member-1', p_order_id: 1203, p_name: 'Member',
      p_email: 'member@example.invalid', p_message: 'A scoped request',
    })
    expect(await response.json()).toEqual({ orderId: 1203, contactId: 82, replay: false })
  })

  it('reports an idempotent replay without creating another contact', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ contact_id: 82, replay: true }], error: null })
    const response = await POST(request({ orderId: 1203, name: 'Member', message: 'Scope' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ contactId: 82, replay: true })
  })

  it('fails closed for another member or a stale quote order', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Quote order is unavailable for this member' } })
    const response = await POST(request({ orderId: 1203, name: 'Member', message: 'Scope' }))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Quote order is unavailable for this member' })
  })
})
