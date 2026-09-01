import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  return new NextRequest('http://localhost/api/proposals/p-1/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function params(id = 'p-1') {
  return { params: Promise.resolve({ id }) }
}

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    status: 'sent',
    signed_at: '2026-08-01T00:00:00.000Z',
    contract_pdf_url: null,
    contract_signed_at: null,
    valid_until: '2099-01-01T00:00:00.000Z',
    client_email: 'client@example.com',
    client_name: 'Client Name',
    bundle_name: 'Advisory Bundle',
    total_amount: 2500,
    discount_amount: 0,
    discount_description: null,
    access_code: 'code-1',
    sales_session_id: null,
    bundle_id: null,
    line_items: [{ title: 'Advisory', description: 'Kickoff', price: 2500 }],
    ...overrides,
  }
}

function mockProposalLookup(proposal: Record<string, unknown> | null, updateError: unknown = null) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: proposal,
    error: proposal ? null : { message: 'missing' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })
  const updateEq = vi.fn().mockResolvedValue({ error: updateError })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'proposals') throw new Error(`Unexpected table: ${table}`)
    return { select, update }
  })
  return { select, update, updateEq }
}

describe('POST /api/proposals/[id]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.createCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/cs_123',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposalLookup(null)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects expired proposals before creating a Stripe session', async () => {
    mockProposalLookup(proposalRow({ valid_until: '2020-01-01T00:00:00.000Z' }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'This proposal has expired' })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('requires the proposal to be signed before accept', async () => {
    mockProposalLookup(proposalRow({ signed_at: null }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Proposal must be signed before accepting',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('requires the attached contract to be signed before payment', async () => {
    mockProposalLookup(proposalRow({
      contract_pdf_url: 'https://files.example.com/contract.pdf',
      contract_signed_at: null,
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Contract must be signed before payment. Please sign the Software Agreement and try again.',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('rejects proposals that are not in an acceptable status', async () => {
    mockProposalLookup(proposalRow({ status: 'paid' }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Proposal cannot be accepted. Current status: paid',
    })
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('marks a signed proposal accepted and returns the Stripe checkout URL', async () => {
    const { update } = mockProposalLookup(proposalRow())

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      checkoutUrl: 'https://checkout.stripe.com/cs_123',
      checkoutSessionId: 'cs_123',
    })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'accepted',
    }))
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: 'p-1',
      clientEmail: 'client@example.com',
      successUrl: 'http://localhost/proposal/code-1?payment=success',
      cancelUrl: 'http://localhost/proposal/code-1?payment=cancelled',
    }))
    expect(mocks.createInstallmentCheckoutSession).not.toHaveBeenCalled()
  })
})
