import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentOperationsPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const missionSnapshot = {
  generated_at: '2026-05-13T12:00:00.000Z',
  status_strip: {
    active: 4,
    queued: 2,
    running: 1,
    waiting_for_approval: 3,
    failed: 0,
    stale: 0,
    cost_today: 1.2345,
    pending_approvals: 3,
  },
  roster: [
    {
      key: 'command',
      name: 'Command',
      purpose: 'Coordinate agent work.',
      agents: [
        {
          key: 'chief-of-staff',
          name: 'Shaka',
          pod: 'Command',
          status: 'active',
          runtime: 'portfolio',
          responsibility: 'Chief of Staff for agent operations.',
          active_workflow_count: 2,
          latest_run: {
            id: 'run-shaka',
            agent_key: 'chief-of-staff',
            runtime: 'portfolio',
            kind: 'standup',
            title: 'Latest Shaka standup',
            status: 'completed',
            subject_label: null,
            current_step: null,
            error_message: null,
            started_at: '2026-05-13T11:45:00.000Z',
            completed_at: '2026-05-13T11:50:00.000Z',
            cost_total: 0,
          },
        },
        {
          key: 'automation-systems',
          name: 'Amina',
          pod: 'Automation',
          status: 'active',
          runtime: 'n8n',
          responsibility: 'Keeps automation lanes moving.',
          active_workflow_count: 1,
          latest_run: null,
        },
        {
          key: 'proposal-scripts',
          name: 'Mansa Musa',
          pod: 'Strategy',
          status: 'planned',
          runtime: 'portfolio',
          responsibility: 'Assemble offers, pricing logic, proposals, and sales scripts.',
          active_workflow_count: 0,
          latest_run: null,
        },
        {
          key: 'legacy-intelligence',
          name: 'Sundiata Keita',
          pod: 'Knowledge',
          status: 'planned',
          runtime: 'portfolio',
          responsibility: 'Translate long-horizon institution-building into reusable memory.',
          active_workflow_count: 0,
          latest_run: null,
        },
        {
          key: 'content-repurpose',
          name: 'Hannibal',
          pod: 'Content',
          status: 'active',
          runtime: 'portfolio',
          responsibility: 'Repurpose approved content into channel-ready packages.',
          active_workflow_count: 1,
          latest_run: null,
        },
        {
          key: 'research-source-register',
          name: 'Askia Muhammad',
          pod: 'Research',
          status: 'partial',
          runtime: 'portfolio',
          responsibility: 'Maintain source maps and research packets for review.',
          active_workflow_count: 1,
          latest_run: null,
        },
      ],
    },
  ],
  attention_queue: [],
  active_runs: [],
  latest_events: [
    {
      run_id: 'run-shaka',
      event_type: 'standup.completed',
      severity: 'info',
      message: 'Standup finished.',
      occurred_at: '2026-05-13T11:50:00.000Z',
    },
  ],
  latest_standup: null,
  daily_brief: {
    headline: 'Agent Ops is steady',
    synthesis: 'Decision queue is visible and the Kanban lanes are ready for review.',
    generated_from: 'current_state',
    run_id: null,
    updated_at: '2026-05-13T12:00:00.000Z',
    signals: ['1 running run', '3 pending approvals'],
    next_actions: [
      'Review the decision queue.',
      'Open Kanban for lane ownership.',
      'Ask Shaka to summarize blockers.',
      'Escalate stale traces through Run Console.',
    ],
  },
  cost_summary: {
    window_hours: 24,
    total: 0,
    event_count: 0,
    linked_event_count: 0,
    unlinked_event_count: 0,
    by_runtime: [],
    by_agent: [],
    by_workflow: [],
    by_client_project: [],
    by_artifact_type: [],
  },
  quality_summary: {
    window_hours: 24,
    generated_at: '2026-05-13T12:00:00.000Z',
    rubric_count: 1,
    evaluation_count: 0,
    average_score: null,
    pass_rate: null,
    by_agent: [],
    needs_coaching: [],
    rubric_trends: [],
  },
  operating_signals: [],
  knowledge_governance: null,
  governance: {
    generated_at: '2026-05-13T12:00:00.000Z',
    summary: {
      total_agents: 3,
      reviewed_agents: 2,
      planned_agents: 1,
      least_privilege_attention: 1,
      pending_authority_approvals: 1,
      payment_authority_actions: 6,
    },
    capability_profiles: [
      {
        agent_key: 'chief-of-staff',
        display_name: 'Shaka (Zulu) - Chief of Staff',
        pod: 'Chief of Staff',
        status: 'partial',
        primary_runtime: 'mixed',
        allowed_tools: ['Agent Ops traces', 'Mission Control context', 'Shaka routing catalog'],
        allowed_data_classes: ['agent_ops_traces', 'cross_agent_status'],
        allowed_write_classes: ['agent_run_events', 'agent_work_items'],
        outbound_authority: 'draft_only',
        spend_authority: 'none',
        approval_required_for: ['production_config_change'],
        sensitive_boundaries: ['Read-only status by default; production config changes require approval.'],
        last_reviewed_at: '2026-05-21',
        review_status: 'reviewed',
        governance_status: 'green',
      },
      {
        agent_key: 'automation-systems',
        display_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
        pod: 'Product & Automation Pod',
        status: 'active',
        primary_runtime: 'n8n',
        allowed_tools: ['Agent Ops traces', 'Mission Control context', 'n8n workflow hooks'],
        allowed_data_classes: ['agent_ops_traces', 'workflow_config'],
        allowed_write_classes: ['agent_run_events', 'agent_work_items', 'known_workflow_records'],
        outbound_authority: 'known_workflow',
        spend_authority: 'approval_required',
        approval_required_for: ['create_checkout_session', 'create_refund'],
        sensitive_boundaries: ['Known workflow writes allowed; config and unknown production writes require approval.'],
        last_reviewed_at: '2026-05-21',
        review_status: 'reviewed',
        governance_status: 'yellow',
      },
    ],
    payment_authority_actions: [
      {
        action: 'create_checkout_session',
        approval_type: 'payment_create_checkout_session',
        label: 'Create checkout session',
        description: 'Creating a payment checkout session that could collect funds from a client or customer.',
      },
    ],
    pending_authority_approvals: [
      {
        id: 'approval-payment',
        run_id: 'payment-run',
        approval_type: 'payment_create_refund',
        status: 'pending',
        requested_at: '2026-05-13T11:30:00.000Z',
        requested_by_agent_key: 'chief-of-staff',
        metadata: {
          authority_packet: {
            approval_id: 'approval-payment',
            source_run_id: 'delegation-run',
            action: 'create_refund',
            label: 'Create refund',
            risk_level: 'high',
            side_effect_boundary: 'No refund is issued until this payment authority checkpoint is approved and linked to a trace.',
            executes_action: false,
          },
        },
      },
    ],
    recent_delegation_decisions: [
      {
        run_id: 'delegation-run',
        selected_agent_key: 'automation-systems',
        selected_agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
        task_type: 'payment',
        risk_class: 'payment_spend',
        confidence: 0.9,
        occurred_at: '2026-05-13T11:40:00.000Z',
        reason: 'Yaa Asantewaa matches payment work.',
        required_evidence: ['approval_record', 'payment_object', 'trace_id'],
        approval_gate: 'payment_create_refund',
        fallback_agent_key: 'chief-of-staff',
        alternatives_considered: ['chief-of-staff'],
      },
    ],
    recent_governance_exports: [
      {
        id: 'export-1',
        export_type: 'agent_governance_client_audit',
        format: 'markdown',
        classification: 'client_safe',
        run_id: 'delegation-run',
        client_project_id: 'client-456',
        from_at: '2026-05-01T00:00:00.000Z',
        to_at: '2026-05-21T23:59:59.999Z',
        matching_run_count: 1,
        requested_by_user_id: 'admin-user',
        generated_at: '2026-05-21T00:00:00.000Z',
        created_at: '2026-05-21T00:01:00.000Z',
      },
    ],
  },
  agent_inbox: [
    {
      id: 'chief-of-staff:standup',
      priority: 'medium',
      agent_key: 'chief-of-staff',
      agent_name: 'Shaka',
      pod: 'Command',
      title: 'Run the daily standup',
      reason: 'Keep the operating brief fresh.',
      action_label: 'Run standup',
      href: '/admin/agents',
      source_run_id: null,
    },
  ],
  engagement_queue: [],
  dead_letter_queue: [],
}

