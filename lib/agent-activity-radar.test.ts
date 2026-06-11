import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import { buildAgentActivityRadarSnapshotFromRows } from './agent-activity-radar'

const now = new Date('2026-06-11T14:00:00.000Z')

function run(overrides: Record<string, unknown>) {
  return {
    id: 'run-1',
    agent_key: 'chief-of-staff',
    runtime: 'manual',
    kind: 'test',
    title: 'Test run',
    status: 'running',
    subject_type: null,
    subject_id: null,
    subject_label: null,
    current_step: 'Running test step',
    error_message: null,
    started_at: '2026-06-11T13:55:00.000Z',
    completed_at: null,
    stale_after: null,
    metadata: {},
    ...overrides,
  }
}

function workItem(overrides: Record<string, unknown>) {
  return {
    id: 'work-1',
    title: 'Wire live radar',
    objective: 'Show live agent state.',
    status: 'in_progress',
    priority: 'high',
    owner_agent_key: 'chief-of-staff',
    owner_runtime: 'manual',
    active_run_id: 'run-1',
    blocker_summary: null,
    validation_summary: null,
    approval_id: null,
    source_type: null,
    source_id: null,
    source_label: null,
    metadata: {
      goal_id: 'AGENT-OPS-LIVE-RADAR-001',
      goal_title: 'Agent Activity Radar',
      current_gate: 'challenger_qa',
      gate_status: 'challenger_pending',
      challenger_status: 'pending',
      pass_to_human: false,
    },
    created_at: '2026-06-11T13:00:00.000Z',
    updated_at: '2026-06-11T13:58:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

describe('buildAgentActivityRadarSnapshotFromRows', () => {
  it('marks running work as active and preserves trace and goal links', () => {
    const snapshot = buildAgentActivityRadarSnapshotFromRows({
      now,
      runs: [run({}) as never],
      events: [{
        id: 'event-1',
        run_id: 'run-1',
        event_type: 'step_started',
        severity: 'info',
        message: 'Running test step',
        occurred_at: '2026-06-11T13:59:00.000Z',
        metadata: {},
      }],
      workItems: [workItem({}) as never],
      approvals: [],
    })

    const shaka = snapshot.agents.find((agent) => agent.key === 'chief-of-staff')

    expect(snapshot.summary.active).toBeGreaterThanOrEqual(1)
    expect(shaka).toMatchObject({
      live_state: 'active',
      trace_href: '/admin/agents/runs/run-1',
      current_work_item: {
        id: 'work-1',
        href: '/admin/agents/swarm-board?work_item=work-1',
      },
      linked_goal: {
        id: 'AGENT-OPS-LIVE-RADAR-001',
        title: 'Agent Activity Radar',
        current_gate: 'challenger_qa',
        gate_status: 'challenger_pending',
        challenger_status: 'pending',
        pass_to_human: false,
      },
    })
    expect(shaka?.steer_actions.map((action) => action.kind)).toEqual(expect.arrayContaining(['open_trace', 'open_kanban', 'ask_shaka', 'engage_agent']))
  })

  it('surfaces blocked work items in attention', () => {
    const snapshot = buildAgentActivityRadarSnapshotFromRows({
      now,
      runs: [run({}) as never],
      events: [],
      workItems: [workItem({ status: 'blocked', blocker_summary: 'Needs Vambah decision.' }) as never],
      approvals: [],
    })

    const shaka = snapshot.agents.find((agent) => agent.key === 'chief-of-staff')

    expect(shaka?.live_state).toBe('blocked')
    expect(snapshot.summary.blocked).toBe(1)
    expect(snapshot.attention[0]).toMatchObject({
      state: 'blocked',
      title: 'Wire live radar',
      detail: 'Needs Vambah decision.',
      href: '/admin/agents/swarm-board?work_item=work-1',
    })
  })

  it('marks pending approvals as waiting for approval', () => {
    const snapshot = buildAgentActivityRadarSnapshotFromRows({
      now,
      runs: [run({ status: 'waiting_for_approval', current_step: 'Approval required' }) as never],
      events: [],
      workItems: [workItem({ approval_id: 'approval-1' }) as never],
      approvals: [{
        id: 'approval-1',
        run_id: 'run-1',
        approval_type: 'agent_work_item_merge',
        status: 'pending',
        requested_at: '2026-06-11T13:59:00.000Z',
        requested_by_agent_key: 'chief-of-staff',
        metadata: { work_item_id: 'work-1' },
      }],
    })

    const shaka = snapshot.agents.find((agent) => agent.key === 'chief-of-staff')

    expect(shaka?.live_state).toBe('waiting_for_approval')
    expect(shaka?.steer_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'open_approval', href: '/admin/agents/coordination?proposal=work-1' }),
    ]))
    expect(snapshot.attention[0]).toMatchObject({ state: 'waiting_for_approval' })
  })

  it('surfaces failed and stale traces in attention', () => {
    const snapshot = buildAgentActivityRadarSnapshotFromRows({
      now,
      runs: [
        run({ id: 'run-failed', agent_key: 'automation-systems', runtime: 'n8n', status: 'failed', title: 'Webhook failed', current_step: null, error_message: 'Webhook error' }) as never,
        run({ id: 'run-stale', agent_key: 'risk-compliance-intelligence', status: 'stale', title: 'Policy scan stale', current_step: 'No heartbeat' }) as never,
      ],
      events: [],
      workItems: [],
      approvals: [],
    })

    expect(snapshot.agents.find((agent) => agent.key === 'automation-systems')?.live_state).toBe('failed')
    expect(snapshot.agents.find((agent) => agent.key === 'risk-compliance-intelligence')?.live_state).toBe('stale')
    expect(snapshot.attention.map((item) => item.state)).toEqual(expect.arrayContaining(['failed', 'stale']))
  })

  it('marks agents with no active work as idle with a reason', () => {
    const snapshot = buildAgentActivityRadarSnapshotFromRows({
      now,
      runs: [],
      events: [],
      workItems: [],
      approvals: [],
    })

    const activeAgent = snapshot.agents.find((agent) => agent.key === 'chief-of-staff')
    const plannedAgent = snapshot.agents.find((agent) => agent.organization_status === 'planned')

    expect(activeAgent?.live_state).toBe('idle')
    expect(activeAgent?.idle_reason).toBe('No assigned active work.')
    expect(plannedAgent?.idle_reason).toBe('Planned agent; no active trace yet.')
  })
})
