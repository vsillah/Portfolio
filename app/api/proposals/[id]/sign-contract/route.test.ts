import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest('http://localhost/api/proposals/prop-1/sign-contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function params(id = 'prop-1') {
  return { params: Promise.resolve({ id }) }
}

function mockProposalLookup(
  proposal: {
    id: string
    status: string
    valid_until: string | null
    contract_pdf_url: string | null
    contract_signed_at: string | null
  } | null,
  updateError: { message: string } | null = null,
) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: proposal,
    error: proposal ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  const updateEq = vi.fn().mockResolvedValue({ error: updateError })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.from.mockReturnValue({ select, update })
  return { select, update, updateEq }
}

describe('POST /api/proposals/[id]/sign-contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires signed_by_name', async () => {
    const response = await POST(makeRequest({}), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'signed_by_name is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposalLookup(null)

    const response = await POST(makeRequest({ signed_by_name: 'Ada Client' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
  })

  it('rejects proposals without an attached contract PDF', async () => {
    mockProposalLookup({
      id: 'prop-1',
      status: 'sent',
      valid_until: null,
      contract_pdf_url: null,
      contract_signed_at: null,
    })

    const response = await POST(makeRequest({ signed_by_name: 'Ada Client' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No contract is attached to this proposal',
    })
  })

  it('is idempotent when the contract is already signed', async () => {
    const { update } = mockProposalLookup({
      id: 'prop-1',
      status: 'sent',
      valid_until: null,
      contract_pdf_url: 'https://example.com/contract.pdf',
      contract_signed_at: '2026-01-01T00:00:00.000Z',
    })

    const response = await POST(makeRequest({ signed_by_name: 'Ada Client' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      already_signed: true,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects proposals that are not in a signable status', async () => {
    mockProposalLookup({
      id: 'prop-1',
      status: 'accepted',
      valid_until: null,
      contract_pdf_url: 'https://example.com/contract.pdf',
      contract_signed_at: null,
    })

    const response = await POST(makeRequest({ signed_by_name: 'Ada Client' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Proposal cannot be signed. Current status: accepted',
    })
  })

  it('rejects expired proposals', async () => {
    mockProposalLookup({
      id: 'prop-1',
      status: 'viewed',
      valid_until: '2020-01-01T00:00:00.000Z',
      contract_pdf_url: 'https://example.com/contract.pdf',
      contract_signed_at: null,
    })

    const response = await POST(makeRequest({ signed_by_name: 'Ada Client' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'This proposal has expired',
    })
  })

  it('persists trimmed signer name and forwarded IP on first signature', async () => {
    const { update, updateEq } = mockProposalLookup({
      id: 'prop-1',
      status: 'draft',
      valid_until: null,
      contract_pdf_url: 'https://example.com/contract.pdf',
      contract_signed_at: null,
    })

    const response = await POST(
      makeRequest(
        { signed_by_name: '  Ada Client  ' },
        { 'x-forwarded-for': '198.51.100.20' },
      ),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        contract_signed_by_name: 'Ada Client',
        contract_signed_ip: '198.51.100.20',
        contract_signed_at: expect.any(String),
      }),
    )
    expect(updateEq).toHaveBeenCalledWith('id', 'prop-1')
  })
})
