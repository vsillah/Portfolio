import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  evaluateRuntimeAvailability: vi.fn(),
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

vi.mock('@/lib/agent-runtime-evaluation', () => ({
  evaluateRuntimeAvailability: mocks.evaluateRuntimeAvailability,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/agents/runtime-evaluation', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/runtime-evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'runtime-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.evaluateRuntimeAvailability.mockResolvedValue({
      runtime: 'opencode',
      available: false,
      executable: null,
      probes: [{ command: 'opencode', found: false, path: null }],
      safeForProductionAutomation: false,
      nextSteps: ['Install and authenticate OpenCode/OpenClaw before assigning production work.'],
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

  it('creates an observable failed run when OpenCode is unavailable', async () => {
    const response = await POST(makeRequest({ runtime: 'opencode' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: false,
      run_id: 'runtime-run-1',
      runtime: 'opencode',
      available: false,
    }))
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'opencode-evaluation',
      runtime: 'opencode',
      kind: 'runtime_evaluation',
      triggeredByUserId: 'admin-user',
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'runtime-run-1',
      status: 'failed',
    }))
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: 'runtime_evaluation',
    }))
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'runtime-run-1',
      'OpenCode/OpenClaw command not installed or not on PATH',
      expect.objectContaining({ available: false }),
    )
  })

  it('rejects unsupported runtime targets', async () => {
    const response = await POST(makeRequest({ runtime: 'codex' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unsupported runtime evaluation target' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })
})
