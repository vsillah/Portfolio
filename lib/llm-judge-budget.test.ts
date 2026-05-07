import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordOpenAICost: vi.fn(),
  recordAnthropicCost: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mocks.recordOpenAICost,
    recordAnthropicCost: mocks.recordAnthropicCost,
  }
})

vi.mock('@/lib/agent-run', () => {
  return {
    recordAgentStep: mocks.recordAgentStep,
    recordAgentEvent: mocks.recordAgentEvent,
  }
})

vi.mock('@/lib/system-prompts', () => ({
  getLlmJudgePrompt: vi.fn(),
  getChatbotPrompt: vi.fn(),
  getVoiceAgentPrompt: vi.fn(),
  getPromptConfig: vi.fn(),
}))

import {
  diagnoseError,
  generateAxialCodes,
  LlmJudgeBudgetError,
  type EvaluationData,
  type SessionData,
} from './llm-judge'

describe('llm-judge budget adoption', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-openai-key' }
    mocks.recordOpenAICost.mockResolvedValue(undefined)
    mocks.recordAnthropicCost.mockResolvedValue(undefined)
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('links axial-code cost events to the provided agent run', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 300, completion_tokens: 80, total_tokens: 380 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                axial_codes: [
                  {
                    code: 'Follow-up Quality',
                    description: 'Follow-up gaps and missed next steps.',
                    source_open_codes: ['missed follow-up'],
                  },
                ],
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await generateAxialCodes(
      [{ code: 'missed follow-up', sessionId: 'session-1', rating: 'bad' }],
      { provider: 'openai', model: 'gpt-4o-mini', promptVersion: 'v1', temperature: 0.3 },
      {
        agentRunId: 'agent-run-1',
        reference: { type: 'chat_eval_axial_codes', id: 'agent-run-1' },
        operation: 'axial_codes',
      },
    )

    expect(result.axial_codes).toHaveLength(1)
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'axial_codes',
          budget_status: 'allowed',
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'chat_eval_axial_codes', id: 'agent-run-1' },
      expect.objectContaining({
        operation: 'axial_codes',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
  })

  it('blocks oversized diagnosis prompts before dispatch', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const session: SessionData = {
      session_id: 'session-1',
      channel: 'text',
      messages: [
        {
          role: 'user',
          content: 'x'.repeat(8_000_000),
        },
      ],
    }
    const evaluation: EvaluationData = {
      id: 'eval-1',
      rating: 'bad',
      notes: 'The answer failed.',
    }

    await expect(
      diagnoseError(
        session,
        evaluation,
        'System prompt',
        { provider: 'openai', model: 'gpt-4o-mini', promptVersion: 'v1', temperature: 0.3 },
        {
          agentRunId: 'agent-run-1',
          reference: { type: 'chat_eval_diagnosis', id: 'session-1' },
          operation: 'diagnose',
        },
      ),
    ).rejects.toBeInstanceOf(LlmJudgeBudgetError)

    expect(mockFetch).not.toHaveBeenCalled()
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        status: 'failed',
        metadata: expect.objectContaining({
          operation: 'diagnose',
          budget_status: 'blocked',
        }),
      }),
    )
  })
})
