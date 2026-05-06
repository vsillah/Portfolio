import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordOpenAICost: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mocks.recordOpenAICost,
  }
})

vi.mock('@/lib/agent-run', () => ({
  recordAgentStep: mocks.recordAgentStep,
  recordAgentEvent: mocks.recordAgentEvent,
}))

describe('ai-onboarding-generator budget policy', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                setup_requirements: [],
                milestones: [],
                access_needs: ['Workspace admin access'],
                tools_and_platforms: ['Google Workspace'],
                client_actions: ['Confirm kickoff owner'],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.OPENAI_API_KEY = 'sk-test-key'
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.recordOpenAICost.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('allows a normal onboarding prompt within the manual admin budget', async () => {
    const { evaluateAIOnboardingBudget } = await import('./ai-onboarding-generator')

    const decision = evaluateAIOnboardingBudget({
      userPrompt: 'Generate onboarding content for one small proposal.',
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('blocks oversized onboarding prompts before OpenAI dispatch', async () => {
    const { evaluateAIOnboardingBudget } = await import('./ai-onboarding-generator')

    const decision = evaluateAIOnboardingBudget({
      model: 'gpt-4o',
      userPrompt: 'x'.repeat(2_000_000),
      maxTokens: 100_000,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.reason).toContain('Manual admin LLM call cap')
  })

  it('records budget metadata when generation succeeds with an agent run', async () => {
    const { generateAIOnboardingContent } = await import('./ai-onboarding-generator')

    const result = await generateAIOnboardingContent({
      agentRunId: 'agent-run-1',
      client_name: 'Test Client',
      bundle_name: 'AI Accelerator',
      line_items: [
        {
          title: 'Automation setup',
          description: 'Configure workspace automation',
          content_type: 'service',
          price: 2500,
        },
      ],
    })

    expect(result.access_needs).toEqual(['Workspace admin access'])
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      stepKey: 'budget_check',
      status: 'completed',
      metadata: expect.objectContaining({
        budget_status: 'allowed',
        budget_rule_key: 'llm_manual_per_call',
        client_name: 'Test Client',
        bundle_name: 'AI Accelerator',
      }),
    }))
    expect(mocks.recordAgentEvent).not.toHaveBeenCalled()
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.objectContaining({ prompt_tokens: 100 }),
      'gpt-4o-mini',
      { type: 'proposal', id: 'onboarding-preview' },
      expect.objectContaining({
        operation: 'generate_onboarding_content',
        budget_status: 'allowed',
        budget_rule_key: 'llm_manual_per_call',
      }),
      'agent-run-1',
    )
  })

  it('rejects generation before fetch when the budget check blocks', async () => {
    const { generateAIOnboardingContent } = await import('./ai-onboarding-generator')

    await expect(
      generateAIOnboardingContent({
        line_items: [
          {
            title: 'Huge implementation',
            description: 'x'.repeat(8_000_000),
            content_type: 'service',
            price: 2500,
          },
        ],
      }),
    ).rejects.toThrow('Manual admin LLM call cap')

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
