import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
  createCheckoutSession: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: string }) => Boolean(value?.error),
}))

vi.mock('@/lib/stripe', () => ({
  createCheckoutSession: mocks.createCheckoutSession,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/stripe-test-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/stripe-test-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('rejects non-admin callers before creating a Stripe session', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })

    const response = await POST(makeRequest({ amount: 50 }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns 500 when Stripe is not configured', async () => {
    mocks.createCheckoutSession.mockResolvedValue(null)

    const response = await POST(makeRequest({}))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a checkout session and binds UUID proposals', async () => {
    const proposalId = '11111111-1111-4111-8111-111111111111'
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    })
    mocks.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/cs_test_1',
    })

    const response = await POST(makeRequest({ proposalId, amount: 75, email: 'qa@example.com' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      checkoutUrl: 'https://checkout.stripe.com/cs_test_1',
      checkoutSessionId: 'cs_test_1',
    })
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId,
        clientEmail: 'qa@example.com',
        lineItems: [
          expect.objectContaining({
            name: 'Test Automation Project',
            amount: 75,
          }),
        ],
      }),
    )
    expect(mocks.from).toHaveBeenCalledWith('proposals')
    expect(updateEq).toHaveBeenCalledWith('id', proposalId)
  })

  it('does not write a proposal row for non-UUID test ids', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_2',
      url: 'https://checkout.stripe.com/cs_test_2',
    })

    const response = await POST(makeRequest({ proposalId: 'test-local' }))

    expect(response.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
