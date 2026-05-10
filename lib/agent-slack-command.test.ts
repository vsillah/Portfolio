import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

vi.mock('@/lib/agent-ops-morning-review', () => ({
  runAgentOpsMorningReview: vi.fn(),
}))

const agentRunMocks = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
  endAgentRun: vi.fn(),
  attachAgentArtifact: vi.fn(),
}))

const warRoomMocks = vi.hoisted(() => ({
  runAgentWarRoom: vi.fn(),
}))

const inboxMocks = vi.hoisted(() => ({
  buildAgentMissionControlSnapshot: vi.fn(),
  routeAgentInboxItem: vi.fn(),
}))

const workItemMocks = vi.hoisted(() => ({
  listAgentWorkItems: vi.fn(),
  getAgentWorkItem: vi.fn(),
  claimAgentWorkItem: vi.fn(),
  handoffAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: agentRunMocks.startAgentRun,
  recordAgentEvent: agentRunMocks.recordAgentEvent,
  recordAgentStep: agentRunMocks.recordAgentStep,
  endAgentRun: agentRunMocks.endAgentRun,
  attachAgentArtifact: agentRunMocks.attachAgentArtifact,
}))

vi.mock('@/lib/agent-war-room', () => ({
  runAgentWarRoom: warRoomMocks.runAgentWarRoom,
}))

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: inboxMocks.buildAgentMissionControlSnapshot,
}))

vi.mock('@/lib/agent-inbox-routing', () => ({
  routeAgentInboxItem: inboxMocks.routeAgentInboxItem,
}))

vi.mock('@/lib/agent-work-items', () => ({
  listAgentWorkItems: workItemMocks.listAgentWorkItems,
  getAgentWorkItem: workItemMocks.getAgentWorkItem,
  claimAgentWorkItem: workItemMocks.claimAgentWorkItem,
  handoffAgentWorkItem: workItemMocks.handoffAgentWorkItem,
}))

import {
  agentSlackCommandInternals,
  buildAgentBlockersSlackText,
  buildAgentBriefSlackText,
  buildAgentEngagementQueueSlackText,
  buildAgentPrsSlackText,
  buildAgentWorkItemsSlackText,
  buildCaptainQueueSlackText,
  claimAgentWorkItemSlackText,
  buildAgentInboxSlackText,
  createAgentEngagementSlackText,
  handoffAgentWorkItemSlackText,
  routeAgentInboxSlackText,
  runWarRoomStandupSlackText,
} from '@/lib/agent-slack-command'

