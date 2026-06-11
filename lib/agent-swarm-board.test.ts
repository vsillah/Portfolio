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

type OrgBoardInput = Parameters<typeof buildAgentOrgBoardSnapshotFromRows>[0]
type OrgRunRow = OrgBoardInput['runs'][number]
type OrgRunEventRow = OrgBoardInput['events'][number]
type OrgWorkItemRow = OrgBoardInput['workItems'][number]

function orgRun(overrides: Partial<OrgRunRow>): OrgRunRow {
  return {
    id: 'run-1',
    agent_key: 'chief-of-staff',
    runtime: 'codex',
    kind: 'agent_task',
    title: 'Agent coordination task',
    status: 'completed',
    subject_type: 'agent_work_item',
    subject_id: null,
    subject_label: null,
    current_step: null,
    error_message: null,
    started_at: '2026-05-05T12:00:00.000Z',
    completed_at: '2026-05-05T12:05:00.000Z',
    metadata: {},
    ...overrides,
  }
}

function orgEvent(overrides: Partial<OrgRunEventRow>): OrgRunEventRow {
  return {
    id: 'event-1',
    run_id: 'run-1',
    event_type: 'step_completed',
    severity: 'info',
    message: 'Step completed',
    occurred_at: '2026-05-05T12:01:00.000Z',
    metadata: {},
    ...overrides,
  }
}

