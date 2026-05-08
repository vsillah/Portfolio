import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  recordOpenAICost: vi.fn(),
  recordAnthropicCost: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  getLlmJudgePrompt: vi.fn(),
  getChatbotPrompt: vi.fn(),
  getVoiceAgentPrompt: vi.fn(),
  getPromptConfig: vi.fn(),
  from: vi.fn(),
  sessionSelect: vi.fn(),
  sessionEq: vi.fn(),
  sessionSingle: vi.fn(),
  evalUpsert: vi.fn(),
  evalSelect: vi.fn(),
  evalSingle: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mocks.recordOpenAICost,
    recordAnthropicCost: mocks.recordAnthropicCost,
  }
})

vi.mock('@/lib/agent-run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agent-run')>()
  return {
    ...actual,
    startAgentRun: mocks.startAgentRun,
    recordAgentStep: mocks.recordAgentStep,
    recordAgentEvent: mocks.recordAgentEvent,
    endAgentRun: mocks.endAgentRun,
    markAgentRunFailed: mocks.markAgentRunFailed,
  }
})

vi.mock('@/lib/system-prompts', () => ({
  getLlmJudgePrompt: mocks.getLlmJudgePrompt,
  getChatbotPrompt: mocks.getChatbotPrompt,
  getVoiceAgentPrompt: mocks.getVoiceAgentPrompt,
  getPromptConfig: mocks.getPromptConfig,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/llm-judge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/llm-judge', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-openai-key' }

    mocks.verifyAdmin.mockResolvedValue({
      user: { id: 'admin-user-1' },
      isAdmin: true,
    })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.recordOpenAICost.mockResolvedValue(undefined)
    mocks.recordAnthropicCost.mockResolvedValue(undefined)
    mocks.getLlmJudgePrompt.mockResolvedValue('Evaluate the conversation and return JSON with rating, reasoning, confidence, categories, and suggestions.')
    mocks.getChatbotPrompt.mockResolvedValue('Be accurate, concise, and helpful.')
    mocks.getVoiceAgentPrompt.mockResolvedValue('Be accurate, concise, and helpful.')
    mocks.getPromptConfig.mockResolvedValue({
      model: 'claude-sonnet-4-20250514',
      temperature: 0.3,
    })
    mocks.sessionSingle.mockResolvedValue({
      data: {
        session_id: 'session-1',
        visitor_name: 'Taylor Client',
        visitor_email: 'taylor@example.com',
        is_escalated: false,
        chat_messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'Can you help me understand your services?',
            metadata: {},
            created_at: '2026-05-07T10:00:00Z',
          },
          {
            id: 'message-2',
            role: 'assistant',
            content: 'Yes. We help teams adopt practical AI workflows.',
            metadata: {},
            created_at: '2026-05-07T10:00:05Z',
          },
        ],
      },
      error: null,
    })
    mocks.sessionEq.mockReturnValue({ single: mocks.sessionSingle })
    mocks.sessionSelect.mockReturnValue({ eq: mocks.sessionEq })
    mocks.evalSingle.mockResolvedValue({
      data: { id: 'eval-1' },
      error: null,
    })
    mocks.evalSelect.mockReturnValue({ single: mocks.evalSingle })
    mocks.evalUpsert.mockReturnValue({ select: mocks.evalSelect })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_sessions') {
        return { select: mocks.sessionSelect }
      }
      if (table === 'llm_judge_evaluations') {
        return { upsert: mocks.evalUpsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('requires admin auth before starting a trace', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ session_id: 'session-1' }))

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('evaluates a chat session, links LLM cost, and returns agentRunId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 400, completion_tokens: 120, total_tokens: 520 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                rating: 'good',
                reasoning: 'The assistant answered the user clearly.',
                confidence: 0.82,
                categories: [],
                suggestions: ['Keep responses specific.'],
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      session_id: 'session-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt_version: 'v1',
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.agentRunId).toBe('agent-run-1')
    expect(body.evaluation).toMatchObject({
      id: 'eval-1',
      session_id: 'session-1',
      rating: 'good',
      provider: 'openai',
      model: 'gpt-4o-mini',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'llm_judge_chat_eval',
        triggerSource: 'admin:llm_judge',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'chat_eval',
          budget_status: 'allowed',
          session_id: 'session-1',
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'chat_session', id: 'session-1' },
      expect.objectContaining({
        operation: 'chat_eval',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
        outcome: expect.objectContaining({
          evaluation_id: 'eval-1',
          session_id: 'session-1',
          rating: 'good',
        }),
      }),
    )
  })

  it('retries a transient OpenAI judge failure before completing evaluation', async () => {
    process.env.LLM_RETRY_DELAY_MS = '0'
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'temporary provider outage',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          usage: { prompt_tokens: 300, completion_tokens: 90, total_tokens: 390 },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rating: 'good',
                  reasoning: 'The assistant recovered and completed the evaluation.',
                  confidence: 0.79,
                  categories: [],
                }),
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      session_id: 'session-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt_version: 'v1',
    }))

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.objectContaining({ total_tokens: 390 }),
      'gpt-4o-mini',
      { type: 'chat_session', id: 'session-1' },
      expect.objectContaining({
        operation: 'chat_eval',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
      }),
    )
  })

  it('marks the trace failed and returns a safe message when the budget blocks evaluation', async () => {
    mocks.sessionSingle.mockResolvedValue({
      data: {
        session_id: 'session-1',
        visitor_name: 'Taylor Client',
        visitor_email: 'taylor@example.com',
        is_escalated: false,
        chat_messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'x'.repeat(8_000_000),
            metadata: {},
            created_at: '2026-05-07T10:00:00Z',
          },
        ],
      },
      error: null,
    })
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      session_id: 'session-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This chat evaluation is over the current Agent Ops budget limit. Evaluate a shorter session or lower the selected model before retrying.',
      agentRunId: 'agent-run-1',
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        status: 'failed',
      }),
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      expect.stringContaining('Estimated cost'),
      expect.objectContaining({
        operation: 'chat_eval',
        session_id: 'session-1',
      }),
    )
  })
})
