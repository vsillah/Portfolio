import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listAutomationGoalSeedStates: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-automation-goal-seeding', () => ({
  listAutomationGoalSeedStates: mocks.listAutomationGoalSeedStates,
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/agents/automation-goals') {
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/automation-goals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listAutomationGoalSeedStates.mockResolvedValue([
      {
        seedId: 'meeting-intake-follow-up-drafts',
        parent: { id: 'parent-work-item' },
        children: [{ id: 'child-1' }, { id: 'child-2' }],
        n8nProposals: [{ id: 'proposal-1', status: 'proposed', title: 'n8n proposal: Meeting follow-up draft' }],
      },
    ])
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns catalog goals with seeded state', async () => {
    const response = await GET(request('http://localhost/api/admin/agents/automation-goals?tier=1') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.goals).toHaveLength(6)
    expect(body.goals.find((goal: { id: string }) => goal.id === 'meeting-intake-follow-up-drafts')).toMatchObject({
      id: 'meeting-intake-follow-up-drafts',
      seeded: true,
      seeded_parent_work_item: { id: 'parent-work-item' },
      seeded_child_count: 2,
      n8n_proposal_count: 1,
      latest_n8n_proposal: { id: 'proposal-1', status: 'proposed' },
    })
  })
})
