import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  buildProposalRoadmapSnapshot: vi.fn(),
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

vi.mock('@/lib/client-ai-ops-roadmap', () => ({
  buildProposalRoadmapSnapshot: mocks.buildProposalRoadmapSnapshot,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(
    'http://localhost/api/admin/proposals/prop-1/implementation-roadmap',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(id = 'prop-1') {
  return { params: Promise.resolve({ id }) }
}

function mockProposalRoadmapFlow({
  proposal,
  updateError = null,
}: {
  proposal: {
    id: string
    client_name: string | null
    client_company: string | null
    sales_session_id: string | null
  } | null
  updateError?: { message: string } | null
}) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: proposal,
    error: proposal ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  const updateEq = vi.fn().mockResolvedValue({ error: updateError })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'proposals') throw new Error(`Unexpected table: ${table}`)
    return { select, update }
  })

  return { update, updateEq }
}

describe('POST /api/admin/proposals/[id]/implementation-roadmap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildProposalRoadmapSnapshot.mockReturnValue({
      phases: [{ title: 'Discover' }],
      costSummary: { total: 12000 },
    })
  })

  it('rejects unauthenticated requests before reading proposals', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.buildProposalRoadmapSnapshot).not.toHaveBeenCalled()
  })

  it('returns 404 when the proposal is missing', async () => {
    mockProposalRoadmapFlow({ proposal: null })

    const response = await POST(makeRequest({ stackSignals: ['n8n'] }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Proposal not found' })
    expect(mocks.buildProposalRoadmapSnapshot).not.toHaveBeenCalled()
  })

  it('builds and persists a roadmap snapshot from proposal + request inputs', async () => {
    const proposal = {
      id: 'prop-1',
      client_name: 'Neil',
      client_company: 'KMB',
      sales_session_id: 'sess-1',
    }
    const snapshot = {
      phases: [{ title: 'Implement' }],
      costSummary: { total: 18000 },
    }
    mocks.buildProposalRoadmapSnapshot.mockReturnValue(snapshot)
    const { update, updateEq } = mockProposalRoadmapFlow({ proposal })

    const response = await POST(
      makeRequest({
        stackSignals: ['supabase', 'n8n'],
        implementationRequirements: { mustHave: ['SSO'] },
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ snapshot })
    expect(mocks.buildProposalRoadmapSnapshot).toHaveBeenCalledWith({
      clientName: 'Neil',
      clientCompany: 'KMB',
      proposalId: 'prop-1',
      stackSignals: ['supabase', 'n8n'],
      implementationRequirements: { mustHave: ['SSO'] },
    })
    expect(update).toHaveBeenCalledWith({
      implementation_roadmap_snapshot: snapshot,
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'prop-1')
  })

  it('defaults missing body fields and reports persistence failures', async () => {
    const proposal = {
      id: 'prop-1',
      client_name: null,
      client_company: null,
      sales_session_id: null,
    }
    mockProposalRoadmapFlow({
      proposal,
      updateError: { message: 'write failed' },
    })

    const response = await POST(
      new NextRequest(
        'http://localhost/api/admin/proposals/prop-1/implementation-roadmap',
        { method: 'POST', body: 'not-json' },
      ),
      params(),
    )

    expect(mocks.buildProposalRoadmapSnapshot).toHaveBeenCalledWith({
      clientName: null,
      clientCompany: null,
      proposalId: 'prop-1',
      stackSignals: [],
      implementationRequirements: null,
    })
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to attach roadmap snapshot',
    })
  })
})
