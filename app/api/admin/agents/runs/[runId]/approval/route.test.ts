import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  approvalUpdate: vi.fn(),
  eventInsert: vi.fn(),
  runUpdate: vi.fn(),
  workItemUpdate: vi.fn(),
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

import { POST } from './route'

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/runs/run-1/approval', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function eqChain<T>(result: T) {
  const secondEq = vi.fn(() => result)
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  return { eq: firstEq }
}

function setupSupabase(existingMetadata: Record<string, unknown> = {}, approvalType = 'send_email') {
  const existingSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'approval-1',
      approval_type: approvalType,
      metadata: existingMetadata,
    },
    error: null,
  })
  const updateSingle = vi.fn().mockResolvedValue({ data: { id: 'approval-1' }, error: null })
  const pendingLimit = vi.fn().mockResolvedValue({ data: [], error: null })
  const select = vi.fn((columns: string) => {
    if (columns === 'id, approval_type, metadata') return { ...eqChain({ single: existingSingle }) }
    if (columns === 'id') return { ...eqChain({ limit: pendingLimit }) }
    return { ...eqChain({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
  })

  mocks.approvalUpdate.mockImplementation((payload) => ({
    ...eqChain({
      select: vi.fn(() => ({ single: updateSingle })),
    }),
    payload,
  }))
  mocks.eventInsert.mockResolvedValue({ data: { id: 'event-1' }, error: null })
  mocks.runUpdate.mockImplementation(() => ({
    eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })),
  }))
  mocks.workItemUpdate.mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }))
  mocks.from.mockImplementation((table: string) => {
    if (table === 'agent_approvals') {
      return {
        select,
        update: mocks.approvalUpdate,
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: updateSingle })) })),
      }
    }
    if (table === 'agent_run_events') return { insert: mocks.eventInsert }
    if (table === 'agent_runs') return { update: mocks.runUpdate }
    if (table === 'agent_work_items') return { update: mocks.workItemUpdate }
    return {}
  })
}

describe('POST /api/admin/agents/runs/[runId]/approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('preserves existing action payload metadata when deciding an approval', async () => {
    setupSupabase({
      source_run_id: 'chief-run-1',
      action_payload: {
        action: 'send_email',
        approval_type: 'send_email',
        executes_action: false,
      },
    })

    const response = await POST(makeRequest({
      approval_id: 'approval-1',
      status: 'approved',
      decision_notes: 'Approved after reviewing the payload.',
      metadata: {
        action_payload: { action: 'tampered' },
        reviewer_context: 'run detail',
      },
    }) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, approval_id: 'approval-1' })
    expect(mocks.approvalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      decided_by_user_id: 'admin-user',
      decision_notes: 'Approved after reviewing the payload.',
      metadata: expect.objectContaining({
        source_run_id: 'chief-run-1',
        action_payload: expect.objectContaining({
          action: 'send_email',
          executes_action: false,
        }),
        reviewer_context: 'run detail',
        decision: expect.objectContaining({
          status: 'approved',
          decision_notes: 'Approved after reviewing the payload.',
          decided_by_user_id: 'admin-user',
        }),
      }),
    }))
    expect(mocks.eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'approval_decided',
      metadata: expect.objectContaining({
        approval_id: 'approval-1',
        status: 'approved',
      }),
    }))
  })

  it('returns 404 when the approval id does not belong to the run', async () => {
    const existingSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({ ...eqChain({ single: existingSingle }) })),
    })

    const response = await POST(makeRequest({
      approval_id: 'missing-approval',
      status: 'approved',
    }) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Approval not found' })
    expect(mocks.approvalUpdate).not.toHaveBeenCalled()
  })

  it('blocks rejected Vercel AutoResearch proposals instead of advancing them', async () => {
    setupSupabase({
      work_item_id: 'work-1',
      proposal_id: 'next-build-profile',
    }, 'vercel_deployment_research_proposal')

    const response = await POST(makeRequest({
      approval_id: 'approval-1',
      status: 'rejected',
      decision_notes: 'Not worth the deployment risk.',
    }) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(200)
    expect(mocks.workItemUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      blocker_summary: 'Not worth the deployment risk.',
      validation_summary: 'Not worth the deployment risk.',
    }))
  })
})
