import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildAgentSwarmBoardSnapshot: vi.fn(),
  buildAgentOrgBoardSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-swarm-board', () => ({
  buildAgentSwarmBoardSnapshot: mocks.buildAgentSwarmBoardSnapshot,
  buildAgentOrgBoardSnapshot: mocks.buildAgentOrgBoardSnapshot,
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/agents/swarm-board', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/swarm-board', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildAgentSwarmBoardSnapshot.mockResolvedValue({
      generated_at: '2026-05-05T12:00:00.000Z',
      summary: {
        clients: 1,
        active: 1,
        failed_or_stale: 0,
        pending_approvals: 0,
        isolation_failures: 0,
        autonomous_ready: 1,
      },
      columns: [
        {
          key: 'decision_packet',
          label: 'Decision Packet',
          description: 'LLM, RAG, auth, automation, and cost decisions.',
          cards: [
            {
              id: 'client-swarm:project-1',
              clientProjectId: 'project-1',
              clientName: 'Acme',
              projectName: 'Acme agent shell',
              column: 'decision_packet',
              priority: 'medium',
              currentAgentKey: 'technology-evaluator',
              currentAgentLabel: 'Imhotep (Kemet) - Technology Evaluator',
              nextAction: 'Prepare LLM, RAG, and auth decision packet',
              statusLabel: 'active',
              riskLabel: 'read-only handoff safe',
              approvalState: 'none',
              isolationStatus: 'not_started',
              moduleHealth: 'green',
              latestRunId: null,
              latestRunStatus: null,
              failedOrStaleRuns: 0,
              pendingApprovals: 0,
              activeRuns: 0,
              roadmapStatus: 'active',
              dueDate: null,
              href: '/admin/client-projects/project-1',
            },
          ],
        },
      ],
    })
    mocks.buildAgentOrgBoardSnapshot.mockResolvedValue({
      generated_at: '2026-05-05T12:00:00.000Z',
      summary: {
        agents: 2,
        live_agents: 1,
        active_work_items: 1,
        unassigned_work_items: 0,
        blocked_work_items: 0,
        ready_for_merge: 0,
        pending_approvals: 0,
        activity_entries: 1,
        active_goals: 1,
        average_cycle_hours: 4.5,
        oldest_in_flight_hours: 12,
        wip: [{ laneKey: 'automation-systems', label: 'Automation Systems', count: 5, limit: 4, overLimit: true }],
        goals: [{
          id: 'goal-1',
          title: 'Launch Standup Room',
          total: 2,
          completed: 1,
          progress: 50,
          blocked: 0,
          open: 1,
          burndown: [{ label: 'May 14', remaining: 1 }],
        }],
      },
      agents: [],
      lanes: [],
      activity: [],
      warRoom: {
        roster: [],
        commands: ['/agent work'],
        suggestedPrompt: 'Ask for status.',
      },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildAgentSwarmBoardSnapshot).not.toHaveBeenCalled()
    expect(mocks.buildAgentOrgBoardSnapshot).not.toHaveBeenCalled()
  })

  it('returns the derived swarm board snapshot', async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.summary).toMatchObject({
      clients: 1,
      autonomous_ready: 1,
    })
    expect(body.columns[0].cards[0]).toMatchObject({
      clientProjectId: 'project-1',
      currentAgentKey: 'technology-evaluator',
    })
    expect(body.organization.summary).toMatchObject({
      agents: 2,
      active_work_items: 1,
      active_goals: 1,
      average_cycle_hours: 4.5,
    })
    expect(body.organization.summary.wip[0]).toMatchObject({
      laneKey: 'automation-systems',
      count: 5,
      overLimit: true,
    })
    expect(body.organization.summary.goals[0]).toMatchObject({
      id: 'goal-1',
      progress: 50,
    })
  })

  it('returns a server error when snapshot generation fails', async () => {
    mocks.buildAgentSwarmBoardSnapshot.mockRejectedValue(new Error('Database not available'))

    const response = await GET(request() as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Database not available' })
  })
})
