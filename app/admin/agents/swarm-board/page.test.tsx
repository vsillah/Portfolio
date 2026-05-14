import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentSwarmBoardPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const longLaneLabel = 'Operations lane with an unusually long ownership label that should wrap cleanly inside the board column'
const longTaskTitle = 'Coordinate the cross-runtime agent handoff with a very long implementation label that remains readable'

const boardSnapshot = {
  ok: true,
  generated_at: '2026-05-13T12:00:00.000Z',
  summary: {
    clients: 0,
    active: 0,
    failed_or_stale: 0,
    pending_approvals: 0,
    isolation_failures: 0,
    autonomous_ready: 0,
  },
  columns: [],
  organization: {
    generated_at: '2026-05-13T12:00:00.000Z',
    summary: {
      agents: 2,
      live_agents: 1,
      active_work_items: 3,
      unassigned_work_items: 0,
      blocked_work_items: 1,
      ready_for_merge: 1,
      pending_approvals: 0,
      activity_entries: 1,
      active_goals: 1,
      average_cycle_hours: 4.5,
      oldest_in_flight_hours: 12,
      wip: [{ laneKey: 'operations', label: longLaneLabel, count: 5, limit: 4, overLimit: true }],
      goals: [{
        id: 'goal-1',
        title: 'Launch Standup Room',
        total: 2,
        completed: 0,
        progress: 35,
        blocked: 1,
        open: 2,
        burndown: [{ label: 'May 13', remaining: 2 }, { label: 'May 14', remaining: 1 }],
      }],
    },
    lanes: [
      {
        key: 'operations',
        label: longLaneLabel,
        agentKey: 'automation-systems',
        agentName: 'Amina - Automation Systems',
        status: 'live',
        tasks: [
          {
            id: 'work-1',
            title: longTaskTitle,
            objective: 'Keep Agent Ops work moving through a visible lane.',
            status: 'blocked',
            priority: 'high',
            ownerAgentKey: 'automation-systems',
            ownerAgentName: 'Amina - Automation Systems',
            ownerRuntime: 'codex',
            branchName: 'codex/agent-ops-redesign',
            worktreePath: '/Users/vambahsillah/Projects/Portfolio.worktrees/agent-ops-redesign',
            prNumber: 203,
            prUrl: 'https://github.com/example/portfolio/pull/203',
            activeRunId: 'run-1',
            blockerSummary: 'Waiting on staging smoke confirmation.',
            validationSummary: 'Focused route tests passed.',
            overlapGroup: 'agent-ops-redesign',
            parentWorkItemId: 'goal-parent',
            createdAt: '2026-05-13T08:00:00.000Z',
            updatedAt: '2026-05-13T11:50:00.000Z',
            completedAt: null,
            goal: {
              id: 'goal-1',
              title: 'Launch Standup Room',
              sequence: 1,
              status: 'approved',
              progressWeight: 1,
              sessionHref: '/admin/agents/standup?goal=goal-1',
            },
          },
          {
            id: 'work-2',
            title: 'Prepare review packet without an attached PR',
            objective: 'Make sure review-ready work cannot hide missing implementation links.',
            status: 'ready_for_merge',
            priority: 'medium',
            ownerAgentKey: 'automation-systems',
            ownerAgentName: 'Amina - Automation Systems',
            ownerRuntime: 'codex',
            branchName: 'codex/review-packet',
            worktreePath: '/Users/vambahsillah/Projects/Portfolio.worktrees/review-packet',
            prNumber: null,
            prUrl: null,
            activeRunId: null,
            blockerSummary: null,
            validationSummary: 'Focused validation passed.',
            overlapGroup: 'agent-ops-redesign',
            parentWorkItemId: 'goal-parent',
            createdAt: '2026-05-13T09:00:00.000Z',
            updatedAt: '2026-05-13T12:00:00.000Z',
            completedAt: null,
            goal: {
              id: 'goal-1',
              title: 'Launch Standup Room',
              sequence: 2,
              status: 'approved',
              progressWeight: 1,
              sessionHref: '/admin/agents/standup?goal=goal-1',
            },
          },
          {
            id: 'work-3',
            title: 'Maintain automation context outside the selected goal',
            objective: 'This should disappear when the goal filter is active.',
            status: 'in_progress',
            priority: 'low',
            ownerAgentKey: 'automation-systems',
            ownerAgentName: 'Amina - Automation Systems',
            ownerRuntime: 'codex',
            branchName: null,
            worktreePath: null,
            prNumber: null,
            prUrl: null,
            activeRunId: 'run-3',
            blockerSummary: null,
            validationSummary: null,
            overlapGroup: null,
            parentWorkItemId: null,
            createdAt: '2026-05-13T10:00:00.000Z',
            updatedAt: '2026-05-13T12:10:00.000Z',
            completedAt: null,
            goal: null,
          },
        ],
      },
      {
        key: 'empty',
        label: 'Empty validation lane',
        agentKey: null,
        agentName: 'Unassigned',
        status: 'idle',
        tasks: [],
      },
    ],
    agents: [
      {
        key: 'automation-systems',
        name: 'Amina - Automation Systems',
        podKey: 'operations',
        podName: 'Operations Pod',
        status: 'active',
        runtime: 'codex',
        live: true,
        todayTurns: 4,
        latestAction: 'Updated a work item.',
        latestRunId: 'run-1',
      },
    ],
    activity: [
      {
        id: 'activity-1',
        occurredAt: '2026-05-13T11:55:00.000Z',
        agentKey: 'automation-systems',
        agentName: 'Amina - Automation Systems',
        podKey: 'operations',
        action: 'work_item.updated',
        summary: 'Moved a blocked item into review.',
        runId: 'run-1',
        severity: 'info',
      },
    ],
    warRoom: {
      roster: [],
      recentRuns: [
        {
          id: 'war-room-run-1',
          title: 'Agent Standup Room direct ask',
          command: 'ask_agent',
          status: 'completed',
          startedAt: '2026-05-14T11:00:00.000Z',
          summary: 'Shaka answered with scoped work context.',
          goalId: 'goal-1',
        },
      ],
      commands: ['/agent work'],
      suggestedPrompt: 'Ask for blockers.',
    },
  },
}

