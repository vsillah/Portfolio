import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  generateAIOnboardingContent: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/ai-onboarding-generator', () => ({
  generateAIOnboardingContent: mocks.generateAIOnboardingContent,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/proposals/generate-onboarding-content', {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/proposals/generate-onboarding-content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.generateAIOnboardingContent.mockResolvedValue({
      setup_requirements: [],
      milestones: [],
      access_needs: ['Admin access'],
      tools_and_platforms: ['Google Workspace'],
      client_actions: ['Name the kickoff owner'],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ line_items: [] }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('rejects missing line items before creating a run', async () => {
    const response = await POST(makeRequest({ client_name: 'Test Client' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'line_items array is required' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('creates a traced manual run and passes agentRunId to the generator', async () => {
    const response = await POST(makeRequest({
      client_name: 'Test Client',
      client_company: 'Acme',
      bundle_name: 'AI Accelerator',
      line_items: [
        {
          title: 'Automation setup',
          content_type: 'service',
          price: 2500,
        },
      ],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      agent_run_id: 'agent-run-1',
      content: expect.objectContaining({
        access_needs: ['Admin access'],
      }),
    }))
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'proposal-business-model',
      runtime: 'manual',
      kind: 'generate_onboarding_content',
      triggeredByUserId: 'admin-user',
      metadata: expect.objectContaining({
        operation: 'generate_onboarding_content',
        execution_mode: 'admin_preview',
        production_mutation_allowed: false,
      }),
    }))
    expect(mocks.generateAIOnboardingContent).toHaveBeenCalledWith(expect.objectContaining({
      agentRunId: 'agent-run-1',
      client_name: 'Test Client',
      bundle_name: 'AI Accelerator',
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      status: 'completed',
      currentStep: 'Onboarding content ready',
    }))
  })

  it('marks the traced run failed when generation fails', async () => {
    mocks.generateAIOnboardingContent.mockRejectedValue(new Error('budget blocked'))

    const response = await POST(makeRequest({
      client_name: 'Test Client',
      line_items: [
        {
          title: 'Automation setup',
          content_type: 'service',
          price: 2500,
        },
      ],
    }) as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to generate onboarding content' })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      'budget blocked',
      { operation: 'generate_onboarding_content' },
    )
  })
})
