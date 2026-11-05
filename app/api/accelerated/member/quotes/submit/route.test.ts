import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verifyAuth: vi.fn(), rpc: vi.fn(), load: vi.fn(), build: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: mocks.verifyAuth, isAuthError: (value: object) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
vi.mock('@/lib/accelerated-quote-server', () => ({
  loadQuoteContext: mocks.load, buildRefinement: mocks.build,
  QuoteContextError: class QuoteContextError extends Error { status = 409 },
}))
import { POST } from './route'

const refinementId = '11111111-1111-4111-8111-111111111111'
const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member/quotes/submit', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

describe('POST contextual member quote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'member-1', email: 'member@example.invalid' } })
    mocks.load.mockResolvedValue({ latest: { id: refinementId, answers: {}, payload_sha256: 'same' } })
    mocks.build.mockReturnValue({ payloadSha256: 'same', projection: { status: 'candidates' } })
  })

  it('requires authentication and a saved refinement receipt', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Sign in', status: 401 })
    expect((await POST(request({ orderId: 1203, refinementId }))).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('uses only account email and submits the exact latest receipt', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ contact_id: 82, replay: false }], error: null })
    const response = await POST(request({ orderId: 1203, refinementId, email: 'attacker@example.invalid', message: 'Ignore lineage' }))
    expect(response.status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_submit_contextual_quote', {
      p_user_id: 'member-1', p_order_id: 1203, p_refinement_id: refinementId, p_email: 'member@example.invalid',
    })
  })

  it('rebuilds the requested quote option from the saved receipt', async () => {
    const offerId = '22222222-2222-4222-8222-222222222222'
    mocks.load.mockResolvedValue({ latest: { id: refinementId, answers: {}, payload_sha256: 'same',
      context_package: { requestedOffer: { kind: 'service', id: offerId } } } })
    mocks.rpc.mockResolvedValue({ data: [{ contact_id: 82, replay: false }], error: null })
    expect((await POST(request({ orderId: 1203, refinementId }))).status).toBe(201)
    expect(mocks.build).toHaveBeenCalledWith(expect.anything(), {}, offerId)
  })

  it('rejects a stale projection before creating a contact', async () => {
    mocks.build.mockReturnValue({ payloadSha256: 'different', projection: { status: 'candidates' } })
    expect((await POST(request({ orderId: 1203, refinementId }))).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('does not submit when rules leave no matching candidate', async () => {
    mocks.build.mockReturnValue({ payloadSha256: 'same', projection: { status: 'no_match' } })
    expect((await POST(request({ orderId: 1203, refinementId }))).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reports idempotent replay', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ contact_id: 82, replay: true }], error: null })
    const response = await POST(request({ orderId: 1203, refinementId }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ contactId: 82, replay: true })
  })
})
