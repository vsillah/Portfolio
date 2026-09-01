import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/proposals/p-1/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function params(id = 'p-1') {
  return { params: Promise.resolve({ id }) }
}

function mockProposal(proposal: Record<string, unknown> | null, updateError: unknown = null) {
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

describe('POST /api/proposals/[id]/sign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a signer name before looking up the proposal', async () => {
    const response = await POST(makeRequest({}), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'signed_by_name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposal(null)

    const response = await POST(makeRequest({ signed_by_name: 'Ada Lovelace' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
  })

  it('rejects signatures for paid or otherwise unsignable statuses', async () => {
    mockProposal({ id: 'p-1', status: 'paid', valid_until: '2099-01-01T00:00:00.000Z' })

    const response = await POST(makeRequest({ signed_by_name: 'Ada Lovelace' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Proposal cannot be signed. Current status: paid',
    })
  })

  it('rejects expired proposals', async () => {
    mockProposal({ id: 'p-1', status: 'sent', valid_until: '2020-01-01T00:00:00.000Z' })

    const response = await POST(makeRequest({ signed_by_name: 'Ada Lovelace' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'This proposal has expired' })
  })

  it('records the trimmed name, signature payload, and forwarded IP', async () => {
    const { update, updateEq } = mockProposal({
      id: 'p-1',
      status: 'viewed',
      valid_until: '2099-01-01T00:00:00.000Z',
    })

    const response = await POST(
      makeRequest(
        { signed_by_name: '  Ada Lovelace  ', signature_data: 'data:image/png;base64,abc' },
        { 'x-forwarded-for': '203.0.113.9' },
      ),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      signed_by_name: 'Ada Lovelace',
      signature_data: 'data:image/png;base64,abc',
      signed_ip: '203.0.113.9',
    }))
    expect(updateEq).toHaveBeenCalledWith('id', 'p-1')
  })
})
