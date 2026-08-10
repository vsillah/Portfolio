import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrl: vi.fn(),
  projectForClient: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mocks.createSignedUrl,
      })),
    },
  },
}))

vi.mock('@/lib/implementation-feasibility', () => ({
  projectForClient: mocks.projectForClient,
}))

import { GET } from './route'

function makeRequest(code: string) {
  return new NextRequest(`http://localhost/api/proposals/by-code/${code}`, {
    method: 'GET',
  })
}

function params(code: string) {
  return { params: Promise.resolve({ code }) }
}

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    access_code: 'ABC123',
    status: 'sent',
    viewed_at: null,
    valid_until: null,
    value_assessment: { valueStatements: [{ text: 'Save time' }] },
    feasibility_assessment: {
      generated_at: '2026-08-01T00:00:00.000Z',
      overall_feasibility: 'high',
      estimated_complexity: 'small',
      stack_fit_summary: 'Strong fit',
      open_tradeoffs: [],
      items: [],
      admin_only_secret: 'strip-me',
    },
    ...overrides,
  }
}

describe('GET /api/proposals/by-code/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectForClient.mockReturnValue({
      headline: 'Strong fit',
      overall_fit_label: 'High',
    })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example.com/doc.pdf' },
      error: null,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 400 when the code param is empty', async () => {
    const response = await GET(makeRequest(''), params(''))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Access code is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when no proposal matches the normalized code', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const eq = vi.fn().mockReturnValue({ single })
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })

    const response = await GET(makeRequest('abc123'), params('abc123'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    expect(eq).toHaveBeenCalledWith('access_code', 'ABC123')
  })

  it('marks first view, strips admin feasibility, and exposes client flags/docs', async () => {
    const proposal = proposalRow()
    const proposalSingle = vi.fn().mockResolvedValue({ data: proposal, error: null })
    const proposalUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const proposalUpdate = vi.fn().mockReturnValue({ eq: proposalUpdateEq })

    const docsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'doc-1',
          document_type: 'strategy',
          title: 'Strategy PDF',
          file_path: 'proposal-docs/prop-1/a.pdf',
          display_order: 0,
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      error: null,
    })
    const docsEq = vi.fn().mockReturnValue({ order: docsOrder })
    const docsSelect = vi.fn().mockReturnValue({ eq: docsEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: proposalSingle }),
          }),
          update: proposalUpdate,
        }
      }
      if (table === 'proposal_documents') {
        return { select: docsSelect }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('abc123'), params('abc123'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(proposalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'viewed',
        viewed_at: expect.any(String),
      }),
    )
    expect(json.canAccept).toBe(true)
    expect(json.canPay).toBe(false)
    expect(json.isExpired).toBeFalsy()
    expect(json.hasValueAssessment).toBe(true)
    expect(json.proposal.status).toBe('viewed')
    expect(json.proposal.feasibility_assessment).toBeUndefined()
    expect(json.proposal.feasibility_view).toEqual({
      headline: 'Strong fit',
      overall_fit_label: 'High',
    })
    expect(mocks.projectForClient).toHaveBeenCalledWith(proposal.feasibility_assessment)
    expect(json.proposalDocuments).toEqual([
      {
        id: 'doc-1',
        document_type: 'strategy',
        title: 'Strategy PDF',
        created_at: '2026-08-01T00:00:00.000Z',
        signedUrl: 'https://signed.example.com/doc.pdf',
      },
    ])
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('proposal-docs/prop-1/a.pdf', 3600)
  })

  it('sets canAccept false and canPay true for expired vs accepted proposals', async () => {
    const expired = proposalRow({
      viewed_at: '2026-07-01T00:00:00.000Z',
      status: 'viewed',
      valid_until: '2020-01-01T00:00:00.000Z',
      feasibility_assessment: null,
      value_assessment: null,
    })
    const accepted = proposalRow({
      viewed_at: '2026-07-01T00:00:00.000Z',
      status: 'accepted',
      valid_until: null,
      feasibility_assessment: null,
      value_assessment: null,
    })

    const docsOrder = vi.fn().mockResolvedValue({ data: [], error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: expired, error: null }),
            }),
          }),
          update: vi.fn(),
        }
      }
      if (table === 'proposal_documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ order: docsOrder }),
          }),
        }
      }
      return {}
    })

    const expiredRes = await GET(makeRequest('ABC123'), params('ABC123'))
    const expiredJson = await expiredRes.json()
    expect(expiredJson.isExpired).toBeTruthy()
    expect(expiredJson.canAccept).toBe(false)
    expect(expiredJson.canPay).toBe(false)
    expect(expiredJson.hasValueAssessment).toBe(false)

    mocks.from.mockImplementation((table: string) => {
      if (table === 'proposals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: accepted, error: null }),
            }),
          }),
          update: vi.fn(),
        }
      }
      if (table === 'proposal_documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ order: docsOrder }),
          }),
        }
      }
      return {}
    })

    const acceptedRes = await GET(makeRequest('ABC123'), params('ABC123'))
    const acceptedJson = await acceptedRes.json()
    expect(acceptedJson.canAccept).toBe(false)
    expect(acceptedJson.canPay).toBe(true)
  })
})
