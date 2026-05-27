import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  runAgentOpsMorningReview: vi.fn(),
  createAgentEngagementRun: vi.fn(),
  routeAgentInboxItem: vi.fn(),
  buildAgentMissionControlSnapshot: vi.fn(),
  runAgentWarRoom: vi.fn(),
  listAgentWorkItems: vi.fn(),
  getAgentWorkItem: vi.fn(),
  claimAgentWorkItem: vi.fn(),
  handoffAgentWorkItem: vi.fn(),
  getLatestMoremiMonitorReview: vi.fn(),
  createMoremiWarningWorkItems: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/agent-ops-morning-review', () => ({
  runAgentOpsMorningReview: mocks.runAgentOpsMorningReview,
}))

vi.mock('@/lib/agent-engagement', () => ({
  createAgentEngagementRun: mocks.createAgentEngagementRun,
}))

vi.mock('@/lib/agent-inbox-routing', () => ({
  routeAgentInboxItem: mocks.routeAgentInboxItem,
}))

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: mocks.buildAgentMissionControlSnapshot,
}))

vi.mock('@/lib/agent-war-room', () => ({
  runAgentWarRoom: mocks.runAgentWarRoom,
}))

vi.mock('@/lib/agent-work-items', () => ({
  listAgentWorkItems: mocks.listAgentWorkItems,
  getAgentWorkItem: mocks.getAgentWorkItem,
  claimAgentWorkItem: mocks.claimAgentWorkItem,
  handoffAgentWorkItem: mocks.handoffAgentWorkItem,
}))

vi.mock('@/lib/moremi-monitor-review', () => ({
  MOREMI_WARNING_WORK_ITEMS_CONFIRMATION: 'create_moremi_warning_work_items',
  getLatestMoremiMonitorReview: mocks.getLatestMoremiMonitorReview,
  createMoremiWarningWorkItems: mocks.createMoremiWarningWorkItems,
}))

import { buildApprovalsSlackResult } from '@/lib/agent-slack-command'

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return query
}

const lowRiskApproval = {
  id: 'approval-low',
  run_id: 'run-low',
  approval_type: 'vercel_deployment_research_proposal',
  status: 'pending',
  requested_at: '2026-05-27T10:00:00.000Z',
  metadata: {
    recommendation: 'Approve after verifying deployment evidence.',
  },
}

const highRiskApproval = {
  id: 'approval-high',
  run_id: 'run-high',
  approval_type: 'n8n_workflow_activation',
  status: 'pending',
  requested_at: '2026-05-27T10:01:00.000Z',
  metadata: {
    recommendation: 'Review credentials and workflow blast radius in Portfolio.',
  },
}

const runs = [
  {
    id: 'run-low',
    title: 'Vercel deployment research proposal',
    runtime: 'manual',
    status: 'waiting_for_approval',
    subject_label: null,
    current_step: 'Waiting on low-risk proposal approval',
    error_message: null,
    started_at: '2026-05-27T09:00:00.000Z',
  },
  {
    id: 'run-high',
    title: 'Activate production workflow',
    runtime: 'manual',
    status: 'waiting_for_approval',
    subject_label: null,
    current_step: 'Waiting on production workflow activation',
    error_message: null,
    started_at: '2026-05-27T09:05:00.000Z',
  },
]

function mockApprovalQueries() {
  const approvalsResult = { data: [lowRiskApproval, highRiskApproval], error: null }
  const runsResult = { data: runs, error: null }
  mocks.from
    .mockReturnValueOnce(queryResult(approvalsResult))
    .mockReturnValueOnce(queryResult(runsResult))
    .mockReturnValueOnce(queryResult(approvalsResult))
    .mockReturnValueOnce(queryResult(runsResult))
}

describe('Agent Ops Slack approval command blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes direct decision buttons only for low-risk approvals', async () => {
    mockApprovalQueries()

    const result = await buildApprovalsSlackResult()

    expect(result.responseType).toBe('ephemeral')
    expect(result.text).toContain('Pending agent approvals')
    expect(result.blocks).toBeDefined()

    const serializedBlocks = JSON.stringify(result.blocks)
    expect(serializedBlocks).toContain('approval.approve')
    expect(serializedBlocks).toContain('approval.reject')
    expect(serializedBlocks).toContain('approval.revision')
    expect(serializedBlocks).toContain('approval-low')
    expect(serializedBlocks).not.toContain('"approvalId":"approval-high"')
    expect(serializedBlocks).toContain('/admin/agents/runs/run-high')
    expect(serializedBlocks).toContain('Slack will not perform this action directly')
  })

  it('keeps high-risk approval action blocks to Ask Shaka and Open trace', async () => {
    mockApprovalQueries()

    const result = await buildApprovalsSlackResult()
    const highRiskSectionIndex = result.blocks?.findIndex((block) =>
      block.type === 'section' && JSON.stringify(block).includes('n8n_workflow_activation'),
    )
    expect(highRiskSectionIndex).toBeGreaterThanOrEqual(0)

    const highRiskActions = result.blocks?.[Number(highRiskSectionIndex) + 1]
    expect(highRiskActions).toMatchObject({
      type: 'actions',
      elements: [
        expect.objectContaining({ action_id: 'agent_approval_ask_shaka' }),
        expect.objectContaining({ action_id: 'agent_open_trace' }),
      ],
    })
    expect(JSON.stringify(highRiskActions)).not.toContain('agent_approval_approve')
    expect(JSON.stringify(highRiskActions)).not.toContain('agent_approval_decline')
    expect(JSON.stringify(highRiskActions)).not.toContain('agent_approval_revision')
  })
})
