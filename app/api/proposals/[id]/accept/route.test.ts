import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createCheckoutSession: vi.fn(),
  createInstallmentCheckoutSession: vi.fn(),
  findOrCreateStripeCustomer: vi.fn(),
  calculateInstallmentPlan: vi.fn(),
  getInstallmentFeePercent: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/stripe', () => ({
  createCheckoutSession: mocks.createCheckoutSession,
  createInstallmentCheckoutSession: mocks.createInstallmentCheckoutSession,
}))

vi.mock('@/lib/stripe-subscriptions', () => ({
  findOrCreateStripeCustomer: mocks.findOrCreateStripeCustomer,
}))

vi.mock('@/lib/installments', () => ({
  calculateInstallmentPlan: mocks.calculateInstallmentPlan,
  getInstallmentFeePercent: mocks.getInstallmentFeePercent,
}))

import { POST } from './route'

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/proposals/prop-1/accept', {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function params(id = 'prop-1') {
  return { params: Promise.resolve({ id }) }
}

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    status: 'sent',
    valid_until: null,
    signed_at: '2026-08-01T00:00:00.000Z',
    contract_pdf_url: null,
    contract_signed_at: null,
    total_amount: 5000,
    client_email: 'client@example.com',
    client_name: 'Client',
    bundle_name: 'Starter Bundle',
    bundle_id: 'bundle-1',
    sales_session_id: 'sess-1',
    access_code: 'ABC123',
    line_items: [{ title: 'Setup', description: 'Initial setup', price: 5000 }],
    discount_amount: 0,
    discount_description: null,
    ...overrides,
  }
}

function mockProposalLookup(proposal: ReturnType<typeof proposalRow> | null) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: proposal,
    error: proposal ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'proposals') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { select, update }
  })

  return { select, update, updateEq }
}

describe('POST /api/proposals/[id]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposalLookup(null)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects expired proposals before checkout', async () => {
    mockProposalLookup(
      proposalRow({ valid_until: '2020-01-01T00:00:00.000Z' }),
    )

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'This proposal has expired',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('requires the proposal to be signed before accepting', async () => {
    mockProposalLookup(proposalRow({ signed_at: null }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Proposal must be signed before accepting',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('requires a contract signature when a contract PDF is attached', async () => {
    mockProposalLookup(
      proposalRow({
        contract_pdf_url: 'https://example.com/contract.pdf',
        contract_signed_at: null,
      }),
    )

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Contract must be signed before payment. Please sign the Software Agreement and try again.',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects terminal proposal statuses that cannot be accepted', async () => {
    mockProposalLookup(proposalRow({ status: 'declined' }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Proposal cannot be accepted. Current status: declined',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('marks the proposal accepted and returns a pay-in-full checkout URL', async () => {
    const { update, updateEq } = mockProposalLookup(proposalRow({ status: 'viewed' }))
    mocks.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/cs_test_1',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      checkoutUrl: 'https://checkout.stripe.test/cs_test_1',
      checkoutSessionId: 'cs_test_1',
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        accepted_at: expect.any(String),
      }),
    )
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'prop-1',
        clientEmail: 'client@example.com',
        successUrl: expect.stringContaining('/proposal/ABC123?payment=success'),
      }),
    )
    // Second update persists the Stripe checkout session id
    expect(updateEq).toHaveBeenCalledWith('id', 'prop-1')
  })

  it('skips the status update when the proposal is already accepted', async () => {
    const { update } = mockProposalLookup(proposalRow({ status: 'accepted' }))
    mocks.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_2',
      url: 'https://checkout.stripe.test/cs_test_2',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    // Only the checkout-session id write should run — not the accept status flip
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      stripe_checkout_session_id: 'cs_test_2',
    })
  })
})
