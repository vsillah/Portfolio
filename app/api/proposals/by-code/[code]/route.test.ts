import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFeasibilityAssessment, type ProposedItemInput } from '@/lib/implementation-feasibility'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: () => ({
        createSignedUrl: mocks.createSignedUrl,
      }),
    },
  },
}))

import { GET } from './route'

function request(code: string) {
  return new NextRequest(`http://localhost/api/proposals/by-code/${encodeURIComponent(code)}`)
}

function params(code: string) {
  return { params: Promise.resolve({ code }) }
}

function mockProposalTables(options: {
  proposal: Record<string, unknown> | null
  proposalError?: unknown
  documents?: Array<Record<string, unknown>>
}) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: updateEq }))
  const accessEq = vi.fn()

  mocks.from.mockImplementation((table: string) => {
    if (table === 'proposals') {
      return {
        select: vi.fn(() => ({
          eq: (column: string, value: unknown) => {
            accessEq(column, value)
            return {
              single: vi.fn().mockResolvedValue({
                data: options.proposal,
                error: options.proposalError ?? (options.proposal ? null : { message: 'not found' }),
              }),
            }
          },
        })),
        update,
      }
    }

    if (table === 'proposal_documents') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: options.documents ?? [],
              error: null,
            }),
          })),
        })),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return { update, updateEq, accessEq }
}

const serviceItem = (
  content_id: string,
  title: string,
  tech_stack: ProposedItemInput['tech_stack'] = null,
): ProposedItemInput => ({
  content_type: 'service',
  content_id,
  title,
  tech_stack,
})

describe('GET /api/proposals/by-code/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/doc.pdf' } })
  })

  it('rejects an empty access code before querying', async () => {
    const response = await GET(request(''), params(''))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Access code is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('normalizes the access code to uppercase trimmed before lookup', async () => {
    const { accessEq } = mockProposalTables({ proposal: null })

    const response = await GET(request('  ab12cd  '), params('  ab12cd  '))

    expect(response.status).toBe(404)
    expect(accessEq).toHaveBeenCalledWith('access_code', 'AB12CD')
  })

  it('returns 404 when the access code does not resolve a proposal', async () => {
    mockProposalTables({ proposal: null, proposalError: { message: 'No rows' } })

    const response = await GET(request('MISSING'), params('MISSING'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Proposal not found' })
  })

  it('marks a first-view sent proposal as viewed and allows accept', async () => {
    const { update, updateEq } = mockProposalTables({
      proposal: {
        id: 'prop-1',
        access_code: 'AB12CD',
        status: 'sent',
        viewed_at: null,
        valid_until: '2099-01-01T00:00:00.000Z',
        value_assessment: { valueStatements: [{ id: 'v1' }] },
        feasibility_assessment: null,
      },
    })

    const response = await GET(request('ab12cd'), params('ab12cd'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'viewed',
      viewed_at: expect.any(String),
    }))
    expect(updateEq).toHaveBeenCalledWith('id', 'prop-1')
    expect(body.proposal.status).toBe('viewed')
    expect(body.proposal.feasibility_assessment).toBeUndefined()
    expect(body.canAccept).toBe(true)
    expect(body.canPay).toBe(false)
    expect(body.isExpired).toBe(false)
    expect(body.hasValueAssessment).toBe(true)
  })

  it('does not rewrite status on a subsequent view', async () => {
    const { update } = mockProposalTables({
      proposal: {
        id: 'prop-1',
        access_code: 'AB12CD',
        status: 'viewed',
        viewed_at: '2026-01-01T00:00:00.000Z',
        valid_until: '2099-01-01T00:00:00.000Z',
      },
    })

    const response = await GET(request('AB12CD'), params('AB12CD'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(update).not.toHaveBeenCalled()
    expect(body.proposal.status).toBe('viewed')
    expect(body.canAccept).toBe(true)
  })

  it('blocks accept on an expired proposal and allows pay only after accept', async () => {
    mockProposalTables({
      proposal: {
        id: 'prop-1',
        access_code: 'AB12CD',
        status: 'accepted',
        viewed_at: '2026-01-01T00:00:00.000Z',
        valid_until: '2020-01-01T00:00:00.000Z',
      },
    })

    const response = await GET(request('AB12CD'), params('AB12CD'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isExpired).toBe(true)
    expect(body.canAccept).toBe(false)
    expect(body.canPay).toBe(true)
  })

  it('projects feasibility for the client and strips the admin snapshot', async () => {
    const snapshot = buildFeasibilityAssessment({
      proposedItems: [
        serviceItem('s1', 'Payments', {
          platform: ['Stripe'],
          integrations: [{ system: 'n8n', direction: 'outbound', method: 'webhook' }],
        }),
      ],
      bundle: { id: 'b1' },
      clientStack: {},
    })

    mockProposalTables({
      proposal: {
        id: 'prop-1',
        access_code: 'AB12CD',
        status: 'viewed',
        viewed_at: '2026-01-01T00:00:00.000Z',
        feasibility_assessment: snapshot,
      },
    })

    const response = await GET(request('AB12CD'), params('AB12CD'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.feasibility_assessment).toBeUndefined()
    expect(body.proposal.feasibility_view).toMatchObject({
      items: [expect.objectContaining({ title: 'Payments' })],
    })
    expect(JSON.stringify(body)).not.toContain('conflicts')
  })

  it('attaches signed document URLs and survives a bad feasibility snapshot', async () => {
    mockProposalTables({
      proposal: {
        id: 'prop-1',
        access_code: 'AB12CD',
        status: 'viewed',
        viewed_at: '2026-01-01T00:00:00.000Z',
        feasibility_assessment: { generated_at: 'not-a-snapshot' },
      },
      documents: [
        {
          id: 'doc-1',
          document_type: 'strategy',
          title: 'Strategy memo',
          file_path: 'proposal-docs/prop-1/a.pdf',
          display_order: 0,
          created_at: '2026-01-02T00:00:00.000Z',
        },
      ],
    })

    const response = await GET(request('AB12CD'), params('AB12CD'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proposal.feasibility_view).toBeNull()
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('proposal-docs/prop-1/a.pdf', 3600)
    expect(body.proposalDocuments).toEqual([
      {
        id: 'doc-1',
        document_type: 'strategy',
        title: 'Strategy memo',
        created_at: '2026-01-02T00:00:00.000Z',
        signedUrl: 'https://signed.example/doc.pdf',
      },
    ])
  })
})