const moremiReview = {
  has_monitor: true,
  run: {
    id: 'moremi-run',
    status: 'completed',
    overall: 'clean',
    generated_at: '2026-05-13T12:00:00.000Z',
    completed_at: '2026-05-13T12:00:00.000Z',
    href: '/admin/agents/runs/moremi-run',
  },
  warnings: [],
  warning_count: 0,
  enabled_source_feed_count: 2,
  disabled_source_feed_count: 0,
  safety_boundary: 'read_only',
  linked_work_items: [],
}

const automationGoals = [
  {
    id: 'meeting-intake-follow-up-drafts',
    tier: 1,
    title: 'Automate meeting intake to follow-up drafts',
    objective: 'Convert meeting signals into records and follow-up drafts.',
    workflowFamily: 'meeting_follow_up',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'meeting-intake-follow-up',
    collaboratorAgentKeys: ['chief-of-staff'],
    sourceRoutes: ['/admin/meetings'],
    sourceDocs: ['docs/meeting-follow-up-communications-guide.md'],
    n8nWorkflows: ['WF-MCH'],
    approvalGate: 'External sends require approval.',
    nextAction: 'Confirm every meeting can route into a draft follow-up.',
    requiresNewWorkflow: false,
    seeded: false,
    seeded_child_count: 0,
    seeded_parent_work_item: null,
    n8n_proposal_count: 0,
    latest_n8n_proposal: null,
  },
  {
    id: 'warm-lead-review-ready-outreach',
    tier: 1,
    title: 'Automate warm lead capture to review-ready outreach',
    objective: 'Ingest and draft outreach.',
    workflowFamily: 'warm_lead_capture',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'warm-lead-capture',
    collaboratorAgentKeys: ['inbox-follow-up'],
    sourceRoutes: ['/admin/outreach'],
    sourceDocs: ['docs/warm-lead-workflow-integration.md'],
    n8nWorkflows: ['WF-WRM-001', 'WF-WRM-002'],
    approvalGate: 'Outbound use requires approval.',
    nextAction: 'Seed source-specific exception tasks.',
    requiresNewWorkflow: false,
    seeded: true,
    seeded_child_count: 2,
    seeded_parent_work_item: {
      id: 'automation-parent-2',
      status: 'queued',
      metadata: {
        goal_session_href: '/admin/agents/standup?goal=automation%3Awarm-lead-review-ready-outreach',
        goal_kanban_href: '/admin/agents/swarm-board?goal=automation%3Awarm-lead-review-ready-outreach',
      },
    },
    n8n_proposal_count: 1,
    latest_n8n_proposal: {
      id: 'n8n-proposal-warm-lead',
      title: 'n8n proposal: Warm lead review-ready outreach',
      status: 'proposed',
      priority: 'medium',
      metadata: {
        n8n_workflow_proposal: true,
        goal_id: 'automation:warm-lead-review-ready-outreach',
      },
    },
  },
  {
    id: 'subscription-revenue-monitoring',
    tier: 2,
    title: 'Automate subscription and revenue monitoring',
    objective: 'Monitor subscription and revenue signals.',
    workflowFamily: 'revenue_operations',
    automationLevel: 'approval_gated',
    ownerAgentKey: 'risk-compliance-intelligence',
    collaboratorAgentKeys: ['chief-of-staff'],
    sourceRoutes: ['/admin/cost-revenue'],
    sourceDocs: ['docs/subscription-cancellation-audit.md'],
    n8nWorkflows: [],
    approvalGate: 'Cancellation and payment changes require approval.',
    nextAction: 'Route subscription anomalies into controller packets.',
    requiresNewWorkflow: true,
    seeded: false,
    seeded_child_count: 0,
    seeded_parent_work_item: null,
    n8n_proposal_count: 0,
    latest_n8n_proposal: null,
  },
]

