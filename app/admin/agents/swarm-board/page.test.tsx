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
      active_work_items: 1,
      unassigned_work_items: 0,
      blocked_work_items: 1,
      ready_for_merge: 0,
      pending_approvals: 0,
      activity_entries: 1,
      active_goals: 1,
      average_cycle_hours: 4.5,
      oldest_in_flight_hours: 12,
      wip: [{ laneKey: 'operations', label: longLaneLabel, count: 1, limit: 4, overLimit: false }],
      goals: [{
        id: 'goal-1',
        title: 'Launch Standup Room',
        total: 1,
        completed: 0,
        progress: 35,
        blocked: 1,
        open: 1,
        burndown: [{ label: 'May 13', remaining: 1 }],
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
      commands: ['/agent work'],
      suggestedPrompt: 'Ask for blockers.',
    },
  },
}

describe('AgentSwarmBoardPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => boardSnapshot,
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to the Agent Kanban work-lane view', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByRole('heading', { name: 'Agent Kanban' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Work by state, owner, and blocker' })).toBeInTheDocument()
    expect(screen.getAllByText(/Work by state, owner, and blocker/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Work-lane Kanban organized by agent ownership/i)).toBeInTheDocument()
    expect(screen.getByText('Goal progress')).toBeInTheDocument()
    expect(screen.getByText('Launch Standup Room')).toBeInTheDocument()
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
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Blocker:')).toBeInTheDocument()
    expect(screen.getByText('Validation:')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Open pull request 203 for ${longTaskTitle}` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Open trace run-1 for ${longTaskTitle}` })).toHaveAttribute('href', '/admin/agents/runs/run-1')
  })

  it('switches secondary modes as board views', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByRole('tab', { name: 'Activity board' })).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(screen.getByRole('tab', { name: 'Activity board' }))

    expect(await screen.findByRole('heading', { name: 'Hive Mind' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity board' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Kanban lanes' })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows empty lane copy when no tasks are active', async () => {
    render(<AgentSwarmBoardPage />)

    expect(await screen.findByText('No active tasks in this lane')).toBeInTheDocument()
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
})
