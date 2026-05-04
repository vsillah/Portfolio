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
      title: 'Agent War Room standup',
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
      artifactType: 'war_room_standup_transcript',
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
})
