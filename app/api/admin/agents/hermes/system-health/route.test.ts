import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  buildSummary: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  attachAgentArtifact: mocks.attachAgentArtifact,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

vi.mock('@/lib/hermes-system-health', () => ({
  buildHermesSystemHealthSummary: mocks.buildSummary,
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/hermes/system-health', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
  })
}

describe('POST /api/admin/agents/hermes/system-health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.buildSummary.mockResolvedValue({
      generatedAt: '2026-04-30T20:00:00.000Z',
      overall: 'warning',
      summaryMarkdown: '# Hermes System Health Summary\n\nOverall: warning',
      warnings: ['MOCK_N8N is enabled'],
      signals: {
        database: 'connected',
        n8n: { deploymentTier: 'staging', mockEnabled: true, outboundDisabled: false },
        agentRuns24h: { total: 2, failed: 0, stale: 0, running: 1, byRuntime: { n8n: 1, hermes: 1 } },
        costs24h: { totalUsd: 0.001, events: 1 },
        workflows: {
          socialContent: { ok: true, data: [] },
          valueEvidence: { ok: true, data: [] },
          warmLeads: { ok: true, data: [] },
        },
      },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('creates a read-only Hermes run and attaches the summary artifact', async () => {
    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      run_id: 'agent-run-1',
      overall: 'warning',
    }))

    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'hermes-secondary',
      runtime: 'hermes',
      kind: 'system_health_summary',
      triggeredByUserId: 'admin-user',
      metadata: expect.objectContaining({
        execution_mode: 'bridge_read_only',
        production_mutation_allowed: false,
        requires_approval_for_writes: true,
      }),
    }))
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      artifactType: 'system_health_summary',
      metadata: expect.objectContaining({
        summary_markdown: expect.stringContaining('Hermes System Health Summary'),
      }),
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      status: 'completed',
    }))
  })
})
