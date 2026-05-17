import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentStandupRoomPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const organization = {
  generated_at: '2026-05-14T10:00:00.000Z',
  summary: {
    agents: 2,
    live_agents: 1,
    active_work_items: 1,
    unassigned_work_items: 0,
    blocked_work_items: 1,
    ready_for_merge: 0,
    pending_approvals: 0,
    activity_entries: 0,
    active_goals: 1,
    average_cycle_hours: 3.5,
    oldest_in_flight_hours: 12,
    wip: [{ laneKey: 'chief-of-staff', label: 'Shaka', count: 1, limit: 4, overLimit: false }],
    goals: [{
      id: 'goal-1',
      title: 'Improve standup transparency',
      total: 2,
      completed: 1,
      progress: 50,
      blocked: 0,
      open: 1,
      burndown: [{ label: 'May 14', remaining: 1 }],
      sessionHref: '/admin/agents/standup?goal=goal-1',
      draftRunId: 'draft-run',
      approvalRunId: 'approval-run',
      latestRunId: 'room-run',
      draftTraceHref: '/admin/agents/runs/draft-run',
      approvalTraceHref: '/admin/agents/runs/approval-run',
      latestTraceHref: '/admin/agents/runs/room-run',
    }],
  },
  agents: [
    {
      key: 'chief-of-staff',
      name: 'Shaka (Zulu) - Chief of Staff',
      podKey: 'chief_of_staff',
      podName: 'Chief of Staff',
      status: 'partial',
      runtime: 'mixed',
      live: true,
      todayTurns: 2,
      latestAction: 'Coordinated standup.',
      latestRunId: 'run-1',
    },
    {
      key: 'engineering-copilot',
      name: 'Piye (Kush) - Engineering Copilot',
      podKey: 'product_automation',
      podName: 'Product & Automation Pod',
      status: 'partial',
      runtime: 'codex',
      live: false,
      todayTurns: 1,
      latestAction: 'Prepared implementation.',
      latestRunId: null,
    },
  ],
  lanes: [
    {
      key: 'chief-of-staff',
      label: 'Shaka',
      agentKey: 'chief-of-staff',
      agentName: 'Shaka (Zulu) - Chief of Staff',
      status: 'live',
      tasks: [{
        id: 'task-1',
        title: 'Draft standup room',
        objective: 'Create an interactive room.',
        status: 'in_progress',
        priority: 'high',
        ownerAgentKey: 'chief-of-staff',
        ownerAgentName: 'Shaka (Zulu) - Chief of Staff',
        ownerRuntime: 'mixed',
        branchName: null,
        worktreePath: null,
        prNumber: null,
        prUrl: null,
        activeRunId: 'run-1',
        blockerSummary: null,
        validationSummary: null,
        overlapGroup: null,
        parentWorkItemId: 'goal-parent',
        createdAt: '2026-05-14T08:00:00.000Z',
        updatedAt: '2026-05-14T09:00:00.000Z',
        completedAt: null,
        goal: {
          id: 'goal-1',
          title: 'Improve standup transparency',
          sequence: 1,
          status: 'approved',
          progressWeight: 1,
          sessionHref: '/admin/agents/standup?goal=goal-1',
          draftRunId: 'draft-run',
          approvalRunId: 'approval-run',
          latestRunId: 'room-run',
          parentWorkItemId: 'goal-parent',
          draftTraceHref: '/admin/agents/runs/draft-run',
          approvalTraceHref: '/admin/agents/runs/approval-run',
          latestTraceHref: '/admin/agents/runs/room-run',
        },
      }],
    },
    {
      key: 'engineering-copilot',
      label: 'Piye',
      agentKey: 'engineering-copilot',
      agentName: 'Piye (Kush) - Engineering Copilot',
      status: 'idle',
      tasks: [],
    },
  ],
  activity: [],
  warRoom: {
    roster: [],
    recentRuns: [{
      id: 'war-room-run-1',
      title: 'Agent Standup Room direct ask',
      command: 'ask_agent',
      status: 'completed',
      startedAt: '2026-05-14T11:00:00.000Z',
      summary: 'Shaka answered with scoped work context.',
      goalId: 'goal-1',
    }],
    commands: [],
    suggestedPrompt: 'Ask for blockers.',
  },
}