describe('agent Slack command parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps supported aliases to command handlers', () => {
    expect(agentSlackCommandInternals.commandFromText('status')).toBe('status')
    expect(agentSlackCommandInternals.commandFromText('failed')).toBe('failed')
    expect(agentSlackCommandInternals.commandFromText('failures')).toBe('failed')
    expect(agentSlackCommandInternals.commandFromText('approval')).toBe('approvals')
    expect(agentSlackCommandInternals.commandFromText('approvals')).toBe('approvals')
    expect(agentSlackCommandInternals.commandFromText('morning-review')).toBe('morning-review')
    expect(agentSlackCommandInternals.commandFromText('morning')).toBe('morning-review')
    expect(agentSlackCommandInternals.commandFromText('agents')).toBe('agents')
    expect(agentSlackCommandInternals.commandFromText('list')).toBe('agents')
    expect(agentSlackCommandInternals.commandFromText('engagements')).toBe('engagements')
    expect(agentSlackCommandInternals.commandFromText('work')).toBe('work-items')
    expect(agentSlackCommandInternals.commandFromText('queue')).toBe('engagements')
    expect(agentSlackCommandInternals.commandFromText('claim work-1')).toBe('claim')
    expect(agentSlackCommandInternals.commandFromText('handoff work-1 automation-systems')).toBe('handoff')
    expect(agentSlackCommandInternals.commandFromText('blockers')).toBe('blockers')
    expect(agentSlackCommandInternals.commandFromText('prs')).toBe('prs')
    expect(agentSlackCommandInternals.commandFromText('captain')).toBe('captain')
    expect(agentSlackCommandInternals.commandFromText('inbox')).toBe('inbox')
    expect(agentSlackCommandInternals.commandFromText('brief')).toBe('brief')
    expect(agentSlackCommandInternals.commandFromText('route 1')).toBe('route')
    expect(agentSlackCommandInternals.commandFromText('run chief-of-staff')).toBe('run')
    expect(agentSlackCommandInternals.commandFromText('standup')).toBe('standup')
    expect(agentSlackCommandInternals.commandFromText('discuss roadmap')).toBe('discuss')
  })

  it('falls back to help for empty or unknown commands', () => {
    expect(agentSlackCommandInternals.commandFromText('')).toBe('help')
    expect(agentSlackCommandInternals.commandFromText('unknown')).toBe('help')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent status')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent run <agent-key>')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent engagements')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent work [id]')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent captain')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent inbox')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent route <number-or-id>')
    expect(agentSlackCommandInternals.formatHelp()).toContain('/agent standup')
  })

  it('formats the mapped agent list for Slack', () => {
    const text = agentSlackCommandInternals.formatAgentListSlackText()

    expect(text).toContain('Agent organization')
    expect(text).toContain('chief-of-staff')
    expect(text).toContain('automation-systems')
    expect(text).toContain('/agent run <agent-key>')
  })

  it('creates a traceable engagement request for a known agent', async () => {
    agentRunMocks.startAgentRun.mockResolvedValue({ id: 'run-123' })
    agentRunMocks.recordAgentEvent.mockResolvedValue({ id: 'event-123' })
    agentRunMocks.recordAgentStep.mockResolvedValue({ id: 'step-123' })
    agentRunMocks.endAgentRun.mockResolvedValue(undefined)
    agentRunMocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-123' })

    const text = await createAgentEngagementSlackText({
      text: 'run chief-of-staff',
      userId: 'U123',
      userName: 'vambah',
    })

    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'chief-of-staff',
        runtime: 'manual',
        kind: 'agent_engagement_request',
        status: 'queued',
      }),
    )
    expect(agentRunMocks.recordAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-123',
        eventType: 'agent_engagement_requested',
      }),
    )
    expect(agentRunMocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-123',
        stepKey: 'read_only_dispatch',
      }),
    )
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-123',
        artifactType: 'agent_read_only_dispatch',
      }),
    )
    expect(agentRunMocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-123',
        status: 'completed',
      }),
    )
    expect(text).toContain('Shaka (Zulu) - Chief of Staff read-only dispatch ready')
    expect(text).toContain('Execution mode: read_only')
    expect(text).toContain('/admin/agents/runs/run-123')
  })

  it('rejects unknown agent engagement keys', async () => {
    const text = await createAgentEngagementSlackText({ text: 'run made-up-agent' })

    expect(text).toContain('Unknown agent key')
    expect(agentRunMocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('runs a War Room standup from Slack', async () => {
    warRoomMocks.runAgentWarRoom.mockResolvedValue({
      runId: 'standup-run',
      command: 'standup',
      synthesis: 'Standup complete.',
      updates: [
        {
          agent_name: 'Shaka (Zulu) - Chief of Staff',
          update: 'Current posture: partial.',
        },
      ],
    })

    const text = await runWarRoomStandupSlackText({
      text: 'standup',
      userId: 'U123',
      userName: 'vambah',
    })

    expect(warRoomMocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'standup',
      triggerSource: 'slack_agent_standup_command',
    }))
    expect(text).toContain('Agent War Room standup complete')
    expect(text).toContain('Shaka (Zulu) - Chief of Staff')
    expect(text).toContain('/admin/agents/runs/standup-run')
  })

  it('formats numbered Agent Inbox items for Slack', async () => {
    inboxMocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      agent_inbox: [
        {
          id: 'failed-run:failed',
          priority: 'high',
          agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
          title: 'Failure needs triage: Workflow dispatch',
          reason: 'Webhook returned 500.',
          source_run_id: 'failed-run',
        },
      ],
    })

    const text = await buildAgentInboxSlackText()

    expect(text).toContain('Agent Inbox')
    expect(text).toContain('1. *HIGH* Yaa Asantewaa (Ashanti) - Automation Systems')
    expect(text).toContain('/agent route <number>')
    expect(text).toContain('/admin/agents/runs/failed-run')
  })

  it('formats the engagement work queue for Slack', async () => {
    inboxMocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      engagement_queue: [
        {
          run_id: 'engagement-run',
          agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
          status: 'completed',
          execution_mode: 'read_only',
          current_step: 'Read-only dispatch ready',
          next_action: 'Review workflow health.',
          source_run_id: 'failed-run',
        },
      ],
    })

    const text = await buildAgentEngagementQueueSlackText()

    expect(text).toContain('Engagement Work Queue')
    expect(text).toContain('Yaa Asantewaa (Ashanti) - Automation Systems')
    expect(text).toContain('[completed/read_only]')
    expect(text).toContain('/admin/agents/runs/engagement-run')
    expect(text).toContain('/admin/agents/runs/failed-run')
  })

  it('formats the Daily Operating Brief for Slack', async () => {
    inboxMocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      daily_brief: {
        headline: '1 high-priority item needs attention',
        synthesis: 'Chief of Staff recommends routing the failed workflow.',
        run_id: 'standup-run',
        signals: ['1 active run(s)', '1 failed or stale run(s)'],
        next_actions: ['Yaa Asantewaa (Ashanti) - Automation Systems: triage workflow'],
      },
    })

    const text = await buildAgentBriefSlackText()

    expect(text).toContain('Daily Operating Brief')
    expect(text).toContain('Chief of Staff recommends')
    expect(text).toContain('/admin/agents/runs/standup-run')
  })

  it('routes an Agent Inbox item from Slack', async () => {
    inboxMocks.routeAgentInboxItem.mockResolvedValue({
      item: {
        title: 'Failure needs triage: Workflow dispatch',
      },
      runId: 'route-run',
      routeAction: 'agent_engagement',
      executionMode: 'read_only',
    })

    const text = await routeAgentInboxSlackText({
      text: 'route 1',
      userId: 'U123',
      userName: 'vambah',
    })

    expect(inboxMocks.routeAgentInboxItem).toHaveBeenCalledWith(expect.objectContaining({
      itemRef: '1',
      triggerSource: 'slack_agent_inbox_route_command',
      actor: expect.objectContaining({
        id: 'U123',
        label: 'vambah',
        type: 'slack_command',
      }),
    }))
    expect(text).toContain('Agent Inbox item routed')
    expect(text).toContain('/admin/agents/runs/route-run')
  })

  it('formats active coordination work items for Slack', async () => {
    workItemMocks.listAgentWorkItems.mockResolvedValue([
      {
        id: 'work-1',
        title: 'Coordinate feature',
        objective: 'Build the substrate',
        status: 'ready_for_review',
        owner_agent_key: 'chief-of-staff',
        owner_runtime: 'codex',
        branch_name: 'codex/agent-coordination-substrate',
        pr_url: 'https://github.test/pull/1',
        pr_number: 1,
        approval_id: null,
      },
    ])

    const text = await buildAgentWorkItemsSlackText({ text: 'work' })

    expect(text).toContain('Agent coordination work')
    expect(text).toContain('Coordinate feature')
    expect(text).toContain('PR 1')
    expect(text).toContain('/admin/agents/coordination')
  })

  it('formats one coordination work item for Slack', async () => {
    workItemMocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Coordinate feature',
      objective: 'Build the substrate',
      status: 'blocked',
      owner_agent_key: 'chief-of-staff',
      owner_runtime: 'codex',
      branch_name: null,
      pr_url: null,
      pr_number: null,
      approval_id: null,
      active_run_id: 'run-1',
      blocker_summary: 'Needs captain review',
      validation_summary: null,
      latest_handoff: null,
    })

    const text = await buildAgentWorkItemsSlackText({ text: 'work work-1' })

    expect(text).toContain('Agent work item')
    expect(text).toContain('Needs captain review')
    expect(text).toContain('/admin/agents/runs/run-1')
  })

  it('claims and hands off coordination work from Slack', async () => {
    workItemMocks.claimAgentWorkItem.mockResolvedValue({
      title: 'Coordinate feature',
      objective: 'Build the substrate',
      status: 'assigned',
      owner_agent_key: 'automation-systems',
      owner_runtime: 'codex',
      branch_name: null,
      pr_url: null,
      pr_number: null,
      approval_id: null,
      active_run_id: 'run-1',
    })
    const claimText = await claimAgentWorkItemSlackText({
      text: 'claim work-1 automation-systems',
      userName: 'vambah',
    })
    expect(workItemMocks.claimAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      ownerAgentKey: 'automation-systems',
    }))
    expect(claimText).toContain('Agent work item claimed')

    workItemMocks.handoffAgentWorkItem.mockResolvedValue({
      handoffId: 'handoff-1',
      workItem: {
        title: 'Coordinate feature',
        objective: 'Build the substrate',
        status: 'assigned',
        owner_agent_key: 'integration-captain',
        owner_runtime: 'codex',
        branch_name: null,
        pr_url: null,
        pr_number: null,
        approval_id: null,
        active_run_id: 'run-2',
      },
    })
    const handoffText = await handoffAgentWorkItemSlackText({
      text: 'handoff work-1 integration-captain ready for review',
      userName: 'vambah',
    })
    expect(workItemMocks.handoffAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      toAgentKey: 'integration-captain',
    }))
    expect(handoffText).toContain('Agent work item handed off')
    expect(handoffText).toContain('handoff-1')
  })

  it('formats blocker, PR, and captain queues', async () => {
    workItemMocks.listAgentWorkItems.mockResolvedValue([
      {
        title: 'Blocked feature',
        objective: 'Needs credentials',
        status: 'blocked',
        owner_agent_key: 'chief-of-staff',
        owner_runtime: 'codex',
        branch_name: null,
        pr_url: null,
        pr_number: null,
        approval_id: 'approval-1',
      },
      {
        title: 'Review feature',
        objective: 'Review PR',
        status: 'ready_for_merge',
        owner_agent_key: 'chief-of-staff',
        owner_runtime: 'codex',
        branch_name: 'codex/review',
        pr_url: 'https://github.test/pull/2',
        pr_number: 2,
        approval_id: null,
      },
    ])

    await expect(buildAgentBlockersSlackText()).resolves.toContain('Blocked agent coordination work')
    await expect(buildAgentPrsSlackText()).resolves.toContain('Coordination PR queue')
    await expect(buildCaptainQueueSlackText()).resolves.toContain('Integration Captain queue')
  })
})
