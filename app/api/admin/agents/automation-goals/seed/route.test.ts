import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  seedAutomationGoals: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-automation-goal-seeding', () => ({
  seedAutomationGoals: mocks.seedAutomationGoals,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/automation-goals/seed', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/automation-goals/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.seedAutomationGoals.mockResolvedValue([
      {
        seed: { id: 'meeting-intake-follow-up-drafts', title: 'Automate meeting intake to follow-up drafts' },
        parent: { id: 'parent-work-item' },
        children: [{ id: 'child-1' }],
      },
    ])
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ confirmation: 'seed_agent_automation_goals' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.seedAutomationGoals).not.toHaveBeenCalled()
  })

  it('requires confirmation before seeding', async () => {
    const response = await POST(request({ tier: 1 }) as never)

    expect(response.status).toBe(400)
    expect(mocks.seedAutomationGoals).not.toHaveBeenCalled()
  })

  it('seeds selected or Tier 1 automation goals', async () => {
    const response = await POST(request({
      tier: 1,
      seed_ids: ['meeting-intake-follow-up-drafts'],
      confirmation: 'seed_agent_automation_goals',
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      seeded_goals: [{ seed_id: 'meeting-intake-follow-up-drafts', parent_work_item: { id: 'parent-work-item' } }],
    })
    expect(mocks.seedAutomationGoals).toHaveBeenCalledWith({
      seedIds: ['meeting-intake-follow-up-drafts'],
      tier: 1,
      triggeredByUserId: 'admin-user',
    })
  })
})
