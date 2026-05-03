import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
  endAgentRun: vi.fn(),
  attachAgentArtifact: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
  recordAgentStep: mocks.recordAgentStep,
  endAgentRun: mocks.endAgentRun,
  attachAgentArtifact: mocks.attachAgentArtifact,
}))

import { POST } from './route'

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/engage', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/engage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'engagement-run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ agent_key: 'chief-of-staff' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('runs a read-only dispatch for a mapped active or partial agent', async () => {
    const response = await POST(makeRequest({
      agent_key: 'chief-of-staff',
      note: 'Review current blockers.',
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'engagement-run-1',
      agent_key: 'chief-of-staff',
      agent_name: 'Chief of Staff Agent',
      status: 'completed',
      work_packet_attached: true,
      dispatch_artifact_attached: true,
      execution_mode: 'read_only',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'chief-of-staff',
      runtime: 'manual',
      kind: 'agent_engagement_request',
      status: 'queued',
      triggeredByUserId: 'admin-user',
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'engagement-run-1',
      eventType: 'agent_engagement_requested',
    }))
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'engagement-run-1',
      artifactType: 'agent_engagement_work_packet',
      title: 'Chief of Staff Agent work packet',
      metadata: expect.objectContaining({
        summary_markdown: expect.stringContaining('Chief of Staff Agent Work Packet'),
        suggested_next_action: expect.any(String),
        executes_action: false,
      }),
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'engagement-run-1',
      stepKey: 'read_only_dispatch',
      metadata: expect.objectContaining({
        execution_mode: 'read_only',
        executes_action: false,
      }),
    }))
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'engagement-run-1',
      artifactType: 'agent_read_only_dispatch',
      title: 'Chief of Staff Agent read-only dispatch',
      metadata: expect.objectContaining({
        summary_markdown: expect.stringContaining('Chief of Staff Agent Read-Only Dispatch'),
        executes_action: false,
      }),
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'engagement-run-1',
      status: 'completed',
      outcome: expect.objectContaining({
        execution_mode: 'read_only',
        executes_action: false,
      }),
    }))
  })

  it('queues planned agents for review without executing a dispatch', async () => {
    const response = await POST(makeRequest({
      agent_key: 'strategic-narrative',
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'engagement-run-1',
      agent_key: 'strategic-narrative',
      agent_name: 'Strategic Narrative Agent',
      status: 'queued',
      work_packet_attached: true,
      dispatch_artifact_attached: false,
      execution_mode: 'queued_for_review',
    })
    expect(mocks.recordAgentStep).not.toHaveBeenCalled()
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('rejects unknown agents', async () => {
    const response = await POST(makeRequest({ agent_key: 'unknown-agent' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown agent_key' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })
})
