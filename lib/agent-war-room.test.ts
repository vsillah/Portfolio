import { beforeEach, describe, expect, it, vi } from 'vitest'

const agentRunMocks = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
  endAgentRun: vi.fn(),
  attachAgentArtifact: vi.fn(),
}))

const missionMocks = vi.hoisted(() => ({
  buildAgentMissionControlSnapshot: vi.fn(),
}))

const workItemMocks = vi.hoisted(() => ({
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: agentRunMocks.startAgentRun,
  recordAgentEvent: agentRunMocks.recordAgentEvent,
  recordAgentStep: agentRunMocks.recordAgentStep,
  endAgentRun: agentRunMocks.endAgentRun,
  attachAgentArtifact: agentRunMocks.attachAgentArtifact,
}))

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: missionMocks.buildAgentMissionControlSnapshot,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: workItemMocks.createAgentWorkItem,
}))

import { runAgentWarRoom } from '@/lib/agent-war-room'

describe('runAgentWarRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agentRunMocks.startAgentRun.mockResolvedValue({ id: 'war-room-run' })
    agentRunMocks.recordAgentStep.mockResolvedValue({ id: 'step' })
    agentRunMocks.recordAgentEvent.mockResolvedValue({ id: 'event' })
    agentRunMocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact' })
    agentRunMocks.endAgentRun.mockResolvedValue(undefined)
    missionMocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      status_strip: {
        active: 2,
        running: 1,
        failed: 0,
        stale: 0,
        waiting_for_approval: 0,
        pending_approvals: 0,
        cost_today: 0,
      },
      attention_queue: [],
    })
    workItemMocks.createAgentWorkItem.mockImplementation(async (input) => ({
      id: input.parentWorkItemId ? `child-${input.title}` : 'parent-goal',
      title: input.title,
      objective: input.objective,
      metadata: input.metadata ?? {},
    }))
    workItemMocks.createAgentWorkItem.mockImplementation(async (input) => ({
      id: input.parentWorkItemId ? `child-${input.title}` : 'parent-goal',
      title: input.title,
      objective: input.objective,
      metadata: input.metadata ?? {},
    }))
    missionMocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      status_strip: {
        active: 2,
        running: 1,
        failed: 0,
        stale: 0,
        waiting_for_approval: 0,
        pending_approvals: 0,
        cost_today: 0,
      },
      attention_queue: [],
    })
  })

  it('creates a traced standup run with transcript artifact', async () => {
    const result = await runAgentWarRoom({
      command: 'standup',
      triggerSource: 'test_war_room',
      actor: { id: 'admin-user', label: 'Admin', type: 'admin_user' },
    })

    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'chief-of-staff',
      runtime: 'manual',
      kind: 'agent_war_room_standup',
      title: 'Agent Standup Room session',
    }))
    expect(agentRunMocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'war-room-run',
      stepKey: 'collect_war_room_context',
    }))
    expect(agentRunMocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'war-room-run',
      stepKey: 'agent_updates',
    }))
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'war-room-run',
      artifactType: 'war_room_transcript',
    }))
    expect(agentRunMocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'war-room-run',
      status: 'completed',
    }))
    expect(result.synthesis).toContain('Standup complete')
    expect(result.updates.length).toBeGreaterThan(0)
  })

  it('rejects discuss without a message', async () => {
    await expect(
      runAgentWarRoom({
        command: 'discuss',
        triggerSource: 'test_war_room',
      }),
    ).rejects.toThrow('Message is required for discuss')

    expect(agentRunMocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('returns a draft goal without creating work items', async () => {
    const result = await runAgentWarRoom({
      command: 'draft_goal',
      goal: 'Build a transparent standup room',
      triggerSource: 'test_war_room',
    })

    expect(result.goalDraft?.title).toBe('Build a transparent standup room')
    expect(result.goalDraft?.tasks.length).toBeGreaterThan(2)
    expect(workItemMocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'war_room_goal_draft',
    }))
  })

  it('creates parent and child work items when a goal draft is approved', async () => {
    const draftResult = await runAgentWarRoom({
      command: 'draft_goal',
      goal: 'Add goal orchestration',
      triggerSource: 'test_war_room',
    })
    vi.clearAllMocks()
    agentRunMocks.startAgentRun.mockResolvedValue({ id: 'approval-run' })
    agentRunMocks.recordAgentStep.mockResolvedValue({ id: 'step' })
    agentRunMocks.recordAgentEvent.mockResolvedValue({ id: 'event' })
    agentRunMocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact' })
    agentRunMocks.endAgentRun.mockResolvedValue(undefined)

    const result = await runAgentWarRoom({
      command: 'approve_goal',
      draft: draftResult.goalDraft,
      triggerSource: 'test_war_room',
    })

    expect(workItemMocks.createAgentWorkItem).toHaveBeenCalledTimes(1 + (draftResult.goalDraft?.tasks.length ?? 0))
    expect(workItemMocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Goal:'),
      metadata: expect.objectContaining({ goal_role: 'parent' }),
    }))
    expect(result.createdWorkItems?.children.length).toBe(draftResult.goalDraft?.tasks.length)
  })

  it('rejects invalid direct agent asks', async () => {
    await expect(
      runAgentWarRoom({
        command: 'ask_agent',
        message: 'Status?',
        targetAgentKey: 'missing-agent',
        triggerSource: 'test_war_room',
      }),
    ).rejects.toThrow('Invalid agent key')
  })
})
