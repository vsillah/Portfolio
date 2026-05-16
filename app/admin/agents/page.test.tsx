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

describe('AgentOperationsPage mission control landing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/agents/mission-control') {
        return { ok: true, json: async () => missionSnapshot }
      }
      if (url === '/api/admin/agents/risk-compliance/monitor?review=latest') {
        return { ok: true, json: async () => ({ review: moremiReview }) }
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
    expect(screen.getByText('Agent interaction')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Expand Shaka chat/i })).toHaveAttribute('href', '/admin/agents/chief-of-staff')
    expect(screen.queryByRole('link', { name: /Open Shaka chat/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Agent Kanban/i })).toHaveAttribute('href', '/admin/agents/swarm-board')
    expect(screen.getByRole('link', { name: /Open Run Console/i })).toHaveAttribute('href', '/admin/agents/runs')
    expect(screen.getByLabelText('Operator checks')).toBeInTheDocument()
    expect(screen.getByLabelText('Operator checks pagination')).toHaveTextContent('Showing 1-2 of 4 · 1/2')
    expect(screen.getByText('Scheduled manual triggers with duplicate-run guards.')).toBeInTheDocument()
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
    expect(within(dailyBrief).getByText(/Updated May 13, 8:00 AM from current traces/i)).toBeInTheDocument()
    expect(within(dailyBrief).getByText('Next best action')).toBeInTheDocument()
    expect(within(dailyBrief).getByRole('link', { name: /Open Decision Queue/i })).toHaveAttribute('href', '/admin/agents/coordination')
    expect(within(dailyBrief).queryByText('Recommended next actions')).not.toBeInTheDocument()
    expect(within(dailyBrief).queryByText('Open brief trace')).not.toBeInTheDocument()
    expect(within(dailyBrief).getAllByText(/Current traces/i).length).toBeGreaterThan(0)
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
})
