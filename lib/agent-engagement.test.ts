import { beforeEach, describe, expect, it, vi } from 'vitest'

const agentRunMocks = vi.hoisted(() => ({
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
  endAgentRun: vi.fn(),
  attachAgentArtifact: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: agentRunMocks.startAgentRun,
  recordAgentEvent: agentRunMocks.recordAgentEvent,
  recordAgentStep: agentRunMocks.recordAgentStep,
  endAgentRun: agentRunMocks.endAgentRun,
  attachAgentArtifact: agentRunMocks.attachAgentArtifact,
}))

import {
  buildAgentEngagementWorkPacket,
  buildReadOnlyAgentDispatch,
  canRunReadOnlyAgentDispatch,
  createAgentEngagementRun,
} from '@/lib/agent-engagement'
import { getAgentByKey } from '@/lib/agent-organization'

describe('agent engagement helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agentRunMocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    agentRunMocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    agentRunMocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    agentRunMocks.endAgentRun.mockResolvedValue(undefined)
    agentRunMocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
  })

  it('builds a review-first work packet for planned agents without active workflows', () => {
    const agent = getAgentByKey('strategic-narrative')
    expect(agent).toBeDefined()

    const workPacket = buildAgentEngagementWorkPacket(agent!, 'Keep this scoped to positioning evidence.')

    expect(canRunReadOnlyAgentDispatch(agent!)).toBe(false)
    expect(workPacket).toEqual(expect.objectContaining({
      pod: 'Strategy & Narrative Pod',
      activeWorkflowCount: 0,
      workflowCount: 0,
      nextAction: 'Define a first narrow, read-only task before assigning production automation.',
    }))
    expect(workPacket.summaryMarkdown).toContain('No active n8n workflow is mapped as the primary runtime yet.')
    expect(workPacket.summaryMarkdown).toContain('### Operator note')
    expect(workPacket.summaryMarkdown).toContain('Keep this scoped to positioning evidence.')
  })

  it('counts only active workflows by environment for read-only dispatch packets', () => {
    const agent = getAgentByKey('private-knowledge-librarian')
    expect(agent).toBeDefined()
    const activeWorkflows = agent!.n8nWorkflows.filter((workflow) => workflow.active)

    const dispatch = buildReadOnlyAgentDispatch(agent!, 'Inspect retrieval health.')

    expect(canRunReadOnlyAgentDispatch(agent!)).toBe(true)
    expect(dispatch.activeWorkflowCount).toBe(activeWorkflows.length)
    expect(dispatch.productionWorkflowCount).toBe(
      activeWorkflows.filter((workflow) => workflow.environment === 'production').length,
    )
    expect(dispatch.stagingWorkflowCount).toBe(
      activeWorkflows.filter((workflow) => workflow.environment === 'staging').length,
    )
    expect(dispatch.summaryMarkdown).toContain('**Execution:** read-only')
    expect(dispatch.summaryMarkdown).toContain('### Approval boundary')
    expect(dispatch.summaryMarkdown).toContain('Inspect retrieval health.')
  })

  it('queues planned agents for review and truncates operator notes before trace writes', async () => {
    const agent = getAgentByKey('strategic-narrative')
    expect(agent).toBeDefined()
    const longNote = `  ${'a'.repeat(520)}  `

    const result = await createAgentEngagementRun({
      agent: agent!,
      actor: {
        subjectType: 'admin_user',
        subjectId: 'admin-user',
        subjectLabel: 'Admin User',
        userId: 'admin-user',
      },
      triggerSource: 'admin_agent_engage',
      note: longNote,
      requestedEventMessage: 'Admin User requested Strategic Narrative Agent',
      idempotencyKey: 'agent-engage:admin-user:strategic-narrative',
      eventMetadata: { surface: 'admin_agents' },
    })

    expect(result).toEqual({
      runId: 'run-1',
      status: 'queued',
      executionMode: 'queued_for_review',
      workPacketAttached: true,
      dispatchArtifactAttached: false,
    })
    expect(agentRunMocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'agent-engage:admin-user:strategic-narrative',
      metadata: expect.objectContaining({
        note: 'a'.repeat(500),
        executes_action: false,
      }),
    }))
    expect(agentRunMocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'agent_engagement_requested',
      metadata: expect.objectContaining({
        agent_key: 'strategic-narrative',
        note: 'a'.repeat(500),
        surface: 'admin_agents',
      }),
    }))
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledTimes(1)
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'agent_engagement_work_packet',
      idempotencyKey: 'run-1:agent-engagement-work-packet',
      metadata: expect.objectContaining({
        requested_agent: 'strategic-narrative',
        active_workflow_count: 0,
        executes_action: false,
      }),
    }))
    expect(agentRunMocks.recordAgentStep).not.toHaveBeenCalled()
    expect(agentRunMocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('completes read-only dispatches with step, dispatch artifact, and safe outcome metadata', async () => {
    const agent = getAgentByKey('chief-of-staff')
    expect(agent).toBeDefined()

    const result = await createAgentEngagementRun({
      agent: agent!,
      actor: {
        subjectType: 'slack_command',
        subjectId: 'U123',
        subjectLabel: 'vambah',
      },
      triggerSource: 'slack_agent_run_command',
      note: 'Review stale runs.',
      requestedEventMessage: 'vambah requested Chief of Staff Agent from Slack',
      eventMetadata: { slack_user_id: 'U123' },
    })

    expect(result).toEqual({
      runId: 'run-1',
      status: 'completed',
      executionMode: 'read_only',
      workPacketAttached: true,
      dispatchArtifactAttached: true,
    })
    expect(agentRunMocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      stepKey: 'read_only_dispatch',
      status: 'completed',
      metadata: expect.objectContaining({
        requested_agent: 'chief-of-staff',
        execution_mode: 'read_only',
        production_workflow_count: 1,
        staging_workflow_count: 0,
        executes_action: false,
      }),
    }))
    expect(agentRunMocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'agent_read_only_dispatch',
      idempotencyKey: 'run-1:agent-read-only-dispatch',
      metadata: expect.objectContaining({
        requested_agent: 'chief-of-staff',
        execution_mode: 'read_only',
        executes_action: false,
      }),
    }))
    expect(agentRunMocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      status: 'completed',
      currentStep: 'Read-only dispatch ready',
      outcome: expect.objectContaining({
        requested_agent: 'chief-of-staff',
        execution_mode: 'read_only',
        work_packet_attached: true,
        dispatch_artifact_attached: true,
        executes_action: false,
      }),
    }))
  })
})
