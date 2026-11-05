import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verifyAuth: vi.fn(), rpc: vi.fn(), load: vi.fn(), build: vi.fn(), project: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: mocks.verifyAuth, isAuthError: (value: object) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
vi.mock('@/lib/accelerated-quote-server', () => ({
  loadQuoteContext: mocks.load, buildRefinement: mocks.build,
  QuoteContextError: class QuoteContextError extends Error { status = 409 },
}))
vi.mock('@/lib/accelerated-quote-refinement', () => ({
  quoteQuestions: [{ id: 'delivery', label: 'Delivery', options: [['remote', 'Remote']] }],
  projectQuoteOffers: mocks.project,
}))
import { GET, POST } from './route'

const key = '11111111-1111-4111-8111-111111111111'
const request = (body: unknown) => new NextRequest('http://localhost/api/accelerated/member/quotes/refine', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

describe('member quote refinement API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'member-1' } })
    mocks.load.mockResolvedValue({ rec: { title: 'Reviewed service' }, derived: { summary: [], facts: {} },
      questions: ['delivery'], offers: [], latest: null, submitted: false })
    mocks.build.mockReturnValue({ projection: { status: 'candidates' }, packageData: { trusted: true }, payloadSha256: 'a'.repeat(64) })
    mocks.rpc.mockResolvedValue({ data: [{ refinement_id: key, revision: 1, replay: false }], error: null })
  })

  it('does not read or write without member authentication', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Sign in', status: 401 })
    expect((await GET(new NextRequest('http://localhost/api/accelerated/member/quotes/refine?orderId=1'))).status).toBe(401)
    expect((await POST(request({ orderId: 1 }))).status).toBe(401)
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('derives the saved package server-side and ignores a caller package', async () => {
    const response = await POST(request({ orderId: 1203, expectedRevision: 0, idempotencyKey: key,
      answers: { delivery: 'remote' }, context_package: { forged: true } }))
    expect(response.status).toBe(200)
    expect(mocks.build).toHaveBeenCalledWith(expect.anything(), { delivery: 'remote' })
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_save_quote_refinement', expect.objectContaining({
      p_user_id: 'member-1', p_order_id: 1203, p_context_package: { trusted: true },
    }))
  })

  it('blocks another save after contact submission', async () => {
    mocks.load.mockResolvedValue({ submitted: true })
    expect((await POST(request({ orderId: 1203, expectedRevision: 1, idempotencyKey: key, answers: {} }))).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
