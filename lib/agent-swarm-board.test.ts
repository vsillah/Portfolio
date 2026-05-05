import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import {
  buildAgentSwarmBoardSnapshotFromRows,
  evaluateSwarmHandoffPolicy,
} from './agent-swarm-board'

const project = {
  id: 'project-1',
  project_name: 'Acme agent shell',
  client_name: 'Acme',
  project_status: 'active',
  estimated_end_date: '2026-06-01',
  created_at: '2026-05-05T12:00:00.000Z',
}

const roadmap = {
  id: 'roadmap-1',
  client_project_id: 'project-1',
  title: 'Acme AI Ops Roadmap',
  status: 'active',
  snapshot: {},
  updated_at: '2026-05-05T12:00:00.000Z',
}

describe('evaluateSwarmHandoffPolicy', () => {
  it('allows read-only planning handoffs to proceed autonomously', () => {
    expect(
      evaluateSwarmHandoffPolicy({
        stage: 'technology_decision',
        requestedActions: ['read_files'],
        riskLevel: 'medium',
      }),
    ).toMatchObject({
      autonomousAllowed: true,
      requiresApproval: false,
      nextColumn: 'decision_packet',
    })
  })

  it('routes side-effecting handoffs to approval', () => {
    expect(
      evaluateSwarmHandoffPolicy({
        stage: 'provisioning_plan',
        requestedActions: ['production_config_change', 'send_email'],
        riskLevel: 'medium',
      }),
    ).toMatchObject({
      autonomousAllowed: false,
      requiresApproval: true,
      approvalActions: ['production_config_change', 'send_email'],
      nextColumn: 'waiting_approval',
    })
  })

  it('blocks high-risk handoffs even when the requested action is read-only', () => {
    expect(
      evaluateSwarmHandoffPolicy({
        stage: 'qa_isolation',
        requestedActions: ['read_files'],
        riskLevel: 'high',
      }),
    ).toMatchObject({
      autonomousAllowed: false,
      requiresApproval: true,
      nextColumn: 'waiting_approval',
    })
  })
})

describe('buildAgentSwarmBoardSnapshotFromRows', () => {
  it('places fake-client discovery to technology decision work in the decision packet column', () => {
    const snapshot = buildAgentSwarmBoardSnapshotFromRows({
      projects: [project],
      roadmaps: [roadmap],
      tasks: [
        {
          id: 'task-1',
          roadmap_id: 'roadmap-1',
          task_key: 'technology-decision-packet',
          title: 'Prepare LLM, RAG, and auth decision packet',
          status: 'pending',
          priority: 'high',
          owner_type: 'amadutown',
          due_date: null,
          metadata: {},
        },
      ],
      reports: [],
      runs: [
        {
          id: 'run-1',
          agent_key: 'research-source-register',
          runtime: 'codex',
          kind: 'agent_engagement_request',
          title: 'Discover client stack',
          status: 'completed',
          subject_type: 'client_project',
          subject_id: 'project-1',
          subject_label: 'Acme agent shell',
          current_step: 'Discovery complete',
          error_message: null,
          started_at: '2026-05-05T12:00:00.000Z',
          completed_at: '2026-05-05T12:02:00.000Z',
          metadata: { client_project_id: 'project-1' },
        },
      ],
      approvals: [],
    })

    const column = snapshot.columns.find((item) => item.key === 'decision_packet')
    expect(column?.cards).toHaveLength(1)
    expect(column?.cards[0]).toMatchObject({
      clientProjectId: 'project-1',
      currentAgentKey: 'technology-evaluator',
      nextAction: 'Prepare LLM, RAG, and auth decision packet',
      approvalState: 'none',
      moduleHealth: 'green',
    })
    expect(snapshot.summary.autonomous_ready).toBe(1)
  })

  it('routes pending approvals to Waiting Approval regardless of open planning tasks', () => {
    const snapshot = buildAgentSwarmBoardSnapshotFromRows({
      projects: [project],
      roadmaps: [roadmap],
      tasks: [
        {
          id: 'task-1',
          roadmap_id: 'roadmap-1',
          task_key: 'repo-provisioning',
          title: 'Prepare repo provisioning packet',
          status: 'pending',
          priority: 'medium',
          owner_type: 'amadutown',
          due_date: null,
          metadata: {},
        },
      ],
      reports: [],
      runs: [
        {
          id: 'run-approval',
          agent_key: 'automation-systems',
          runtime: 'codex',
          kind: 'agent_handoff',
          title: 'Sync client credentials',
          status: 'waiting_for_approval',
          subject_type: 'client_project',
          subject_id: 'project-1',
          subject_label: 'Acme agent shell',
          current_step: 'Approval needed',
          error_message: null,
          started_at: '2026-05-05T12:00:00.000Z',
          completed_at: null,
          metadata: { client_project_id: 'project-1' },
        },
      ],
      approvals: [
        {
          id: 'approval-1',
          run_id: 'run-approval',
          approval_type: 'production_config_change',
          status: 'pending',
          requested_at: '2026-05-05T12:01:00.000Z',
        },
      ],
    })

    const waiting = snapshot.columns.find((item) => item.key === 'waiting_approval')
    expect(waiting?.cards[0]).toMatchObject({
      approvalState: 'pending',
      pendingApprovals: 1,
      priority: 'high',
      currentAgentKey: 'approval-steward',
    })
    expect(snapshot.summary.pending_approvals).toBe(1)
  })

  it('routes failed or stale client swarm runs to blocked and escalated', () => {
    const snapshot = buildAgentSwarmBoardSnapshotFromRows({
      projects: [project],
      roadmaps: [roadmap],
      tasks: [],
      reports: [],
      runs: [
        {
          id: 'run-failed',
          agent_key: 'engineering-copilot',
          runtime: 'codex',
          kind: 'agent_handoff',
          title: 'Run isolation scan',
          status: 'failed',
          subject_type: 'client_project',
          subject_id: 'project-1',
          subject_label: 'Acme agent shell',
          current_step: 'Isolation scan failed',
          error_message: 'Portfolio env value detected',
          started_at: '2026-05-05T12:00:00.000Z',
          completed_at: null,
          metadata: {},
        },
      ],
      approvals: [],
    })

    const blocked = snapshot.columns.find((item) => item.key === 'blocked_escalated')
    expect(blocked?.cards[0]).toMatchObject({
      failedOrStaleRuns: 1,
      moduleHealth: 'red',
      currentAgentKey: 'chief-of-staff',
    })
    expect(snapshot.summary.failed_or_stale).toBe(1)
  })
})
