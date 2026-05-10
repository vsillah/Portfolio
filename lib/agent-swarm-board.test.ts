import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))

import {
  buildAgentOrgBoardSnapshotFromRows,
  buildAgentSwarmBoardSnapshotFromRows,
  evaluateSwarmHandoffPolicy,
} from './agent-swarm-board'

const project = {
  id: 'project-1',
  project_name: 'Acme agent shell',
  client_name: 'Acme',
  client_email: 'ops@acme.test',
  contact_submission_id: 101,
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

  it('adds audit-driven connector readiness to client swarm cards without side effects', () => {
    const snapshot = buildAgentSwarmBoardSnapshotFromRows({
      projects: [project],
      roadmaps: [roadmap],
      tasks: [
        {
          id: 'task-1',
          roadmap_id: 'roadmap-1',
          task_key: 'connector-provisioning-plan',
          title: 'Prepare connector provisioning packet',
          status: 'pending',
          priority: 'medium',
          owner_type: 'amadutown',
          due_date: null,
          metadata: {},
        },
      ],
      reports: [],
      runs: [],
      approvals: [],
      contacts: [
        {
          id: 101,
          email: 'ops@acme.test',
          website_tech_stack: { technologies: [{ name: 'WordPress' }] },
          client_verified_tech_stack: null,
        },
      ],
      audits: [
        {
          id: 'audit-1',
          contact_submission_id: 101,
          contact_email: 'ops@acme.test',
          audit_type: 'standalone',
          tech_stack: {
            crm: 'hubspot',
            email: 'gmail',
            other_tools: ['Slack'],
            website_technologies: ['Webflow'],
          },
          automation_needs: { priority_areas: ['lead_follow_up'] },
          ai_readiness: { data_quality: 'integrated' },
          budget_timeline: { budget_range: 'medium' },
          decision_making: { decision_maker: true, approval_process: 'solo' },
          enriched_tech_stack: { technologies: [{ name: 'Pinecone' }] },
        },
      ],
    })

    const card = snapshot.columns.flatMap((column) => column.cards)[0]
    expect(card).toMatchObject({
      requiredConnectorCount: expect.any(Number),
      readyConnectorCount: 0,
      approvalBlockedConnectorCount: 0,
    })
    expect(card.requiredConnectorCount).toBeGreaterThanOrEqual(5)
    expect(card.connectorReadiness.items.map((item) => item.key)).toEqual(expect.arrayContaining([
      'webflow',
      'hubspot',
      'google_workspace',
      'slack',
      'pinecone',
    ]))
    expect(card.connectorNextAction).toContain('setup packet')
  })

  it('uses org-board metadata before title inference for client swarm placement', () => {
    const snapshot = buildAgentSwarmBoardSnapshotFromRows({
      projects: [project],
      roadmaps: [roadmap],
      tasks: [
        {
          id: 'task-structured',
          roadmap_id: 'roadmap-1',
          task_key: 'plain-task',
          title: 'Plain task with no routing keywords',
          status: 'pending',
          priority: 'medium',
          owner_type: 'amadutown',
          due_date: null,
          metadata: {
            org_board: {
              column: 'qa_isolation',
              stage: 'qa_isolation',
              owner_agent_key: 'engineering-copilot',
              owner_agent_label: 'Engineering Copilot Agent',
              approval_posture: 'required',
              isolation_required: true,
              internal_handoff_label: 'Run synthetic validation packet',
            },
          },
        },
      ],
      reports: [],
      runs: [],
      approvals: [],
    })

    const qaColumn = snapshot.columns.find((item) => item.key === 'qa_isolation')
    expect(qaColumn?.cards).toHaveLength(1)
    expect(qaColumn?.cards[0]).toMatchObject({
      currentAgentKey: 'engineering-copilot',
      currentAgentLabel: 'Engineering Copilot Agent',
      nextAction: 'Run synthetic validation packet',
      approvalState: 'required',
      isolationStatus: 'pending',
      riskLabel: 'approval required before side effects',
    })
  })
})