describe('AgentStandupRoomPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/agents/standup')
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).includes('/api/admin/agents/swarm-board')) {
        return { ok: true, json: async () => ({ ok: true, organization }) }
      }
      if (String(url).includes('/api/admin/agents/war-room')) {
        const body = JSON.parse(String((init as RequestInit).body ?? '{}'))
        if (body.command === 'draft_goal') {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              run_id: 'goal-run',
              command: 'draft_goal',
              goal_draft: {
                goal_id: 'goal-draft',
                title: body.goal,
                objective: `Accomplish: ${body.goal}`,
                recommendation: 'Approve after review.',
                risk_notes: 'Review gated.',
                tasks: [{
                  id: 'task-draft',
                  title: 'Implement room',
                  objective: 'Build it.',
                  owner_agent_key: 'engineering-copilot',
                  priority: 'high',
                  dependencies: [],
                  expected_files: ['app/admin/agents/standup/page.tsx'],
                  acceptance_criteria: ['Renders'],
                  risk_notes: 'Low',
                  goal_progress_weight: 1,
                }, {
                  id: 'task-validation',
                  title: 'Validate room',
                  objective: 'Test it.',
                  owner_agent_key: 'chief-of-staff',
                  priority: 'medium',
                  dependencies: [],
                  expected_files: ['app/admin/agents/standup/page.test.tsx'],
                  acceptance_criteria: ['Covered'],
                  risk_notes: 'Low',
                  goal_progress_weight: 1,
                }],
              },
              messages: [],
            }),
          }
        }
        if (body.command === 'approve_goal') {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              run_id: 'approval-run',
              command: 'approve_goal',
              messages: [],
              created_work_items: {
                parent: { id: 'parent', title: 'Goal: Improve standup' },
                children: [{ id: 'child', title: 'Implement room' }],
              },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            run_id: 'room-run',
            command: body.command,
            messages: [{
              id: `message-${body.command}`,
              role: 'agent',
              agent_key: body.target_agent_key ?? 'chief-of-staff',
              agent_name: 'Shaka (Zulu) - Chief of Staff',
              content: 'Scoped response ready.',
              created_at: '2026-05-14T10:00:00.000Z',
            }],
          }),
        }
      }
      return { ok: false, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  it('renders participants, chat, goal planner, mini Kanban, metrics, and avatars', async () => {
    render(<AgentStandupRoomPage />)

    expect(await screen.findByRole('heading', { name: 'Standup Room' })).toBeInTheDocument()
    expect(screen.getByText('Attendance')).toBeInTheDocument()
    expect(await screen.findByLabelText('2 of 2 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Illustrated avatar for Shaka/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Standup control')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Run standup with 2 selected participants' })).toBeInTheDocument()
    expect(screen.getByText('Shaka, Piye')).toBeInTheDocument()
    expect(screen.getByText(/The next run will appear in Trace History/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Swarm chat' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goal planner' })).toBeInTheDocument()
    expect(screen.getByText('Kanban preview')).toBeInTheDocument()
    expect(screen.getByText('Fixed lane order · 1 active lane(s). Empty lanes collapse so the board stays scannable.')).toBeInTheDocument()
    expect(screen.getAllByText('Piye').length).toBeGreaterThan(0)
    expect(screen.getByText('Info radiators')).toBeInTheDocument()
    expect(screen.getByText('Trace history')).toBeInTheDocument()
    expect(screen.getByText('Agent Standup Room direct ask')).toBeInTheDocument()
    expect(screen.getByText('Shaka answered with scoped work context.')).toBeInTheDocument()
    expect(screen.getByText('ask agent')).toBeInTheDocument()
    expect(screen.getAllByText('completed').length).toBeGreaterThan(0)
    expect(screen.getByText('goal goal-1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open trace/i })).toHaveAttribute('href', '/admin/agents/runs/war-room-run-1')
    expect(screen.getAllByText('Improve standup transparency').length).toBeGreaterThan(0)
  })

  it('renders an empty persisted trace history state', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/admin/agents/swarm-board')) {
        return { ok: true, json: async () => ({ ok: true, organization: { ...organization, warRoom: { ...organization.warRoom, recentRuns: [] } } }) } as Response
      }
      return { ok: false, json: async () => ({ error: 'not found' }) } as Response
    })

    render(<AgentStandupRoomPage />)

    expect(await screen.findByText('No standup-room traces yet. Start a standup or ask an agent to create the first room trace.')).toBeInTheDocument()
  })

  it('posts standup and direct agent asks through war-room commands', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Start selected standup/i }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'standup', target_agent_keys: ['chief-of-staff', 'engineering-copilot'] }),
      }))
    })
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Open trace/i }).some((link) => link.getAttribute('href') === '/admin/agents/runs/room-run')).toBe(true)
    })
    expect(screen.getByText('Question tracker')).toBeInTheDocument()
    expect(screen.getByText('1/1 answered')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Ask about blockers/i), { target: { value: '@Shaka what is blocked?' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask all/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'ask_agent', message: '@Shaka what is blocked?', target_agent_key: 'chief-of-staff' }),
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: /Add Piye from standup selection/i }))
    expect(screen.getByText(/Target: 2 selected/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask about blockers/i)).toHaveValue('@Piye ')

    fireEvent.change(screen.getByPlaceholderText(/Ask about blockers/i), { target: { value: 'What changed since last standup?' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask all/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'discuss', message: 'What changed since last standup?' }),
      }))
    })

    fireEvent.change(screen.getByPlaceholderText(/Ask about blockers/i), { target: { value: 'Give us your implementation updates' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask 2 agents/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          command: 'discuss',
          message: 'Give us your implementation updates',
          target_agent_keys: ['chief-of-staff', 'engineering-copilot'],
        }),
      }))
    })
  })

  it('drafts a goal before approving work item creation', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.change(await screen.findByPlaceholderText('What should the swarm accomplish?'), { target: { value: 'Improve standup' } })
    fireEvent.click(screen.getByRole('button', { name: /Draft plan/i }))

    expect(await screen.findByText('Approve after review.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Open trace/i }).some((link) => link.getAttribute('href') === '/admin/agents/runs/goal-run')).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ command: 'draft_goal', goal: 'Improve standup' }),
    }))

    fireEvent.change(screen.getByDisplayValue('Implement room'), { target: { value: 'Implement reviewed room' } })
    fireEvent.click(screen.getByRole('button', { name: /Remove Validate room/i }))
    fireEvent.click(screen.getByRole('button', { name: /Approve goal/i }))

    await waitFor(() => {
      expect(screen.getByText(/Created 1 child work item/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Open goal on Kanban/i })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-draft')
    const approveCall = vi.mocked(fetch).mock.calls.find(([, init]) => String((init as RequestInit)?.body ?? '').includes('"command":"approve_goal"'))
    expect(approveCall).toBeTruthy()
    const approveBody = JSON.parse(String((approveCall?.[1] as RequestInit).body))
    expect(approveBody.draft.tasks).toHaveLength(1)
    expect(approveBody.draft.tasks[0].title).toBe('Implement reviewed room')
  })

  it('opens a linked goal session from the query string', async () => {
    window.history.pushState({}, '', '/admin/agents/standup?goal=goal-1')

    render(<AgentStandupRoomPage />)

    expect(await screen.findByText('Goal session')).toBeInTheDocument()
    expect(screen.getByText('1/2 complete · 1 open · 0 blocked')).toBeInTheDocument()
    expect(screen.getAllByText('Draft standup room').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open Kanban focus' })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-1')
    expect(screen.getByRole('link', { name: 'Open board' })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-1')
    expect(screen.getByRole('link', { name: 'Draft trace' })).toHaveAttribute('href', '/admin/agents/runs/draft-run')
    expect(screen.getByRole('link', { name: 'Approval trace' })).toHaveAttribute('href', '/admin/agents/runs/approval-run')
    expect(screen.getByRole('link', { name: 'Latest room trace' })).toHaveAttribute('href', '/admin/agents/runs/room-run')
    expect(screen.getByText('Goal Kanban preview')).toBeInTheDocument()

    expect(screen.getByText(/Goal session: Improve standup transparency/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start selected standup/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'standup', target_agent_keys: ['chief-of-staff', 'engineering-copilot'], goal_id: 'goal-1' }),
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear focus' }))

    expect(screen.queryByText('Goal session')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('requires at least one selected participant before starting standup', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(screen.getByRole('heading', { name: 'Select participants to start' })).toBeInTheDocument()
    expect(screen.getByText('No agents selected.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start selected standup/i })).toBeDisabled()
  })
})
