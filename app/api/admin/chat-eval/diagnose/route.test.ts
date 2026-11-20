import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class LlmJudgeBudgetError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'LlmJudgeBudgetError'
    }
  }

  return {
    LlmJudgeBudgetError,
    verifyAdmin: vi.fn(),
    isAuthError: vi.fn(),
    from: vi.fn(),
    sessionSingle: vi.fn(),
    evaluationResult: vi.fn(),
    evaluationEq: vi.fn(),
    diagnosisSingle: vi.fn(),
    diagnoseError: vi.fn(),
    getChatbotPrompt: vi.fn(),
    getVoiceAgentPrompt: vi.fn(),
    startAgentRun: vi.fn(),
    endAgentRun: vi.fn(),
    markAgentRunFailed: vi.fn(),
    recordAgentStep: vi.fn(),
  }
})

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/llm-judge', () => ({
  LlmJudgeBudgetError: mocks.LlmJudgeBudgetError,
  DEFAULT_JUDGE_CONFIG: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    promptVersion: 'v1',
    temperature: 0.3,
  },
  AVAILABLE_MODELS: {
    anthropic: [{ id: 'claude-sonnet-4-20250514' }, { id: 'claude-3-5-haiku-20241022' }],
    openai: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
  },
  diagnoseError: mocks.diagnoseError,
}))

