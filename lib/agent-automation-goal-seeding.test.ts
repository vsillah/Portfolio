import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAgentWorkItem: vi.fn(),
  listAgentWorkItems: vi.fn(),
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
  listAgentWorkItems: mocks.listAgentWorkItems,
}))

import { listAutomationGoalSeedStates, seedAutomationGoals } from './agent-automation-goal-seeding'

type MockCreateWorkItemInput = {
  idempotencyKey: string | null
  title: string
  status?: string
  ownerAgentKey?: string | null
  parentWorkItemId?: string | null
  metadata?: Record<string, unknown>
}

describe('agent automation goal seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAgentWorkItem.mockImplementation(async (input: MockCreateWorkItemInput) => ({
      id: input.idempotencyKey,
      title: input.title,
      status: input.status,
      owner_agent_key: input.ownerAgentKey,
      parent_work_item_id: input.parentWorkItemId ?? null,
      metadata: input.metadata,
      idempotency_key: input.idempotencyKey,
    }))
    mocks.listAgentWorkItems.mockResolvedValue([])
  })

  it('creates a parent goal and child tasks with automation metadata', async () => {
    const result = await seedAutomationGoals({
      seedIds: ['meeting-intake-follow-up-drafts'],
      triggeredByUserId: 'admin-user',
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.children).toHaveLength(2)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Goal: Automate meeting intake to follow-up drafts',
      ownerAgentKey: 'chief-of-staff',
      status: 'queued',
      idempotencyKey: 'automation-goal:meeting-intake-follow-up-drafts:parent',
      metadata: expect.objectContaining({
        automation_seed: true,
        automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
        goal_role: 'parent',
        goal_id: 'automation:meeting-intake-follow-up-drafts',
      }),
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      status: 'assigned',
      parentWorkItemId: 'automation-goal:meeting-intake-follow-up-drafts:parent',
      idempotencyKey: 'automation-goal:meeting-intake-follow-up-drafts:task:1',
      metadata: expect.objectContaining({
        goal_role: 'task',
        requires_approval: true,
        goal_parent_work_item_id: 'automation-goal:meeting-intake-follow-up-drafts:parent',
      }),
    }))
  })

  it('defaults to Tier 1 seeds and rejects unknown selected seeds', async () => {
    const seeded = await seedAutomationGoals({ triggeredByUserId: 'admin-user' })

    expect(seeded).toHaveLength(5)
    expect(mocks.createAgentWorkItem).toHaveBeenCalled()

    await expect(seedAutomationGoals({ seedIds: ['missing-seed'] })).rejects.toThrow('Unknown automation goal seed')
  })

  it('reports existing seeded state by parent and children', async () => {
    mocks.listAgentWorkItems.mockResolvedValue([
      {
        id: 'parent',
        idempotency_key: 'automation-goal:meeting-intake-follow-up-drafts:parent',
        metadata: { automation_seed: true, automation_goal_seed_id: 'meeting-intake-follow-up-drafts', goal_role: 'parent' },
      },
      {
        id: 'child-2',
        idempotency_key: 'automation-goal:meeting-intake-follow-up-drafts:task:2',
        metadata: { automation_seed: true, automation_goal_seed_id: 'meeting-intake-follow-up-drafts', goal_role: 'task', goal_sequence: 2 },
      },
      {
        id: 'child-1',
        idempotency_key: 'automation-goal:meeting-intake-follow-up-drafts:task:1',
        metadata: { automation_seed: true, automation_goal_seed_id: 'meeting-intake-follow-up-drafts', goal_role: 'task', goal_sequence: 1 },
      },
    ])

    const states = await listAutomationGoalSeedStates()
    const state = states.find((item) => item.seedId === 'meeting-intake-follow-up-drafts')

    expect(state?.parent?.id).toBe('parent')
    expect(state?.children.map((item) => item.id)).toEqual(['child-1', 'child-2'])
  })
})