describe('AgentSwarmBoardPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/agents/swarm-board')
    window.scrollTo = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => boardSnapshot,
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  it('defaults to the Agent Kanban work-lane view', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByRole('heading', { name: 'Agent Kanban' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Work by state, owner, and blocker' })).toBeInTheDocument()
    expect(screen.getAllByText(/Work by state, owner, and blocker/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Work-lane Kanban organized by agent ownership/i)).toBeInTheDocument()
    expect(screen.getByText('Goal progress')).toBeInTheDocument()
    expect(screen.getAllByText('Launch Standup Room').length).toBeGreaterThan(0)
    expect(screen.getByText('1 lane(s) are above configured limit.')).toBeInTheDocument()
    expect(screen.getByText(`${longLaneLabel}: 5/4`)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Kanban lanes' })).toHaveAttribute('aria-selected', 'true')
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/swarm-board', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    }))
  })

  it('renders lanes and explicit card affordances', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByRole('region', { name: `${longLaneLabel} lane` })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Empty validation lane lane' })).toBeInTheDocument()
    expect(screen.getByText(longTaskTitle)).toBeInTheDocument()
    expect(screen.getAllByText('Trace').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0)
    expect(screen.getByText('Blocker:')).toBeInTheDocument()
    expect(screen.getAllByText('Validation:').length).toBeGreaterThan(0)
    expect(screen.getByText('Resolve blocker')).toBeInTheDocument()
    expect(screen.getByText('Attach PR')).toBeInTheDocument()
    expect(screen.getAllByText('Open trace').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: `Open pull request 203 for ${longTaskTitle}` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Open trace run-1 for ${longTaskTitle}` })).toHaveAttribute('href', '/admin/agents/runs/run-1')
  })

  it('filters visible cards by goal and can clear the filter', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByText('Maintain automation context outside the selected goal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Launch Standup Room/i }))

    expect(screen.getByRole('region', { name: 'Selected goal work' })).toBeInTheDocument()
    expect(screen.getByText(/0\/2 complete/)).toBeInTheDocument()
    expect(screen.queryByText('Maintain automation context outside the selected goal')).not.toBeInTheDocument()
    expect(screen.getAllByText('2/3 visible').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByText('Maintain automation context outside the selected goal')).toBeInTheDocument()
  })

  it('honors a goal query parameter as the initial board scope', async () => {
    window.history.pushState({}, '', '/admin/agents/swarm-board?goal=goal-1')

    render(<AgentSwarmBoardPage />)

    expect(await screen.findByRole('region', { name: 'Selected goal work' })).toBeInTheDocument()
    expect(screen.getByText(/0\/2 complete/)).toBeInTheDocument()
    expect(screen.queryByText('Maintain automation context outside the selected goal')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Goal')).toHaveValue('goal-1')
  })

  it('filters visible cards by status and attention state', async () => {
    render(<AgentSwarmBoardPage />)

    await screen.findByText(longTaskTitle)

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ready_for_merge' } })

    expect(screen.getByText('Prepare review packet without an attached PR')).toBeInTheDocument()
    expect(screen.queryByText(longTaskTitle)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Attention'), { target: { value: 'blocked' } })

    expect(screen.getByText(longTaskTitle)).toBeInTheDocument()
    expect(screen.queryByText('Prepare review packet without an attached PR')).not.toBeInTheDocument()
  })

  it('switches secondary modes as board views', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByRole('tab', { name: 'Activity board' })).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(screen.getByRole('tab', { name: 'Activity board' }))

    expect(await screen.findByRole('heading', { name: 'Hive Mind' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity board' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Kanban lanes' })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows recent standup-room traces in the War Room view', async () => {
    render(<AgentSwarmBoardPage />)

    fireEvent.click(await screen.findByRole('tab', { name: 'War room board' }))

    expect(screen.getByRole('heading', { name: 'War Room' })).toBeInTheDocument()
    expect(screen.getByText('Recent room traces')).toBeInTheDocument()
    expect(screen.getByText('Agent Standup Room direct ask')).toBeInTheDocument()
    expect(screen.getByText('Shaka answered with scoped work context.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open trace' })).toHaveAttribute('href', '/admin/agents/runs/war-room-run-1')
  })

  it('keeps lane order fixed while collapsing empty lanes', async () => {
    render(<AgentSwarmBoardPage />)

    const populatedLane = await screen.findByRole('region', { name: `${longLaneLabel} lane` })
    const emptyLane = screen.getByRole('region', { name: 'Empty validation lane lane' })

    expect(populatedLane.compareDocumentPosition(emptyLane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('No visible work')).toBeInTheDocument()
    expect(screen.queryByText('No active tasks in this lane')).not.toBeInTheDocument()
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 })
  })

  it('keeps long lane and card labels accessible without truncation-only styling', async () => {
    render(<AgentSwarmBoardPage />)

    const laneLabel = await screen.findByTitle(longLaneLabel)
    const cardTitle = screen.getByTitle(longTaskTitle)

    expect(laneLabel).toHaveTextContent(longLaneLabel)
    expect(laneLabel).toHaveClass('break-words')
    expect(cardTitle).toHaveTextContent(longTaskTitle)
    expect(cardTitle).toHaveClass('break-words')
  })

  it('shows the empty goal state when no goals are present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ...boardSnapshot,
        organization: {
          ...boardSnapshot.organization,
          summary: {
            ...boardSnapshot.organization.summary,
            active_goals: 0,
            goals: [],
          },
        },
      }),
    })))

    render(<AgentSwarmBoardPage />)

    expect(await screen.findByText('Goal-tagged cards will appear after a Standup Room goal is approved.')).toBeInTheDocument()
  })
})
