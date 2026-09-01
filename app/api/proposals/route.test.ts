import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/proposal-pdf', () => ({
  generateProposalPDF: vi.fn(),
}))

vi.mock('@/lib/contract-pdf', () => ({
  generateContractPDF: vi.fn(),
}))

vi.mock('@/lib/upsell-paths', () => ({
  getUpsellPathsForOffer: vi.fn(),
  formatUpsellAsProposalAddon: vi.fn(),
}))

vi.mock('@/lib/proposal-access-code', () => ({
  generateAccessCode: vi.fn(),
}))

vi.mock('@/lib/onboarding-preview-pdf', () => ({
  generateOnboardingPreviewPDF: vi.fn(),
}))

vi.mock('@/lib/ai-onboarding-generator', () => ({
  generateAIOnboardingContent: vi.fn(),
}))

vi.mock('@/lib/feasibility-snapshot', () => ({
  buildFeasibilitySnapshot: vi.fn(),
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  client_name: 'Ada Lovelace',
  client_email: 'ada@example.com',
  bundle_name: 'Implementation Sprint',
  line_items: [{ title: 'Sprint', price: 5000 }],
  total_amount: 5000,
}

describe('POST /api/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated creates before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires client, bundle, line items, and total amount', async () => {
    const response = await POST(
      makeRequest({
        client_name: 'Ada Lovelace',
        client_email: 'ada@example.com',
        bundle_name: 'Implementation Sprint',
        line_items: [{ title: 'Sprint' }],
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required fields: client_name, client_email, bundle_name, line_items, total_amount',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty client name before inserting', async () => {
    const response = await POST(
      makeRequest({
        ...validBody,
        client_name: '',
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('treats total_amount 0 as present and continues past required-field validation', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('past required-field validation')
    })

    const response = await POST(
      makeRequest({
        ...validBody,
        total_amount: 0,
      }),
    )

    expect(response.status).toBe(500)
    expect(mocks.from).toHaveBeenCalled()
  })
})