vi.mock('@/lib/system-prompts', () => ({
  getChatbotPrompt: mocks.getChatbotPrompt,
  getVoiceAgentPrompt: mocks.getVoiceAgentPrompt,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
  recordAgentStep: mocks.recordAgentStep,
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/chat-eval/diagnose', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function session(messages: Array<Record<string, unknown>>) {
  return {
    session_id: 'sess-1',
    visitor_name: 'Ada',
    visitor_email: 'ada@example.com',
    is_escalated: false,
    metadata: { source: 'site' },
    chat_messages: messages,
  }
}

describe('POST /api/admin/chat-eval/diagnose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.sessionSingle.mockResolvedValue({
      data: session([
        {
          id: 'm2',
          role: 'assistant',
          content: 'Later',
          created_at: '2026-09-02T00:00:00.000Z',
          metadata: { source: 'chatbot', isToolCall: true, toolCall: { name: 'lookup' } },
        },
        {
          id: 'm1',
          role: 'user',
          content: 'Earlier',
          created_at: '2026-09-01T00:00:00.000Z',
          metadata: { source: 'sms' },
        },
      ]),
      error: null,
    })
    mocks.evaluationResult.mockResolvedValue({
      data: [
        {
          id: 'eval-1',
          notes: 'missed price',
          tags: ['pricing'],
          category_id: 'cat-1',
          open_code: 'price',
          evaluation_categories: { id: 'cat-1', name: 'Pricing', description: 'Money', color: '#fff' },
        },
      ],
      error: null,
    })
    mocks.evaluationEq.mockImplementation(() => evaluationQuery())
    mocks.diagnosisSingle.mockResolvedValue({ data: { id: 'diag-1' }, error: null })
    mocks.diagnoseError.mockResolvedValue({
      root_cause: 'Prompt omitted the price',
      error_type: 'omission',
      confidence: 0.8,
      diagnosis_details: { field: 'price' },
      recommendations: [{ id: 'rec-1' }],
    })
    mocks.getChatbotPrompt.mockResolvedValue('chat-prompt')
    mocks.getVoiceAgentPrompt.mockResolvedValue('voice-prompt')
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_sessions') {
        return { select: () => ({ eq: () => ({ single: mocks.sessionSingle }) }) }
      }
      if (table === 'chat_evaluations') {
        return { select: () => ({ eq: () => ({ eq: mocks.evaluationEq }) }) }
      }
      if (table === 'error_diagnoses') {
        return {
          insert: (payload: unknown) => ({
            select: () => ({ single: () => mocks.diagnosisSingle(payload) }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  function evaluationQuery() {
    const query = {
      eq: vi.fn(() => query),
      then: (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) => mocks.evaluationResult().then(resolve, reject),
    }
    return query
  }

  it('rejects non-admins and a missing session id before any lookup', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)
    const unauthorized = await POST(request({ session_id: 'sess-1' }))
    expect(unauthorized.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.isAuthError.mockReturnValue(false)
    const missing = await POST(request({ session_id: '' }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'session_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the session or a bad evaluation is missing', async () => {
    mocks.sessionSingle.mockResolvedValueOnce({ data: null, error: { message: 'missing' } })
    const missingSession = await POST(request({ session_id: 'sess-1' }))
    expect(missingSession.status).toBe(404)
    expect(await missingSession.json()).toEqual({ error: 'Session not found' })

    mocks.evaluationResult.mockResolvedValueOnce({ data: [], error: null })
    const missingEval = await POST(request({ session_id: 'sess-1' }))
    expect(missingEval.status).toBe(404)
    expect(await missingEval.json()).toEqual({
      error: 'No bad-rated evaluation found for this session',
    })
    expect(mocks.diagnoseError).not.toHaveBeenCalled()
  })

  it('sorts messages, prefers voice, and filters by evaluation id', async () => {
    mocks.sessionSingle.mockResolvedValue({
      data: session([
        {
          role: 'assistant',
          content: 'Voice reply',
          created_at: '2026-09-03T00:00:00.000Z',
          metadata: { source: 'voice', isToolCall: false },
        },
        {
          role: 'user',
          content: 'First',
          created_at: '2026-09-01T00:00:00.000Z',
          metadata: { channel: 'email' },
        },
      ]),
      error: null,
    })

    const response = await POST(
      request({ session_id: 'sess-1', evaluation_id: 'eval-9', provider: 'openai', model: 'gpt-4o' })
    )

    expect(response.status).toBe(200)
    expect(mocks.evaluationEq).toHaveBeenCalledWith('rating', 'bad')
    const extraEq = mocks.evaluationEq.mock.results[0]?.value.eq
    expect(extraEq).toHaveBeenCalledWith('id', 'eval-9')
    expect(mocks.getVoiceAgentPrompt).toHaveBeenCalled()
    expect(mocks.getChatbotPrompt).not.toHaveBeenCalled()
    const diagnosedMessages = mocks.diagnoseError.mock.calls[0][0].messages
    expect(diagnosedMessages[0].metadata).toBeUndefined()
    expect(diagnosedMessages[1].metadata).toBeUndefined()
    expect(mocks.diagnoseError).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'voice',
        messages: [
          expect.objectContaining({ content: 'First' }),
          expect.objectContaining({ content: 'Voice reply' }),
        ],
      }),
      expect.objectContaining({
        id: 'eval-1',
        rating: 'bad',
        category: { name: 'Pricing', description: 'Money' },
      }),
      'voice-prompt',
      {
        provider: 'openai',
        model: 'gpt-4o',
        promptVersion: 'v1',
        temperature: 0.3,
      },
      expect.objectContaining({ operation: 'diagnose', agentRunId: 'run-1' })
    )
    expect(mocks.diagnosisSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'sess-1',
        evaluation_id: 'eval-1',
        diagnosed_by: 'admin-user',
        model_used: 'gpt-4o',
        status: 'pending',
      })
    )
    expect(await response.json()).toEqual({
      diagnosis_id: 'diag-1',
      agentRunId: 'run-1',
      diagnosis: {
        root_cause: 'Prompt omitted the price',
        error_type: 'omission',
        confidence: 0.8,
        diagnosis_details: { field: 'price' },
        recommendations: [{ id: 'rec-1' }],
      },
    })
  })

  it('maps a non-voice session to text and continues when the chatbot prompt fails', async () => {
    mocks.getChatbotPrompt.mockRejectedValue(new Error('prompt down'))

    const response = await POST(request({ session_id: 'sess-1', model: 'missing-model' }))

    expect(response.status).toBe(200)
    expect(mocks.getVoiceAgentPrompt).not.toHaveBeenCalled()
    const [sessionData, , systemPrompt, config] = mocks.diagnoseError.mock.calls[0]
    expect(sessionData.channel).toBe('text')
    expect(sessionData.messages.map((message: { content: string }) => message.content)).toEqual([
      'Earlier',
      'Later',
    ])
    expect(sessionData.messages[1].metadata).toEqual({ isToolCall: true, toolCall: { name: 'lookup' } })
    expect(systemPrompt).toBeUndefined()
    expect(config.provider).toBe('anthropic')
    expect(config.model).toBe('claude-sonnet-4-20250514')
  })

  it('fails the agent run when the diagnosis cannot be stored', async () => {
    mocks.diagnosisSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    const response = await POST(request({ session_id: 'sess-1' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to store diagnosis' })
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'run-1',
      'Failed to store diagnosis',
      expect.objectContaining({ session_id: 'sess-1', evaluation_id: 'eval-1' })
    )
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })

  it('returns the budget message and hides non-Error failures', async () => {
    mocks.diagnoseError.mockRejectedValueOnce(new mocks.LlmJudgeBudgetError('over cap'))
    const budget = await POST(request({ session_id: 'sess-1' }))
    expect(budget.status).toBe(400)
    expect(await budget.json()).toEqual({
      error:
        'This chat error diagnosis is over the current Agent Ops budget limit. Use a shorter session or lower-cost model before retrying.',
      agentRunId: 'run-1',
    })

    mocks.diagnoseError.mockRejectedValueOnce('nope')
    const unknown = await POST(request({ session_id: 'sess-1' }))
    expect(unknown.status).toBe(500)
    expect(await unknown.json()).toEqual({ error: 'Internal server error' })
  })
})
