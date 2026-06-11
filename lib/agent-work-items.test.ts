import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  maybeSingleQueue: [] as Array<{ data: unknown; error: unknown }>,
  singleQueue: [] as Array<{ data: unknown; error: unknown }>,
  listQueue: [] as Array<{ data: unknown; error: unknown }>,
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  runAgentSlackNotificationSweep: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.fromMock,
  },
}))

vi.mock('@/lib/agent-run', () => ({
  AGENT_RUNTIMES: ['codex', 'n8n', 'hermes', 'opencode', 'manual'],
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
}))

vi.mock('@/lib/agent-slack-notification-sweep', () => ({
  runAgentSlackNotificationSweep: mocks.runAgentSlackNotificationSweep,
}))

import {
  attachAgentWorkItemPr,
  cancelAgentWorkItem,
  claimAgentWorkItem,
  createAgentWorkItem,
  handoffAgentWorkItem,
  listAgentWorkItems,
  recordAgentWorkItemBlocker,
  recordAgentWorkItemMcpBuildResult,
  recordAgentWorkItemValidation,
  requestAgentWorkItemMcpBuild,
  requestAgentWorkItemN8nActivationReview,
} from './agent-work-items'

function chain() {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    order: vi.fn(() => api),
    limit: vi.fn(() => Promise.resolve(mocks.listQueue.shift() ?? { data: [], error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(mocks.maybeSingleQueue.shift() ?? { data: null, error: null })),
    single: vi.fn(() => Promise.resolve(mocks.singleQueue.shift() ?? { data: { id: 'row-id' }, error: null })),
    insert: mocks.insertMock.mockImplementation(() => api),
    update: mocks.updateMock.mockImplementation(() => api),
  }
  return api
}

const baseItem = {
  id: 'work-1',
  title: 'Coordinate feature',
  objective: 'Build the coordination layer',
  status: 'queued',
  priority: 'medium',
  owner_agent_key: 'chief-of-staff',
  owner_runtime: 'codex',
  source_type: null,
  source_id: null,
  source_label: null,
  source_run_id: null,
  active_run_id: 'run-1',
  parent_work_item_id: null,
  branch_name: null,
  worktree_path: null,
  pr_number: null,
  pr_url: null,
  expected_files: [],
  touched_files: [],
  overlap_group: null,
  dependency_ids: [],
  blocker_summary: null,
  validation_summary: null,
  approval_id: null,
  metadata: {},
  idempotency_key: null,
  created_at: '2026-05-09T00:00:00.000Z',
  updated_at: '2026-05-09T00:00:00.000Z',
  completed_at: null,
}

function queueExistingItem(item: unknown = baseItem) {
  mocks.maybeSingleQueue.push({ data: item, error: null })
  mocks.listQueue.push({ data: [], error: null })
}

describe('agent work item helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.maybeSingleQueue = []
    mocks.singleQueue = []
    mocks.listQueue = []
    mocks.fromMock.mockImplementation(() => chain())
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({ ok: true, sentCount: 1 })
  })

  it('creates a trace-linked work item', async () => {
    mocks.maybeSingleQueue.push({ data: null, error: null })
    mocks.singleQueue.push({ data: { ...baseItem, id: 'work-1' }, error: null })

    const result = await createAgentWorkItem({
      title: 'Coordinate feature',
      objective: 'Build the coordination layer',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      expectedFiles: ['lib/agent-work-items.ts'],
      idempotencyKey: 'coordination:1',
    })

    expect(result.id).toBe('work-1')
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'agent_work_item',
      runtime: 'codex',
      status: 'queued',
    }))
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      active_run_id: 'run-1',
      expected_files: ['lib/agent-work-items.ts'],
      idempotency_key: 'coordination:1',
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'agent_work_item_created',
    }))
  })

  it('returns an existing idempotent work item', async () => {
    mocks.maybeSingleQueue.push({ data: baseItem, error: null })

    const result = await createAgentWorkItem({
      title: 'Coordinate feature',
      objective: 'Build the coordination layer',
      idempotencyKey: 'coordination:1',
    })

    expect(result.id).toBe('work-1')
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('lists work items with optional filters', async () => {
    mocks.listQueue.push({ data: [baseItem], error: null })

    const result = await listAgentWorkItems({ status: 'queued', ownerAgentKey: 'chief-of-staff' })

    expect(result).toHaveLength(1)
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_work_items')
  })

  it('claims, blocks, attaches PRs, and cancels work items', async () => {
    queueExistingItem()
    mocks.singleQueue.push({ data: { ...baseItem, status: 'assigned' }, error: null })
    await expect(claimAgentWorkItem({ id: 'work-1', ownerAgentKey: 'chief-of-staff' })).resolves.toMatchObject({ status: 'assigned' })

    queueExistingItem()
    mocks.singleQueue.push({ data: { ...baseItem, status: 'blocked', blocker_summary: 'blocked' }, error: null })
    await expect(recordAgentWorkItemBlocker({ id: 'work-1', blockerSummary: 'blocked' })).resolves.toMatchObject({ status: 'blocked' })

    queueExistingItem()
    mocks.singleQueue.push({ data: { ...baseItem, status: 'ready_for_review', pr_number: 12 }, error: null })
    await expect(attachAgentWorkItemPr({ id: 'work-1', prNumber: 12, touchedFiles: ['lib/a.ts'] })).resolves.toMatchObject({ pr_number: 12 })

    queueExistingItem()
    mocks.singleQueue.push({ data: { ...baseItem, status: 'cancelled' }, error: null })
    await expect(cancelAgentWorkItem({ id: 'work-1', reason: 'duplicate' })).resolves.toMatchObject({ status: 'cancelled' })
  })

  it('refreshes shared goal orchestration metadata when a child work item changes', async () => {
    const parent = {
      ...baseItem,
      id: 'goal-parent',
      metadata: {
        goal_id: 'goal-v2',
        goal_type: 'general',
        goal_role: 'parent',
        approval_boundary: 'Human approval remains final.',
      },
    }
    const child = {
      ...baseItem,
      id: 'goal-child',
      parent_work_item_id: 'goal-parent',
      metadata: {
        goal_id: 'goal-v2',
        goal_type: 'general',
        goal_role: 'task',
        goal_parent_work_item_id: 'goal-parent',
        orchestration_gate: 'draft_build',
      },
    }
    const blockedChild = {
      ...child,
      status: 'blocked',
      blocker_summary: 'Implementation evidence is missing.',
    }

    mocks.maybeSingleQueue.push(
      { data: child, error: null },
      { data: parent, error: null },
    )
    mocks.listQueue.push(
      { data: [], error: null },
      { data: [blockedChild], error: null },
    )
    mocks.singleQueue.push({ data: blockedChild, error: null })

    await expect(recordAgentWorkItemBlocker({
      id: 'goal-child',
      blockerSummary: 'Implementation evidence is missing.',
    })).resolves.toMatchObject({ status: 'blocked' })

    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        current_gate: 'draft_build',
        gate_status: 'blocked',
        pass_to_human: false,
        residual_risks_for_human: ['Implementation evidence is missing.'],
      }),
    }))
  })

  it('creates an approval checkpoint when validation marks work ready for merge', async () => {
    queueExistingItem()
    mocks.singleQueue.push(
      { data: { id: 'approval-1' }, error: null },
      { data: { ...baseItem, status: 'ready_for_merge', approval_id: 'approval-1' }, error: null },
    )

    const result = await recordAgentWorkItemValidation({
      id: 'work-1',
      validationSummary: 'Tests passed',
      readyForMerge: true,
    })

    expect(result.status).toBe('ready_for_merge')
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_approvals')
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'waiting_for_approval',
    }))
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith({
      mode: 'immediate',
      kinds: ['pending_approvals'],
      actorLabel: 'Agent Ops approval checkpoint',
      triggerSource: 'agent_work_item_approval_created',
    })
  })

  it('records MCP build requests without activating external workflows', async () => {
    queueExistingItem({
      ...baseItem,
      status: 'proposed',
      metadata: {
        mcp_handoff_packet: {
          version: 'agent-ops-n8n-mcp-handoff/v1',
        },
      },
    })
    mocks.singleQueue.push({
      data: {
        ...baseItem,
        status: 'queued',
        validation_summary: 'Create inactive staging workflow from the handoff packet.',
        metadata: {
          mcp_handoff_packet: { version: 'agent-ops-n8n-mcp-handoff/v1' },
          mcp_build_request: {
            requested: true,
            packet_version: 'agent-ops-n8n-mcp-handoff/v1',
          },
        },
      },
      error: null,
    })

    const result = await requestAgentWorkItemMcpBuild({
      id: 'work-1',
      requestSummary: 'Create inactive staging workflow from the handoff packet.',
      actorLabel: 'admin@example.com',
    })

    expect(result.status).toBe('queued')
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'queued',
      validation_summary: 'Create inactive staging workflow from the handoff packet.',
      metadata: expect.objectContaining({
        mcp_build_request: expect.objectContaining({
          requested: true,
          actor_label: 'admin@example.com',
          expected_return: expect.arrayContaining(['n8n workflow id or inspection result']),
        }),
      }),
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'agent_work_item_mcp_build_requested',
      message: 'Create inactive staging workflow from the handoff packet.',
    }))
  })

  it('records MCP build results and blocks work when gaps remain', async () => {
    queueExistingItem({
      ...baseItem,
      status: 'queued',
      metadata: {
        mcp_build_request: {
          requested: true,
          requested_at: '2026-05-09T01:00:00.000Z',
        },
      },
    })
    mocks.singleQueue.push({
      data: {
        ...baseItem,
        status: 'blocked',
        blocker_summary: 'MCP build returned unresolved gaps: N8N_INGEST_SECRET',
        validation_summary: 'Inactive staging workflow was created but cannot run until secrets are mapped.',
        metadata: {
          mcp_build_request: { requested: true },
          mcp_build_result: {
            recorded: true,
            workflow_id: 'wf_123',
            env_gaps: ['N8N_INGEST_SECRET'],
          },
        },
      },
      error: null,
    })

    const result = await recordAgentWorkItemMcpBuildResult({
      id: 'work-1',
      resultSummary: 'Inactive staging workflow was created but cannot run until secrets are mapped.',
      workflowId: 'wf_123',
      validationResult: 'Inspection passed; dry run blocked by missing env.',
      testEvidence: 'Fixture dry run stopped before outbound execution.',
      envGaps: ['N8N_INGEST_SECRET'],
      rollbackNotes: 'Delete inactive workflow wf_123.',
      activationRequested: true,
      actorLabel: 'admin@example.com',
    })

    expect(result.status).toBe('blocked')
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      blocker_summary: 'MCP build returned unresolved gaps: N8N_INGEST_SECRET',
      validation_summary: 'Inactive staging workflow was created but cannot run until secrets are mapped.',
      metadata: expect.objectContaining({
        mcp_build_request: expect.objectContaining({ requested: true }),
        mcp_build_result: expect.objectContaining({
          workflow_id: 'wf_123',
          env_gaps: ['N8N_INGEST_SECRET'],
          activation_requested: true,
          activation_gate: expect.stringContaining('approval-gated'),
        }),
      }),
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'agent_work_item_mcp_build_result_recorded',
      message: 'Inactive staging workflow was created but cannot run until secrets are mapped.',
    }))
  })

  it('marks MCP build results ready for review when no gaps remain', async () => {
    queueExistingItem({ ...baseItem, status: 'queued' })
    mocks.singleQueue.push({
      data: {
        ...baseItem,
        status: 'ready_for_review',
        validation_summary: 'Inactive workflow passed dry-run validation.',
        metadata: {
          mcp_build_result: {
            recorded: true,
            workflow_id: 'wf_456',
            credential_gaps: [],
            env_gaps: [],
          },
        },
      },
      error: null,
    })

    const result = await recordAgentWorkItemMcpBuildResult({
      id: 'work-1',
      resultSummary: 'Inactive workflow passed dry-run validation.',
      workflowId: 'wf_456',
      validationResult: 'Dry run passed.',
      testEvidence: 'No outbound calls were made.',
      credentialGaps: [],
      envGaps: [],
    })

    expect(result.status).toBe('ready_for_review')
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ready_for_review',
      blocker_summary: null,
    }))
  })

  it('rejects MCP build results for terminal work items', async () => {
    queueExistingItem({ ...baseItem, status: 'deployed' })

    await expect(recordAgentWorkItemMcpBuildResult({
      id: 'work-1',
      resultSummary: 'Workflow result arrived after deployment.',
      workflowId: 'wf_456',
    })).rejects.toThrow('Cannot record MCP build result for deployed work item')

    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('requests n8n activation review only after a clean MCP build result', async () => {
    queueExistingItem({
      ...baseItem,
      status: 'ready_for_review',
      metadata: {
        mcp_build_result: {
          recorded: true,
          result_summary: 'Inactive workflow passed dry-run validation.',
          workflow_id: 'wf_456',
          validation_result: 'Dry run passed.',
          test_evidence: 'Synthetic fixture completed without outbound sends.',
          credential_gaps: [],
          env_gaps: [],
          rollback_notes: 'Disable or delete inactive workflow wf_456.',
        },
      },
    })
    mocks.singleQueue.push(
      { data: { id: 'approval-n8n-1' }, error: null },
      {
        data: {
          ...baseItem,
          status: 'ready_for_review',
          validation_summary: 'Review inactive workflow evidence before any activation decision.',
          approval_id: 'approval-n8n-1',
          metadata: {
            mcp_build_result: { recorded: true, workflow_id: 'wf_456' },
            n8n_activation_review_request: {
              requested: true,
              workflow_id: 'wf_456',
              approval_id: 'approval-n8n-1',
              approval_type: 'n8n_workflow_activation',
            },
          },
        },
        error: null,
      },
    )

    const result = await requestAgentWorkItemN8nActivationReview({
      id: 'work-1',
      reviewSummary: 'Review inactive workflow evidence before any activation decision.',
      actorLabel: 'admin@example.com',
    })

    expect(result.status).toBe('ready_for_review')
    expect(result.approval_id).toBe('approval-n8n-1')
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_approvals')
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      run_id: 'run-1',
      approval_type: 'n8n_workflow_activation',
      status: 'pending',
      requested_by_agent_key: 'chief-of-staff',
      metadata: expect.objectContaining({
        work_item_id: 'work-1',
        workflow_id: 'wf_456',
        validation_result: 'Dry run passed.',
        test_evidence: 'Synthetic fixture completed without outbound sends.',
        rollback_notes: 'Disable or delete inactive workflow wf_456.',
        action_payload: expect.objectContaining({
          action: 'review_n8n_workflow_activation',
          non_mutating: true,
        }),
      }),
    }))
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'waiting_for_approval',
      current_step: 'Approval required: n8n workflow activation',
    }))
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith({
      mode: 'immediate',
      kinds: ['pending_approvals'],
      actorLabel: 'admin@example.com',
      triggerSource: 'agent_work_item_n8n_activation_approval_created',
    })
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ready_for_review',
      blocker_summary: null,
      validation_summary: 'Review inactive workflow evidence before any activation decision.',
      approval_id: 'approval-n8n-1',
      metadata: expect.objectContaining({
        n8n_activation_review_request: expect.objectContaining({
          requested: true,
          actor_label: 'admin@example.com',
          approval_id: 'approval-n8n-1',
          approval_type: 'n8n_workflow_activation',
          workflow_id: 'wf_456',
          approval_boundary: expect.arrayContaining([
            expect.stringContaining('No n8n workflow is activated'),
          ]),
        }),
      }),
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'agent_work_item_n8n_activation_review_requested',
      message: 'Review inactive workflow evidence before any activation decision.',
      metadata: expect.objectContaining({
        approval_id: 'approval-n8n-1',
        approval_type: 'n8n_workflow_activation',
      }),
    }))
  })

  it('requires a trace-linked run before n8n activation approval can be requested', async () => {
    queueExistingItem({
      ...baseItem,
      active_run_id: null,
      status: 'ready_for_review',
      metadata: {
        mcp_build_result: {
          recorded: true,
          result_summary: 'Inactive workflow passed dry-run validation.',
          workflow_id: 'wf_456',
          validation_result: 'Dry run passed.',
          test_evidence: 'Synthetic fixture completed without outbound sends.',
          credential_gaps: [],
          env_gaps: [],
          rollback_notes: 'Disable or delete inactive workflow wf_456.',
        },
      },
    })

    await expect(requestAgentWorkItemN8nActivationReview({
      id: 'work-1',
      reviewSummary: 'Review inactive workflow evidence before any activation decision.',
    })).rejects.toThrow('Trace-linked run is required before requesting n8n activation approval')

    expect(mocks.insertMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('requires an MCP build result before n8n activation review', async () => {
    queueExistingItem({
      ...baseItem,
      status: 'ready_for_review',
      metadata: {},
    })

    await expect(requestAgentWorkItemN8nActivationReview({
      id: 'work-1',
      reviewSummary: 'Review inactive workflow evidence before any activation decision.',
    })).rejects.toThrow('MCP build result is required before requesting activation review')

    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('requires workflow evidence before n8n activation review', async () => {
    queueExistingItem({
      ...baseItem,
      status: 'ready_for_review',
      metadata: {
        mcp_build_result: {
          recorded: true,
          result_summary: 'Dry run completed without a workflow identifier.',
          workflow_id: '   ',
          inspection_result: '',
          credential_gaps: [],
          env_gaps: [],
        },
      },
    })

    await expect(requestAgentWorkItemN8nActivationReview({
      id: 'work-1',
      reviewSummary: 'Review inactive workflow evidence before any activation decision.',
    })).rejects.toThrow('MCP build result must include a workflow id or inspection result before activation review')

    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('rejects n8n activation review when MCP build gaps remain', async () => {
    queueExistingItem({
      ...baseItem,
      status: 'blocked',
      metadata: {
        mcp_build_result: {
          recorded: true,
          workflow_id: 'wf_456',
          credential_gaps: ['Gmail OAuth staging credential'],
          env_gaps: [],
        },
      },
    })

    await expect(requestAgentWorkItemN8nActivationReview({
      id: 'work-1',
      reviewSummary: 'Review inactive workflow evidence before any activation decision.',
    })).rejects.toThrow('Resolve MCP build gaps before requesting activation review')
  })

  it('records handoffs through agent_handoffs', async () => {
    queueExistingItem()
    mocks.singleQueue.push(
      { data: { id: 'handoff-1' }, error: null },
      { data: { ...baseItem, owner_agent_key: 'automation-systems' }, error: null },
    )

    const result = await handoffAgentWorkItem({
      id: 'work-1',
      toAgentKey: 'automation-systems',
      summary: 'Please continue implementation',
    })

    expect(result.handoffId).toBe('handoff-1')
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_handoffs')
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      work_item_id: 'work-1',
      to_agent_key: 'automation-systems',
    }))
  })

  it('rejects invalid runtime and status values', async () => {
    await expect(createAgentWorkItem({
      title: 'Bad runtime',
      objective: 'Bad runtime',
      ownerRuntime: 'bad' as never,
    })).rejects.toThrow('Invalid owner_runtime')

    await expect(listAgentWorkItems({ status: 'bad' as never })).rejects.toThrow('Invalid work item status')
  })
})
