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

import { GET, PATCH } from './route'

function makeGetRequest(id = 'prop-1') {
  return new NextRequest(`http://localhost/api/proposals/${id}`)
}

function makePatchRequest(body: Record<string, unknown>, id = 'prop-1') {
  return new NextRequest(`http://localhost/api/proposals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = 'prop-1') {
  return { params: Promise.resolve({ id }) }
}

function mockProposalGet({
  proposal,
  error = null,
}: {
  proposal: Record<string, unknown> | null
  error?: { message?: string } | null
}) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const single = vi.fn().mockResolvedValue({ data: proposal, error })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select, update })
  return { update, updateEq, eq }
}

describe('GET /api/proposals/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposalGet({ proposal: null, error: { message: 'not found' } })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
  })

  it('marks a sent proposal viewed on first open and reports acceptance gates', async () => {
    const { update } = mockProposalGet({
      proposal: {
        id: 'prop-1',
        status: 'sent',
        viewed_at: null,
        valid_until: '2099-01-01T00:00:00.000Z',
        value_assessment: null,
        feasibility_assessment: { secret: 'internal-only' },
      },
    })

    const response = await GET(makeGetRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.canAccept).toBe(true)
    expect(body.canPay).toBe(false)
    expect(body.isExpired).toBe(false)
    expect(body.hasValueAssessment).toBe(false)
    expect(body.proposal.status).toBe('viewed')
    expect(body.proposal.feasibility_assessment).toBeUndefined()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'viewed',
        viewed_at: expect.any(String),
      }),
    )
  })

  it('does not allow accepting an expired proposal and allows payment after accept', async () => {
    mockProposalGet({
      proposal: {
        id: 'prop-1',
        status: 'accepted',
        viewed_at: '2026-01-01T00:00:00.000Z',
        valid_until: '2020-01-01T00:00:00.000Z',
        value_assessment: {
          valueStatements: [{ painPoint: 'Manual ops', annualValue: 10000 }],
        },
      },
    })

    const response = await GET(makeGetRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isExpired).toBe(true)
    expect(body.canAccept).toBe(false)
    expect(body.canPay).toBe(true)
    expect(body.hasValueAssessment).toBe(true)
  })
})

describe('PATCH /api/proposals/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('allows public mark_viewed without admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const inFilter = vi.fn().mockResolvedValue({ error: null })
    const eq = vi.fn().mockReturnValue({ in: inFilter })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(makePatchRequest({ action: 'mark_viewed' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'viewed',
        viewed_at: expect.any(String),
      }),
    )
    expect(inFilter).toHaveBeenCalledWith('status', ['sent', 'draft'])
  })

  it('requires admin auth for mark_sent', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makePatchRequest({ action: 'mark_sent' }), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not persist status through the general field whitelist', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const single = vi.fn().mockResolvedValue({
      data: { id: 'prop-1', client_name: 'Ada', status: 'draft' },
      error: null,
    })
    const selectEq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq: selectEq })
    mocks.from.mockReturnValue({ update, select })

    const response = await PATCH(
      makePatchRequest({
        client_name: 'Ada',
        status: 'accepted',
        pdf_url: 'https://evil.example/rewrite.pdf',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({ client_name: 'Ada' })
  })
})
