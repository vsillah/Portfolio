import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatAgent } from './chat-agent'
import type { ChatAgentConfig, TestPersona, TestScenario } from './types'

const persona: TestPersona = {
  id: 'persona-1',
  name: 'Anna',
  company: 'Berin Studio',
  email: 'test-anna@example.com',
  role: 'decision_maker',
  urgency: 'medium',
  budget: '$5K-$15K',
  techSavvy: 6,
  decisionTimeline: '30_days',
  painPoints: ['manual follow-up'],
  interestAreas: ['ai_automation'],
  communicationStyle: 'brief',
  objectionProbability: 0.2,
  commonObjections: ['Will this add more work?'],
}

const scenario: TestScenario = {
  id: 'scenario-1',
  name: 'Chat inquiry',
  description: 'A prospect asks about automation.',
  journeyStage: 'prospect',
  steps: [],
  variability: {
    skipProbability: {},
    delayRange: [0, 0],
    responseVariation: false,
  },
  expectedOutcomes: {
    mustComplete: [],
    mustNotError: [],
    dataValidation: [],
  },
  estimatedDuration: 0,
  tags: ['chat'],
}

function config(overrides: Partial<ChatAgentConfig> = {}): ChatAgentConfig {
  return {
    persona,
    scenario,
    llmProvider: 'openai',
    model: 'gpt-4o-mini',
    maxTurns: 5,
    responseDelay: [0, 1],
    temperature: 0.7,
    ...overrides,
  }
}

describe('ChatAgent provider retries', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      LLM_RETRY_DELAY_MS: '0',
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('retries transient OpenAI failures before returning a generated client response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        text: async () => 'temporarily unavailable',
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Yes, I want the workflow to feel lighter.' } }],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const agent = new ChatAgent(config())
    const response = await agent.generateResponse('What brings you here?')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(response).toEqual({
      message: 'Yes, I want the workflow to feel lighter.',
      shouldContinue: true,
    })
  })

  it('retries transient Anthropic failures before returning a generated client response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        text: async () => 'temporarily unavailable',
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          content: [{ text: 'I need help reducing manual follow-up.' }],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const agent = new ChatAgent(config({ llmProvider: 'anthropic', model: 'claude-3-haiku-20240307' }))
    const response = await agent.generateResponse('What brings you here?')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(response).toEqual({
      message: 'I need help reducing manual follow-up.',
      shouldContinue: true,
    })
  })
})