describe('buildAgentOrgBoardSnapshotFromRows', () => {
  it('projects active coordination work into agent lanes and keeps client-builder compatible data separate', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [
        {
          id: 'run-1',
          agent_key: 'engineering-copilot',
          runtime: 'codex',
          kind: 'implementation',
          title: 'Build shared org board',
          status: 'running',
          subject_type: 'agent_work_item',
          subject_id: 'work-1',
          subject_label: 'Agent org board',
          current_step: 'Rendering Mission Control lanes',
          error_message: null,
          started_at: '2026-05-05T15:00:00.000Z',
          completed_at: null,
          metadata: {},
        },
      ],
      events: [
        {
          id: 'event-1',
          run_id: 'run-1',
          event_type: 'step_completed',
          severity: 'info',
          message: 'Mission Control lane rendered',
          occurred_at: '2026-05-05T15:10:00.000Z',
          metadata: {},
        },
      ],
      workItems: [
        {
          id: 'work-1',
          title: 'Build reusable agent org board',
          objective: 'Make the board work for ATAS Portfolio and client AI org builder views.',
          status: 'in_progress',
          priority: 'high',
          owner_agent_key: 'engineering-copilot',
          owner_runtime: 'codex',
          active_run_id: 'run-1',
          branch_name: 'codex/agent-org-board-ux',
          worktree_path: '/Users/vambahsillah/Projects/Portfolio.worktrees/agent-org-board-ux',
          pr_number: null,
          pr_url: null,
          overlap_group: 'agent-ops-ui',
          blocker_summary: null,
          validation_summary: null,
          approval_id: null,
          created_at: '2026-05-05T14:00:00.000Z',
          updated_at: '2026-05-05T15:30:00.000Z',
        },
      ],
      approvals: [],
    })

    expect(snapshot.summary).toMatchObject({
      live_agents: 1,
      active_work_items: 1,
      activity_entries: 1,
    })
    expect(snapshot.agents.find((agent) => agent.key === 'engineering-copilot')).toMatchObject({
      live: true,
      todayTurns: 1,
      latestAction: 'Rendering Mission Control lanes',
    })
    expect(snapshot.lanes.find((lane) => lane.key === 'engineering-copilot')?.tasks[0]).toMatchObject({
      title: 'Build reusable agent org board',
      branchName: 'codex/agent-org-board-ux',
      overlapGroup: 'agent-ops-ui',
    })
    expect(snapshot.activity[0]).toMatchObject({
      agentKey: 'engineering-copilot',
      action: 'step_completed',
      summary: 'Mission Control lane rendered',
    })
  })

  it('routes queued and unassigned work to the inbox and ready work to Integration Captain', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems: [
        {
          id: 'work-inbox',
          title: 'Triage new work',
          objective: null,
          status: 'queued',
          priority: 'medium',
          owner_agent_key: null,
          owner_runtime: null,
          active_run_id: null,
          branch_name: null,
          worktree_path: null,
          pr_number: null,
          pr_url: null,
          overlap_group: null,
          blocker_summary: null,
          validation_summary: null,
          approval_id: null,
          created_at: '2026-05-05T12:00:00.000Z',
          updated_at: '2026-05-05T12:00:00.000Z',
        },
        {
          id: 'work-merge',
          title: 'Merge validated PR',
          objective: null,
          status: 'ready_for_merge',
          priority: 'urgent',
          owner_agent_key: 'engineering-copilot',
          owner_runtime: 'codex',
          active_run_id: null,
          branch_name: 'codex/ready-work',
          worktree_path: null,
          pr_number: 204,
          pr_url: 'https://github.com/example/repo/pull/204',
          overlap_group: null,
          blocker_summary: null,
          validation_summary: 'Checks passed',
          approval_id: null,
          created_at: '2026-05-05T13:00:00.000Z',
          updated_at: '2026-05-05T13:00:00.000Z',
        },
      ],
      approvals: [
        {
          id: 'approval-1',
          run_id: 'run-approval',
          approval_type: 'production_config_change',
          status: 'pending',
          requested_at: '2026-05-05T14:00:00.000Z',
        },
      ],
    })

    expect(snapshot.summary).toMatchObject({
      unassigned_work_items: 1,
      ready_for_merge: 1,
      pending_approvals: 1,
    })
    expect(snapshot.lanes.find((lane) => lane.key === 'inbox')?.tasks[0]).toMatchObject({ id: 'work-inbox' })
    expect(snapshot.lanes.find((lane) => lane.key === 'integration-captain')?.tasks[0]).toMatchObject({
      id: 'work-merge',
      prNumber: 204,
      validationSummary: 'Checks passed',
    })
  })
})
