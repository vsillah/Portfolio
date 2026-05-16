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

const orgBoardMocks = vi.hoisted(() => ({
  buildAgentOrgBoardSnapshot: vi.fn(),
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

vi.mock('@/lib/agent-swarm-board', () => ({
  buildAgentOrgBoardSnapshot: orgBoardMocks.buildAgentOrgBoardSnapshot,
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
    orgBoardMocks.buildAgentOrgBoardSnapshot.mockResolvedValue({
      generated_at: '2026-05-14T12:00:00.000Z',
      summary: {
        agents: 1,
        live_agents: 0,
        active_work_items: 1,
        unassigned_work_items: 0,
        blocked_work_items: 1,
        ready_for_merge: 0,
        pending_approvals: 0,
        activity_entries: 0,
        active_goals: 0,
        average_cycle_hours: null,
        oldest_in_flight_hours: 12,
        wip: [],
        goals: [],
      },
      agents: [
        {
          key: 'chief-of-staff',
          name: 'Shaka (Zulu) - Chief of Staff',
          podKey: 'chief_of_staff',
          podName: 'Command',
          status: 'active',
          runtime: 'codex',
          live: false,
          todayTurns: 1,
          latestAction: 'Recent traced standup',
          latestRunId: 'run-latest',
        },
      ],
      lanes: [
        {
          key: 'chief-of-staff',
          label: 'Shaka (Zulu) - Chief of Staff',
          agentKey: 'chief-of-staff',
          agentName: 'Shaka (Zulu) - Chief of Staff',
          status: 'idle',
          tasks: [
            {
              id: 'task-1',
              title: 'Route blocked approval packet',
              objective: 'Clarify the next approval step',
              status: 'blocked',
              priority: 'high',
              ownerAgentKey: 'chief-of-staff',
              ownerAgentName: 'Shaka (Zulu) - Chief of Staff',
              ownerRuntime: 'codex',
              branchName: null,
              worktreePath: null,
              prNumber: null,
              prUrl: null,
              activeRunId: 'run-task-1',
              blockerSummary: 'Needs operator decision',
              validationSummary: null,
              overlapGroup: null,
              parentWorkItemId: null,
              createdAt: '2026-05-14T00:00:00.000Z',
              updatedAt: '2026-05-14T10:00:00.000Z',
              completedAt: null,
              goal: null,
            },
          ],
        },
      ],
      activity: [],
      warRoom: {
        roster: [],
        recentRuns: [],
        commands: [],
        suggestedPrompt: 'Ask for blockers.',
      },
    })
    workItemMocks.createAgentWorkItem.mockImplementation(async (input) => ({
      id: input.parentWorkItemId ? `child-${input.title}` : 'parent-goal',
      title: input.title,
      objective: input.objective,
      metadata: input.metadata ?? {},
    }))
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
    expect(result.messages.map((message) => message.content).join(' ')).toContain('Route blocked approval packet')
    expect(result.messages.map((message) => message.content).join(' ')).toContain('Needs operator decision')
  })

  it('limits standup updates to selected agent keys when provided', async () => {
    const result = await runAgentWarRoom({
      command: 'standup',
      targetAgentKeys: ['engineering-copilot', 'chief-of-staff', 'engineering-copilot'],
      triggerSource: 'test_war_room',
      actor: { id: 'admin-user', label: 'Admin', type: 'admin_user' },
    })

    expect(result.updates.map((update) => update.agent_key)).toEqual(['engineering-copilot', 'chief-of-staff'])
    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        target_agent_keys: ['engineering-copilot', 'chief-of-staff', 'engineering-copilot'],
      }),
    }))
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
    expect(result.goalDraft?.draft_run_id).toBe('war-room-run')
    expect(result.goalDraft?.tasks.length).toBeGreaterThan(2)
    expect(workItemMocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        command: 'draft_goal',
        goal_id: result.goalDraft?.goal_id,
        goal_session_href: `/admin/agents/standup?goal=${encodeURIComponent(result.goalDraft?.goal_id ?? '')}`,
      }),
    }))
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'war_room_goal_draft',
      metadata: expect.objectContaining({
        goal_id: result.goalDraft?.goal_id,
        goal_draft_run_id: 'war-room-run',
      }),
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
      sourceRunId: 'approval-run',
      source: expect.objectContaining({ type: 'agent_standup_goal' }),
      metadata: expect.objectContaining({
        goal_role: 'parent',
        goal_id: draftResult.goalDraft?.goal_id,
        goal_draft_run_id: 'war-room-run',
        goal_approved_by_run_id: 'approval-run',
        goal_session_href: `/admin/agents/standup?goal=${encodeURIComponent(draftResult.goalDraft?.goal_id ?? '')}`,
      }),
    }))
    expect(workItemMocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      parentWorkItemId: 'parent-goal',
      source: expect.objectContaining({ type: 'agent_standup_goal_task' }),
      expectedFiles: expect.any(Array),
      metadata: expect.objectContaining({
        goal_role: 'task',
        goal_draft_run_id: 'war-room-run',
        goal_approved_by_run_id: 'approval-run',
        goal_parent_work_item_id: 'parent-goal',
        goal_sequence: expect.any(Number),
        acceptance_criteria: expect.any(Array),
        risk_notes: expect.any(String),
      }),
    }))
    expect(agentRunMocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      stepKey: 'goal_work_items_created',
    }))
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'war_room_transcript',
      metadata: expect.objectContaining({
        executes_action: true,
        goal_id: draftResult.goalDraft?.goal_id,
        goal_draft_run_id: 'war-room-run',
        goal_approved_by_run_id: 'approval-run',
        created_parent_work_item_id: 'parent-goal',
        created_child_work_item_ids: expect.any(Array),
      }),
    }))
    expect(agentRunMocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      outcome: expect.objectContaining({
        goal_id: draftResult.goalDraft?.goal_id,
        goal_draft_run_id: 'war-room-run',
        goal_approved_by_run_id: 'approval-run',
        created_child_count: draftResult.goalDraft?.tasks.length,
      }),
    }))
    expect(result.createdWorkItems?.children.length).toBe(draftResult.goalDraft?.tasks.length)
  })

  it('records focused goal context on room asks without creating work items', async () => {
    await runAgentWarRoom({
      command: 'discuss',
      message: 'What changed for this goal?',
      goalId: 'goal-existing',
      triggerSource: 'test_war_room',
    })

    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        command: 'discuss',
        goal_id: 'goal-existing',
        goal_session_href: '/admin/agents/standup?goal=goal-existing',
        executes_action: false,
      }),
    }))
    expect(workItemMocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(agentRunMocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      outcome: expect.objectContaining({
        goal_id: 'goal-existing',
        goal_session_href: '/admin/agents/standup?goal=goal-existing',
      }),
    }))
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
