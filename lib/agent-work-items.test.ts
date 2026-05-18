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

import {
  attachAgentWorkItemPr,
  cancelAgentWorkItem,
  claimAgentWorkItem,
  createAgentWorkItem,
  handoffAgentWorkItem,
  listAgentWorkItems,
  recordAgentWorkItemBlocker,
  recordAgentWorkItemValidation,
  requestAgentWorkItemMcpBuild,
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

function queueExistingItem(item = baseItem) {
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
