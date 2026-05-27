import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  runChiefOfStaffChat: vi.fn(),
  recordAgentEvent: vi.fn(),
  claimAgentWorkItem: vi.fn(),
  getAgentWorkItem: vi.fn(),
  handoffAgentWorkItem: vi.fn(),
  markAgentWorkItemReadyForKanban: vi.fn(),
  recordAgentWorkItemBlocker: vi.fn(),
  routeAgentInboxItem: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/chief-of-staff-chat', () => ({
  runChiefOfStaffChat: mocks.runChiefOfStaffChat,
}))

vi.mock('@/lib/agent-run', () => ({
  recordAgentEvent: mocks.recordAgentEvent,
}))

vi.mock('@/lib/agent-work-items', () => ({
  claimAgentWorkItem: mocks.claimAgentWorkItem,
  getAgentWorkItem: mocks.getAgentWorkItem,
  handoffAgentWorkItem: mocks.handoffAgentWorkItem,
  markAgentWorkItemReadyForKanban: mocks.markAgentWorkItemReadyForKanban,
  recordAgentWorkItemBlocker: mocks.recordAgentWorkItemBlocker,
}))

vi.mock('@/lib/agent-inbox-routing', () => ({
  routeAgentInboxItem: mocks.routeAgentInboxItem,
}))

import { handleSlackAgentAction } from '@/lib/agent-slack-actions'

const ORIGINAL_ENV = process.env

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => query),
    insert: vi.fn(() => Promise.resolve(result)),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return query
}

function payload(value: Record<string, unknown>, userId = 'U123') {
  return {
    type: 'block_actions',
    user: { id: userId, username: 'vambah' },
    action_ts: '1716400000.000',
    container: { message_ts: '1716400000.000' },
    actions: [{ value: JSON.stringify(value) }],
  }
}

describe('Agent Ops Slack actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123',
    }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects unauthorized Slack users before mutation', async () => {
    const result = await handleSlackAgentAction(payload({ action: 'work.assign', workItemId: 'work-1', agentKey: 'chief-of-staff' }, 'U999'))

    expect(result.text).toContain('not configured')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires Portfolio review for high-risk approvals', async () => {
    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'approval-1',
          run_id: 'run-1',
          approval_type: 'n8n_workflow_activation',
          status: 'pending',
          metadata: { work_item_id: 'work-1' },
        },
        error: null,
      }))

    const result = await handleSlackAgentAction(payload({
      action: 'approval.approve',
      approvalId: 'approval-1',
      runId: 'run-1',
    }))

    expect(result.text).toContain('Portfolio review required')
    expect(mocks.from).toHaveBeenCalledWith('agent_approvals')
  })

  it('approves low-risk proposal approvals and records a Slack trace event', async () => {
    const approvalUpdate = queryResult({ error: null })
    const workItemUpdate = queryResult({ error: null })
    const runUpdate = queryResult({ error: null })

    mocks.from
      .mockReturnValueOnce(queryResult({ data: null, error: null }))
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'approval-1',
          run_id: 'run-1',
          approval_type: 'vercel_deployment_research_proposal',
          status: 'pending',
          metadata: { work_item_id: 'work-1' },
        },
        error: null,
      }))
      .mockReturnValueOnce(approvalUpdate)
      .mockReturnValueOnce(queryResult({ error: null }))
      .mockReturnValueOnce(workItemUpdate)
      .mockReturnValueOnce(queryResult({ data: [], error: null }))
      .mockReturnValueOnce(runUpdate)

    const result = await handleSlackAgentAction(payload({
      action: 'approval.approve',
      approvalId: 'approval-1',
      runId: 'run-1',
      note: 'Looks good from mobile.',
    }))

    expect(result.text).toContain('Approval approved from Slack')
    expect(approvalUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      decision_notes: 'Looks good from mobile.',
    }))
    expect(workItemUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'assigned',
      blocker_summary: null,
    }))
    expect(runUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'running',
      current_step: 'Approval granted from Slack',
    }))
  })

  it('assigns Kanban work items through the shared work-item service', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.claimAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Unowned blocker',
      active_run_id: 'run-1',
    })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })

    const result = await handleSlackAgentAction(payload({
      action: 'work.assign',
      workItemId: 'work-1',
      agentKey: 'integration-captain',
    }))

    expect(mocks.claimAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      ownerAgentKey: 'integration-captain',
      actorLabel: 'vambah',
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      eventType: 'slack_work_item_assigned',
    }))
    expect(result.text).toContain('Assigned to integration-captain')
  })

  it('records blocker acknowledgement without mutating the work item', async () => {
    mocks.from.mockReturnValueOnce(queryResult({ data: null, error: null }))
    mocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Blocked mobile action',
      active_run_id: 'run-1',
      source_run_id: null,
    })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })

    const result = await handleSlackAgentAction(payload({
      action: 'work.acknowledge',
      workItemId: 'work-1',
      note: 'Seen on mobile.',
    }))

    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      eventType: 'slack_work_item_blocker_acknowledged',
      metadata: expect.objectContaining({
        work_item_id: 'work-1',
        note: 'Seen on mobile.',
      }),
    }))
    expect(mocks.recordAgentWorkItemBlocker).not.toHaveBeenCalled()
    expect(result.text).toContain('Blocker acknowledged')
  })
})