function orgWorkItem(overrides: Partial<OrgWorkItemRow>): OrgWorkItemRow {
  return {
    id: 'work-1',
    title: 'Coordinate agent work',
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
    ...overrides,
  }
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
              owner_agent_label: 'Piye (Kush) - Engineering Copilot',
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
      currentAgentLabel: 'Piye (Kush) - Engineering Copilot',
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

  it('keeps terminal work items out of active lanes while preserving review-ready work', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems: [
        orgWorkItem({
          id: 'work-deployed',
          title: 'Already deployed task',
          status: 'deployed',
          priority: 'high',
          owner_agent_key: 'engineering-copilot',
          updated_at: '2026-05-05T15:00:00.000Z',
        }),
        orgWorkItem({
          id: 'work-cancelled',
          title: 'Cancelled task',
          status: 'cancelled',
          priority: 'urgent',
          owner_agent_key: null,
          updated_at: '2026-05-05T14:00:00.000Z',
        }),
        orgWorkItem({
          id: 'work-review',
          title: 'Review validated branch',
          status: 'ready_for_review',
          priority: 'medium',
          owner_agent_key: 'automation-systems',
          branch_name: 'cursor/validated-branch',
          pr_number: 214,
          validation_summary: 'Smoke checks passed',
          updated_at: '2026-05-05T13:00:00.000Z',
        }),
      ],
      approvals: [],
    })

    expect(snapshot.summary).toMatchObject({
      active_work_items: 1,
      unassigned_work_items: 0,
      blocked_work_items: 0,
    })
    expect(snapshot.lanes.flatMap((lane) => lane.tasks).map((task) => task.id)).toEqual(['work-review'])
    expect(snapshot.lanes.find((lane) => lane.key === 'integration-captain')?.tasks[0]).toMatchObject({
      id: 'work-review',
      branchName: 'cursor/validated-branch',
      prNumber: 214,
      validationSummary: 'Smoke checks passed',
    })
  })

  it('derives weighted goal progress and burndown from goal-tagged work items', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems: [
        orgWorkItem({
          id: 'goal-done',
          title: 'Ship goal foundation',
          status: 'deployed',
          priority: 'high',
          owner_agent_key: 'engineering-copilot',
          completed_at: '2026-05-05T13:00:00.000Z',
          metadata: {
            goal_id: 'goal kanban v1',
            goal_title: 'Kanban Goal-Aware Operating Board V1',
            goal_sequence: 1,
            goal_status: 'approved',
            goal_progress_weight: 2,
            goal_draft_run_id: 'draft-run',
            goal_approved_by_run_id: 'approval-run',
            goal_session_href: '/admin/agents/standup?goal=goal%20kanban%20v1',
            automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
            workflow_family: 'meeting_follow_up',
            automation_level: 'draft_to_review',
            requires_new_workflow: false,
            n8n_workflows: ['WF-SLK', 'WF-CAL'],
            approval_gate: 'External sends stay approval-gated.',
            next_action: 'Confirm every meeting can route into a draft follow-up.',
          },
        }),
        orgWorkItem({
          id: 'goal-blocked',
          title: 'Resolve goal blocker',
          status: 'blocked',
          priority: 'urgent',
          owner_agent_key: 'automation-systems',
          blocker_summary: 'Needs owner decision',
          metadata: {
            goal_id: 'goal kanban v1',
            goal_title: 'Kanban Goal-Aware Operating Board V1',
            goal_sequence: 2,
            goal_status: 'approved',
            goal_progress_weight: 1,
            goal_draft_run_id: 'draft-run',
            goal_approved_by_run_id: 'approval-run',
            goal_parent_work_item_id: 'goal-parent',
            },
        }),
        orgWorkItem({
          id: 'goal-progress',
          title: 'Continue goal implementation',
          status: 'in_progress',
          priority: 'medium',
          owner_agent_key: 'engineering-copilot',
          metadata: {
            goal_id: 'goal kanban v1',
            goal_title: 'Kanban Goal-Aware Operating Board V1',
            goal_sequence: 3,
            goal_status: 'approved',
            goal_progress_weight: 1,
            goal_draft_run_id: 'draft-run',
            goal_approved_by_run_id: 'approval-run',
          },
        }),
      ],
      approvals: [],
    })

    expect(snapshot.summary.active_goals).toBe(1)
    expect(snapshot.summary.goals[0]).toMatchObject({
      id: 'goal kanban v1',
      title: 'Kanban Goal-Aware Operating Board V1',
      total: 3,
      completed: 1,
      progress: 50,
      blocked: 1,
      open: 2,
      sessionHref: '/admin/agents/standup?goal=goal%20kanban%20v1',
      draftRunId: 'draft-run',
      approvalRunId: 'approval-run',
      latestRunId: 'approval-run',
      draftTraceHref: '/admin/agents/runs/draft-run',
      approvalTraceHref: '/admin/agents/runs/approval-run',
      automationGoalSeedId: 'meeting-intake-follow-up-drafts',
      workflowFamily: 'meeting_follow_up',
      automationLevel: 'draft_to_review',
      requiresNewWorkflow: false,
      n8nWorkflows: ['WF-SLK', 'WF-CAL'],
      approvalGate: 'External sends stay approval-gated.',
      nextAction: 'Confirm every meeting can route into a draft follow-up.',
    })
    expect(snapshot.summary.goals[0].burndown.length).toBeGreaterThan(0)
    expect(snapshot.lanes.flatMap((lane) => lane.tasks).find((task) => task.id === 'goal-blocked')?.goal).toMatchObject({
      id: 'goal kanban v1',
      sessionHref: '/admin/agents/standup?goal=goal%20kanban%20v1',
      sequence: 2,
      draftRunId: 'draft-run',
      approvalRunId: 'approval-run',
      draftTraceHref: '/admin/agents/runs/draft-run',
      approvalTraceHref: '/admin/agents/runs/approval-run',
    })
  })

  it('projects n8n proposal context onto goal-tagged Kanban cards', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems: [
        orgWorkItem({
          id: 'work-n8n-proposal-1',
          title: 'n8n proposal: Automate meeting intake to follow-up drafts',
          status: 'proposed',
          priority: 'medium',
          owner_agent_key: 'automation-systems',
          owner_runtime: 'n8n',
          source_type: 'n8n_workflow_proposal',
          metadata: {
            n8n_workflow_proposal: true,
            n8n_proposal_action: 'draft_workflow',
            proposed_workflow_name: 'Automate meeting intake to follow-up drafts',
            required_env_vars: ['N8N_INGEST_SECRET'],
            credential_needs: ['Confirm calendar and email source credentials before staging.'],
            node_plan: ['Webhook trigger', 'Agent Ops work-item callback'],
            ingest_callbacks: ['/api/admin/agents/work-items'],
            rollback_path: 'Delete the inactive draft workflow and close the proposal work item.',
            goal_id: 'automation:meeting-intake-follow-up-drafts',
            goal_title: 'Automate meeting intake to follow-up drafts',
            goal_sequence: 1,
            goal_status: 'proposed',
            goal_progress_weight: 1,
            goal_session_href: '/admin/agents/standup?goal=automation%3Ameeting-intake-follow-up-drafts',
            automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
            workflow_family: 'meeting_follow_up',
            automation_level: 'draft_to_review',
            requires_new_workflow: true,
            approval_gate: 'Activation remains approval-gated.',
            next_action: 'Review the n8n proposal packet.',
          },
        }),
      ],
      approvals: [],
    })

    const proposalTask = snapshot.lanes.flatMap((lane) => lane.tasks).find((task) => task.id === 'work-n8n-proposal-1')

    expect(proposalTask?.goal?.n8nProposal).toMatchObject({
      action: 'draft_workflow',
      proposedWorkflowName: 'Automate meeting intake to follow-up drafts',
      requiredEnvVars: ['N8N_INGEST_SECRET'],
      credentialNeeds: ['Confirm calendar and email source credentials before staging.'],
      nodePlan: ['Webhook trigger', 'Agent Ops work-item callback'],
      ingestCallbacks: ['/api/admin/agents/work-items'],
      rollbackPath: 'Delete the inactive draft workflow and close the proposal work item.',
      controllerHref: '/admin/agents/coordination?proposal=work-n8n-proposal-1',
    })
  })

  it('projects social outreach packet metadata onto goal-tagged Kanban cards', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems: [
        orgWorkItem({
          id: 'work-social-draft',
          title: 'Create the Social Content draft handoff',
          status: 'assigned',
          priority: 'high',
          owner_agent_key: 'content-repurposing',
          metadata: {
            goal_id: 'goal-social',
            goal_title: 'Create one LinkedIn post package',
            goal_type: 'social_outreach_linkedin_post',
            goal_sequence: 8,
            goal_status: 'approved',
            goal_progress_weight: 1,
            publish_gate: 'draft_only',
            chronicle_packet_status: 'manual_packet_required',
            content_packet_id: 'packet-goal-social',
            social_content_draft_id: 'social-draft-1',
            social_content_draft_href: '/admin/social-content/social-draft-1',
            orchestration_version: 'v1_content_v2_ready',
            current_gate: 'research_context_evidence',
            gate_status: 'research_pending',
            pass_to_human: false,
            challenger_status: 'pending',
            residual_risks_for_human: ['Research/context evidence is incomplete.'],
            approval_boundary: 'Human review remains gated.',
          },
        }),
      ],
      approvals: [],
    })

    const socialTask = snapshot.lanes.flatMap((lane) => lane.tasks).find((task) => task.id === 'work-social-draft')

    expect(socialTask?.goal).toMatchObject({
      id: 'goal-social',
      title: 'Create one LinkedIn post package',
      goalType: 'social_outreach_linkedin_post',
      publishGate: 'draft_only',
      chroniclePacketStatus: 'manual_packet_required',
      contentPacketId: 'packet-goal-social',
      socialContentDraftId: 'social-draft-1',
      socialContentDraftHref: '/admin/social-content/social-draft-1',
      orchestrationVersion: 'v1_content_v2_ready',
      currentGate: 'research_context_evidence',
      gateStatus: 'research_pending',
      passToHuman: false,
      challengerStatus: 'pending',
      residualRisksForHuman: ['Research/context evidence is incomplete.'],
      approvalBoundary: 'Human review remains gated.',
    })
    expect(snapshot.summary.goals[0]).toMatchObject({
      id: 'goal-social',
      goalType: 'social_outreach_linkedin_post',
      publishGate: 'draft_only',
      socialContentDraftHref: '/admin/social-content/social-draft-1',
      orchestrationVersion: 'v1_content_v2_ready',
      currentGate: 'research_context_evidence',
      gateStatus: 'research_pending',
      passToHuman: false,
      challengerStatus: 'pending',
    })
  })

  it('resolves dependency and handoff relationships without a schema migration', () => {
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems: [
        orgWorkItem({
          id: 'work-upstream',
          title: 'Finish upstream validation',
          status: 'in_progress',
          priority: 'high',
          owner_agent_key: 'engineering-copilot',
        }),
        orgWorkItem({
          id: 'work-downstream',
          title: 'Merge dependent board changes',
          status: 'ready_for_merge',
          priority: 'urgent',
          owner_agent_key: 'integration-captain',
          dependency_ids: ['work-upstream'],
        }),
      ],
      handoffs: [
        {
          id: 'handoff-1',
          run_id: 'run-handoff',
          work_item_id: 'work-downstream',
          from_agent_key: 'engineering-copilot',
          to_agent_key: 'integration-captain',
          handoff_type: 'agent_work_item_handoff',
          summary: 'Review once validation lands.',
          status: 'pending',
          created_at: '2026-05-05T15:30:00.000Z',
        },
      ],
      approvals: [],
    })

    const upstream = snapshot.lanes.flatMap((lane) => lane.tasks).find((task) => task.id === 'work-upstream')
    const downstream = snapshot.lanes.flatMap((lane) => lane.tasks).find((task) => task.id === 'work-downstream')

    expect(downstream?.dependencies[0]).toMatchObject({
      id: 'work-upstream',
      title: 'Finish upstream validation',
      status: 'in_progress',
      blocking: true,
      ownerAgentName: 'Piye (Kush) - Engineering Copilot',
    })
    expect(upstream?.dependents[0]).toMatchObject({
      id: 'work-downstream',
      title: 'Merge dependent board changes',
      status: 'ready_for_merge',
      blocking: true,
    })
    expect(downstream?.handoffs[0]).toMatchObject({
      id: 'handoff-1',
      direction: 'incoming',
      fromAgentName: 'Piye (Kush) - Engineering Copilot',
      toAgentName: 'Integration Captain',
      status: 'pending',
    })
    expect(snapshot.summary.dependencies).toEqual({
      waiting_on: 1,
      blocking_downstream: 1,
      pending_handoffs: 1,
      blocked_by_dependency: 1,
    })
  })

  it('flags WIP limit pressure and preserves priority ordering inside lanes', () => {
    const workItems = [
      orgWorkItem({ id: 'low-old', title: 'Low old', status: 'in_progress', priority: 'low', owner_agent_key: 'automation-systems', updated_at: '2026-05-05T11:00:00.000Z' }),
      orgWorkItem({ id: 'medium', title: 'Medium task', status: 'in_progress', priority: 'medium', owner_agent_key: 'automation-systems', updated_at: '2026-05-05T12:00:00.000Z' }),
      orgWorkItem({ id: 'high', title: 'High task', status: 'in_progress', priority: 'high', owner_agent_key: 'automation-systems', updated_at: '2026-05-05T13:00:00.000Z' }),
      orgWorkItem({ id: 'urgent', title: 'Urgent task', status: 'in_progress', priority: 'urgent', owner_agent_key: 'automation-systems', updated_at: '2026-05-05T10:00:00.000Z' }),
      orgWorkItem({ id: 'low-new', title: 'Low new', status: 'in_progress', priority: 'low', owner_agent_key: 'automation-systems', updated_at: '2026-05-05T14:00:00.000Z' }),
    ]
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [],
      events: [],
      workItems,
      approvals: [],
    })

    expect(snapshot.summary.wip.find((lane) => lane.laneKey === 'automation-systems')).toMatchObject({
      count: 5,
      limit: 4,
      overLimit: true,
    })
    expect(snapshot.lanes.find((lane) => lane.key === 'automation-systems')?.tasks.map((task) => task.id)).toEqual([
      'urgent',
      'high',
      'medium',
      'low-new',
      'low-old',
    ])
  })

  it('attributes fallback activity to the right agents and caps the activity feed', () => {
    const fillerEvents = Array.from({ length: 101 }, (_, index) => orgEvent({
      id: `filler-event-${index}`,
      run_id: null,
      event_type: 'heartbeat',
      message: `Heartbeat ${index}`,
      occurred_at: `2026-05-05T13:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }))
    const snapshot = buildAgentOrgBoardSnapshotFromRows({
      now: new Date('2026-05-05T16:00:00.000Z'),
      runs: [
        orgRun({
          id: 'n8n-run',
          agent_key: null,
          runtime: 'n8n',
          kind: 'workflow_dispatch',
          title: 'Sync workflow',
          current_step: 'Workflow dispatch completed',
        }),
        orgRun({
          id: 'content-run',
          agent_key: null,
          runtime: 'codex',
          kind: 'social_content_generation',
          title: 'Draft social content',
          current_step: 'Drafting content',
        }),
      ],
      events: [
        orgEvent({
          id: 'event-n8n',
          run_id: 'n8n-run',
          event_type: 'workflow_completed',
          message: null,
          occurred_at: '2026-05-05T15:30:00.000Z',
        }),
        orgEvent({
          id: 'event-content',
          run_id: 'content-run',
          event_type: 'draft_ready',
          message: 'Content draft ready for review',
          occurred_at: '2026-05-05T15:20:00.000Z',
        }),
        ...fillerEvents,
      ],
      workItems: [],
      approvals: [],
    })

    expect(snapshot.activity).toHaveLength(100)
    expect(snapshot.summary.activity_entries).toBe(100)
    expect(snapshot.activity[0]).toMatchObject({
      id: 'event-n8n',
      agentKey: 'automation-systems',
      agentName: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      summary: 'Workflow dispatch completed',
    })
    expect(snapshot.activity[1]).toMatchObject({
      id: 'event-content',
      agentKey: 'voice-content-architect',
      agentName: 'Nefertiti (Kemet) - Voice & Content Architect',
      summary: 'Content draft ready for review',
    })
  })
})