const activeGoalSummary = [{
  id: 'goal-social',
  title: 'Create one LinkedIn post package showing how AmaduTown applies AI',
  total: 3,
  completed: 1,
  progress: 33,
  blocked: 1,
  open: 2,
  burndown: [],
  sessionHref: '/admin/agents/standup?goal=goal-social',
  draftRunId: 'draft-run',
  approvalRunId: 'approval-run',
  latestRunId: 'latest-run',
  draftTraceHref: '/admin/agents/runs/draft-run',
  approvalTraceHref: '/admin/agents/runs/approval-run',
  latestTraceHref: '/admin/agents/runs/latest-run',
  automationGoalSeedId: null,
  workflowFamily: null,
  automationLevel: null,
  requiresNewWorkflow: false,
  n8nWorkflows: [],
  approvalGate: null,
  nextAction: null,
  readinessStatus: 'delegated',
  stageGates: [{ key: 'voice_review', label: 'Voice and visual review', ownerAgentKey: 'voice-content-architect', requiredBefore: 'social_content_handoff', status: 'pending', approvalRequired: false }],
  nextStageGate: { key: 'voice_review', label: 'Voice and visual review', ownerAgentKey: 'voice-content-architect', requiredBefore: 'social_content_handoff', status: 'pending', approvalRequired: false },
  goalType: 'social_outreach_linkedin_post',
  contentPacketId: 'packet-goal-social',
  publishGate: 'draft_only',
  chroniclePacketStatus: 'manual_packet_required',
  socialContentDraftId: 'social-draft-1',
  socialContentDraftHref: '/admin/social-content/social-draft-1',
}]

function formatExpectedPageTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

describe('AgentOperationsPage mission control landing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/agents/activity-radar') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            generated_at: '2026-05-13T12:00:00.000Z',
            refresh_interval_seconds: 15,
            summary: {
              active: 1,
              idle: 1,
              queued: 0,
              waiting_for_approval: 0,
              blocked: 1,
              stale: 0,
              failed: 0,
            },
            agents: [
              {
                key: 'chief-of-staff',
                name: 'Shaka (Zulu) - Chief of Staff',
                pod_key: 'chief_of_staff',
                pod_name: 'Chief of Staff',
                runtime: 'mixed',
                organization_status: 'partial',
                live_state: 'active',
                idle_reason: null,
                current_work_item: {
                  id: 'work-radar',
                  title: 'Review Agent Activity Radar',
                  status: 'in_progress',
                  priority: 'high',
                  href: '/admin/agents/swarm-board?work_item=work-radar',
                },
                active_run: {
                  id: 'run-radar',
                  title: 'Radar run',
                  status: 'running',
                  href: '/admin/agents/runs/run-radar',
                },
                current_step: 'Checking live work map',
                latest_event: null,
                linked_goal: null,
                backlog_lane: {
                  key: 'in_progress',
                  label: 'In Progress',
                  href: '/admin/agents/swarm-board?work_item=work-radar',
                },
                age_seconds: 30,
                trace_href: '/admin/agents/runs/run-radar',
                steer_actions: [
                  { kind: 'open_trace', label: 'Open trace', href: '/admin/agents/runs/run-radar' },
                  { kind: 'open_kanban', label: 'Open Kanban', href: '/admin/agents/swarm-board?work_item=work-radar' },
                ],
              },
            ],
            attention: [
              {
                id: 'blocked-agent',
                severity: 'warning',
                title: 'Resolve blocked item',
                detail: 'Needs operator eyes.',
                agent_key: 'automation-systems',
                agent_name: 'Amina',
                state: 'blocked',
                href: '/admin/agents/swarm-board?work_item=blocked-agent',
                age_seconds: 600,
              },
            ],
          }),
        }
      }
      if (url === '/api/admin/agents/mission-control') {
        return { ok: true, json: async () => missionSnapshot }
      }
      if (url === '/api/admin/agents/risk-compliance/monitor?review=latest') {
        return { ok: true, json: async () => ({ review: moremiReview }) }
      }
      if (url === '/api/admin/agents/automation-goals') {
        return { ok: true, json: async () => ({ goals: automationGoals }) }
      }
      if (url === '/api/admin/agents/swarm-board') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            organization: {
              summary: {
                goals: activeGoalSummary,
              },
            },
          }),
        }
      }
      if (url === '/api/admin/agents/automation-goals/seed' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            seeded_goals: [
              {
                seed_id: 'meeting-intake-follow-up-drafts',
                parent_work_item: { id: 'automation-parent-1', active_run_id: 'automation-run-1' },
              },
            ],
          }),
        }
      }
      if (url === '/api/admin/agents/n8n-workflow-proposals' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            work_item: {
              id: 'n8n-proposal-meeting-follow-up',
              title: 'n8n proposal: Automate meeting intake to follow-up drafts workflow',
            },
          }),
        }
      }
      if (url === '/api/admin/agents/chief-of-staff/chat' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            run_id: 'shaka-chat-run',
            reply: 'Review approvals first, then clear the Kanban blockers.',
            suggested_actions: ['Open coordination', 'Open Kanban'],
            agent_engagements: [],
          }),
        }
      }
      if (url === '/api/admin/agents/war-room' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            run_id: 'standup-run',
            command: 'standup',
            synthesis: 'Standup complete.',
            updates: [
              {
                agent_key: 'chief-of-staff',
                agent_name: 'Shaka',
                pod: 'Command',
                runtime: 'portfolio',
                status: 'completed',
                update: 'Decision queue is ready.',
                next_action: 'Review pending approvals.',
                approval_gate: 'required',
              },
            ],
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the mission control landing with primary actions and status hierarchy', async () => {
    render(<AgentOperationsPage />)

    expect(await screen.findByRole('heading', { name: 'Mission Control' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mission Control routes the work. Drilldowns own the details.' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Agent Ops route map')).not.toBeInTheDocument()

    const actionBar = screen.getByLabelText('Mission Control actions')
    expect(within(actionBar).getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
    expect(within(actionBar).queryByRole('link', { name: /Open Kanban/i })).not.toBeInTheDocument()
    expect(within(actionBar).queryByRole('link', { name: /Open standup/i })).not.toBeInTheDocument()

    const statusBlocks = screen.getByLabelText('Mission Control status blocks')
    expect(within(statusBlocks).getByRole('link', { name: /Decision Queue/i })).toHaveAttribute('href', '/admin/agents/coordination')
    expect(within(statusBlocks).getByRole('link', { name: /Kanban/i })).toHaveAttribute('href', '/admin/agents/swarm-board')
    expect(within(statusBlocks).getByRole('link', { name: /Agents/i })).toHaveAttribute('href', '/admin/agents/swarm-board')
    expect(within(statusBlocks).getByRole('link', { name: /Health/i })).toHaveAttribute('href', '/admin/agents/runs')

    expect(screen.getByRole('heading', { name: 'What should I pay attention to before approving this queue?' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Ask Shaka' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ask Shaka quick prompts')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Illustrated avatar for Shaka/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Active work')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Agent Activity Radar')).toBeInTheDocument()
    expect(screen.getByText('Live agent work map')).toBeInTheDocument()
    expect(await screen.findByLabelText('Client engagement lifecycle')).toBeInTheDocument()
    expect(screen.queryByLabelText('Selected agent detail')).not.toBeInTheDocument()
    expect(screen.getByText('Operations rail')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Expand Shaka chat/i })).toHaveAttribute('href', '/admin/agents/chief-of-staff')
    expect(screen.queryByRole('link', { name: /Open Shaka chat/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open Agent Kanban/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open Run Console/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Operator checks')).toBeInTheDocument()
    expect(screen.getByLabelText('Operator checks pagination')).toHaveTextContent('Showing 1-2 of 4 · 1/2')
    expect(screen.getByText('Scheduled manual triggers with duplicate-run guards.')).toBeInTheDocument()
    const automationPanel = screen.getByLabelText('Automation to-do')
    expect(automationPanel).toBeInTheDocument()
    expect(within(automationPanel).getByText('Tier 1 seeds create work items; Tier 2 stays as the governed backlog.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Seed Tier 1/i })).toBeInTheDocument()
    expect(screen.getByText('Automate meeting intake to follow-up drafts')).toBeInTheDocument()
    expect(within(automationPanel).getAllByText(/Approval gate:/i).length).toBeGreaterThan(0)
    expect(screen.getByText('1/2 Tier 1 seeded')).toBeInTheDocument()
    expect(within(automationPanel).getAllByRole('link', { name: /Standup/i })[0]).toHaveAttribute('href', '/admin/agents/standup?goal=automation%3Ameeting-intake-follow-up-drafts')
    expect(within(automationPanel).getAllByRole('link', { name: /Kanban/i })[0]).toHaveAttribute('href', '/admin/agents/swarm-board?goal=automation%3Ameeting-intake-follow-up-drafts')
    expect(within(automationPanel).getByText('n8n proposal in controller')).toBeInTheDocument()
    expect(within(automationPanel).getByText('n8n proposal: Warm lead review-ready outreach')).toBeInTheDocument()
    expect(within(automationPanel).getByRole('link', { name: /Review proposal/i })).toHaveAttribute('href', '/admin/agents/coordination?proposal=n8n-proposal-warm-lead')
    expect(screen.getByText('Morning review')).toBeInTheDocument()
    expect(screen.getByText('Hermes health')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Run$/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Full history/i })).toHaveAttribute('href', '/admin/agents/runs?kind=operator_checks')
    expect(screen.queryByText('Recent operator runs')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Agent Inbox pagination')).toBeInTheDocument()
    const dailyBrief = screen.getByLabelText('Daily Operating Brief')
    expect(dailyBrief).toBeInTheDocument()
    expect(within(dailyBrief).queryByText(/high-priority item/i)).not.toBeInTheDocument()
    expect(within(dailyBrief).getByText('Snapshot')).toBeInTheDocument()
    expect(within(dailyBrief).getByText('Decision queue is visible and the Kanban lanes are ready for review.')).toBeInTheDocument()
    expect(within(dailyBrief).getByText(
      `Updated ${formatExpectedPageTime(missionSnapshot.daily_brief.updated_at)} from current traces.`
    )).toBeInTheDocument()
    expect(within(dailyBrief).getByText('Next best action')).toBeInTheDocument()
    expect(within(dailyBrief).getByRole('link', { name: /Open Decision Queue/i })).toHaveAttribute('href', '/admin/agents/coordination')
    expect(within(dailyBrief).queryByText('Recommended next actions')).not.toBeInTheDocument()
    expect(within(dailyBrief).queryByText('Open brief trace')).not.toBeInTheDocument()
    expect(within(dailyBrief).getAllByText(/Current traces/i).length).toBeGreaterThan(0)
    const swarmCommand = screen.getByLabelText('Swarm Command')
    expect(swarmCommand).toBeInTheDocument()
    expect(within(swarmCommand).getByText('Shaka · Chief of Staff')).toBeInTheDocument()
    expect(within(swarmCommand).getByText('Plan, question, and delegate through the Standup Room.')).toBeInTheDocument()
    expect(within(swarmCommand).getByRole('link', { name: /Open Standup Room/i })).toHaveAttribute('href', '/admin/agents/standup')
    expect(within(swarmCommand).getByRole('link', { name: /Agent attendance/i })).toHaveAttribute('href', '/admin/agents/standup')
    expect(within(swarmCommand).getByRole('link', { name: /Agent Kanban/i })).toHaveAttribute('href', '/admin/agents/swarm-board')
    expect(within(swarmCommand).getByRole('link', { name: /Governance/i })).toHaveAttribute('href', '/admin/agents/governance')
    expect(within(swarmCommand).getByText('Open authority controls')).toBeInTheDocument()
    expect(within(swarmCommand).queryByText(/Goal work/i)).not.toBeInTheDocument()
    expect(within(swarmCommand).queryByText(/Goal tags, stage gates, and blockers/i)).not.toBeInTheDocument()
    const rosterPreview = within(swarmCommand).getByLabelText('Agent roster preview')
    expect(within(rosterPreview).getByLabelText('Agent roster preview pagination')).toHaveTextContent('Showing 1-4 of 6 · 1/2')
    expect(within(rosterPreview).getByText('Shaka')).toBeInTheDocument()
    expect(within(rosterPreview).getByText('Amina')).toBeInTheDocument()
    expect(within(rosterPreview).queryByText('Hannibal')).not.toBeInTheDocument()
    fireEvent.click(within(rosterPreview).getByRole('button', { name: 'Next Agent roster preview page' }))
    expect(within(rosterPreview).getByLabelText('Agent roster preview pagination')).toHaveTextContent('Showing 5-6 of 6 · 2/2')
    expect(within(rosterPreview).getByText('Hannibal')).toBeInTheDocument()
    expect(within(rosterPreview).queryByText('Shaka')).not.toBeInTheDocument()
    fireEvent.click(within(rosterPreview).getByRole('button', { name: 'Previous Agent roster preview page' }))
    expect(within(rosterPreview).getByLabelText('Agent roster preview pagination')).toHaveTextContent('Showing 1-4 of 6 · 1/2')
    expect(screen.queryByLabelText('Agent Governance')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Scoped governance export builder')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Export client audit/i })).not.toBeInTheDocument()
    const activeGoals = screen.getByLabelText('Active Goals')
    expect(activeGoals).toBeInTheDocument()
    expect(within(activeGoals).getByText('Create one LinkedIn post package showing how AmaduTown applies AI')).toBeInTheDocument()
    expect(within(activeGoals).getByText(/33% complete · 2 open · 1 blocked/i)).toBeInTheDocument()
    expect(within(activeGoals).getByText(/Next gate: Voice and visual review before social content handoff/i)).toBeInTheDocument()
    expect(within(activeGoals).getByRole('link', { name: 'Standup' })).toHaveAttribute('href', '/admin/agents/standup?goal=goal-social')
    expect(within(activeGoals).getByRole('link', { name: 'Kanban' })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-social')
    expect(within(activeGoals).getByRole('link', { name: 'Draft' })).toHaveAttribute('href', '/admin/social-content/social-draft-1')
    expect(screen.getByRole('link', { name: /Active runs/i })).toHaveAttribute('href', '/admin/agents/runs?active=true')
    expect(screen.getByRole('link', { name: /Failed or stale runs/i })).toHaveAttribute('href', '/admin/agents/runs?status=needs_review')
    expect(screen.getByRole('link', { name: /Pending approvals/i })).toHaveAttribute('href', '/admin/agents/coordination')
    expect(screen.getByLabelText('Agent Ops signal homes')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Every signal has a durable home' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Decision Queue Approval controller/i })).toHaveAttribute('href', '/admin/agents/coordination')
    expect(screen.getByRole('link', { name: /Run Console Trace, evaluation, and dead-letter history/i })).toHaveAttribute('href', '/admin/agents/runs')
    expect(screen.getByRole('link', { name: /Cost Intelligence/i })).toHaveAttribute('href', '/admin/cost-revenue')
    expect(screen.getByRole('link', { name: /Quality Signals/i })).toHaveAttribute('href', '/admin/chat-eval')
    expect(screen.queryByText('Drilldowns & Controls')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/mission-control', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }))
    })
  })

  it('posts inline Ask Shaka messages through the existing Chief of Staff chat endpoint', async () => {
    render(<AgentOperationsPage />)

    const input = await screen.findByRole('textbox', { name: 'Ask Shaka' })
    fireEvent.change(input, { target: { value: 'What needs attention?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByText('Review approvals first, then clear the Kanban blockers.')).toBeInTheDocument()
    expect(screen.getAllByText('Shaka').length).toBeGreaterThan(0)

    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      body: JSON.stringify({ message: 'What needs attention?' }),
    }))
  })

  it('sends quick Shaka prompts through the existing chat endpoint', async () => {
    render(<AgentOperationsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Find blockers' }))

    expect(await screen.findByText('Review approvals first, then clear the Kanban blockers.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/chief-of-staff/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ message: 'Find the most important blockers across Agent Ops and tell me where to handle each one.' }),
    }))
  })

  it('routes standup work into the interactive Standup Room', async () => {
    render(<AgentOperationsPage />)

    const actionBar = await screen.findByLabelText('Mission Control actions')
    expect(within(actionBar).queryByRole('link', { name: /Open standup/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Standup Room/i })).toHaveAttribute('href', '/admin/agents/standup')
  })

  it('seeds Tier 1 automation goals from Mission Control', async () => {
    render(<AgentOperationsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Seed Tier 1/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/automation-goals/seed', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: JSON.stringify({
          tier: 1,
          confirmation: 'seed_agent_automation_goals',
        }),
      }))
    })
  })

  it('keeps the seed control tied to Tier 1 even when Tier 2 backlog remains', async () => {
    const originalSeeded = automationGoals[0]?.seeded
    if (automationGoals[0]) automationGoals[0].seeded = true

    try {
      render(<AgentOperationsPage />)

      const automationPanel = await screen.findByLabelText('Automation to-do')
      expect(within(automationPanel).getByText('2/2 Tier 1 seeded')).toBeInTheDocument()
      expect(within(automationPanel).getByRole('button', { name: /Seed Tier 1/i })).toBeDisabled()
      expect(within(automationPanel).getByText('Automate subscription and revenue monitoring')).toBeInTheDocument()
      expect(within(automationPanel).getByText('Tier 2')).toBeInTheDocument()
    } finally {
      if (automationGoals[0]) automationGoals[0].seeded = originalSeeded ?? false
    }
  })

  it('creates a governed n8n proposal from an automation goal row', async () => {
    render(<AgentOperationsPage />)

    const automationPanel = await screen.findByLabelText('Automation to-do')
    fireEvent.click(within(automationPanel).getAllByRole('button', { name: /Draft proposal/i })[0])

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/n8n-workflow-proposals', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }))
    })

    const proposalCall = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/agents/n8n-workflow-proposals')
    const proposalBody = JSON.parse(String(proposalCall?.[1]?.body ?? '{}'))
    expect(proposalBody).toMatchObject({
      action: 'inspect_workflow',
      title: 'Automate meeting intake to follow-up drafts workflow',
      automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
      goal_id: 'automation:meeting-intake-follow-up-drafts',
      workflow_family: 'meeting_follow_up',
      existing_workflow_id: 'WF-MCH',
      trigger: 'Mission Control automation goal',
    })
  })
})
