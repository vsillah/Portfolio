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
    sessions: new Map<string, { data: unknown; error: unknown }>(),
    evaluations: new Map<string, { data: unknown; error: unknown }>(),
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
    anthropic: [{ id: 'claude-sonnet-4-20250514' }],
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

function request(body?: string) {
  return new NextRequest('http://localhost/api/admin/chat-eval/diagnose/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function seedSession(id: string, source: string) {
  mocks.sessions.set(id, {
    data: {
      session_id: id,
      visitor_name: null,
      visitor_email: null,
      is_escalated: false,
      metadata: null,
      chat_messages: [
        {
          role: 'assistant',
          content: `Reply ${id}`,
          created_at: '2026-09-01T00:00:00.000Z',
          metadata: { source },
        },
      ],
    },
    error: null,
  })
  mocks.evaluations.set(id, {
    data: {
      id: `eval-${id}`,
      notes: null,
      tags: [],
      category_id: null,
      open_code: null,
      evaluation_categories: null,
    },
    error: null,
  })
}

describe('POST /api/admin/chat-eval/diagnose/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessions.clear()
    mocks.evaluations.clear()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getChatbotPrompt.mockResolvedValue('chat-prompt')
    mocks.getVoiceAgentPrompt.mockResolvedValue('voice-prompt')
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.diagnoseError.mockImplementation(async (sessionData: { session_id: string }) => {
      if (sessionData.session_id === 'over-budget') {
        throw new mocks.LlmJudgeBudgetError('over cap')
      }
      if (sessionData.session_id === 'explode') {
        throw 'nope'
      }
      return {
        root_cause: 'cause',
        error_type: 'omission',
        confidence: 0.5,
        diagnosis_details: {},
        recommendations: [],
      }
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_sessions') {
        return {
          select: () => ({
            eq: (_column: string, sessionId: string) => ({
              single: async () => mocks.sessions.get(sessionId) ?? { data: null, error: { message: 'missing' } },
            }),
          }),
        }
      }
      if (table === 'chat_evaluations') {
        return {
          select: () => ({
            eq: (_column: string, sessionId: string) => ({
              eq: () => ({
                limit: (count: number) => ({
                  single: async () => {
                    if (count !== 1) throw new Error(`unexpected limit ${count}`)
                    return mocks.evaluations.get(sessionId) ?? { data: null, error: null }
                  },
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'error_diagnoses') {
        return {
          insert: (payload: { session_id: string }) => ({
            select: () => ({
              single: async () => {
                if (payload.session_id === 'store-fail') {
                  return { data: null, error: { message: 'insert failed' } }
                }
                return { data: { id: `diag-${payload.session_id}` }, error: null }
              },
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('rejects non-admins, invalid JSON, and an empty session list before starting a run', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)
    const unauthorized = await POST(request(JSON.stringify({ session_ids: ['s1'] })))
    expect(unauthorized.status).toBe(401)

    mocks.isAuthError.mockReturnValue(false)
    const invalid = await POST(request('not-json'))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })

    const empty = await POST(request(JSON.stringify({ session_ids: [] })))
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'session_ids array is required' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('keeps going per session and completes the run when at least one diagnosis is stored', async () => {
    seedSession('voice-1', 'voice')
    seedSession('store-fail', 'sms')
    seedSession('over-budget', 'chatbot')
    seedSession('explode', 'chatbot')
    mocks.sessions.set('missing-eval', {
      data: { session_id: 'missing-eval', chat_messages: [], visitor_name: null, visitor_email: null, is_escalated: false, metadata: null },
      error: null,
    })

    const response = await POST(
      request(
        JSON.stringify({
          session_ids: ['gone', 'missing-eval', 'store-fail', 'over-budget', 'explode', 'voice-1'],
          provider: 'openai',
          model: 'gpt-4o-mini',
        })
      )
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary).toEqual({ total: 6, successful: 1, failed: 5 })
    expect(body.results).toEqual([
      { session_id: 'gone', success: false, error: 'Session not found' },
      { session_id: 'missing-eval', success: false, error: 'No bad-rated evaluation found' },
      { session_id: 'store-fail', success: false, error: 'Failed to store diagnosis' },
      {
        session_id: 'over-budget',
        success: false,
        error:
          'This chat error diagnosis is over the current Agent Ops budget limit. Use a shorter session or lower-cost model before retrying.',
      },
      { session_id: 'explode', success: false, error: 'Unknown error' },
      { session_id: 'voice-1', success: true, diagnosis_id: 'diag-voice-1' },
    ])
    expect(mocks.diagnoseError).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'voice-1', channel: 'voice' }),
      expect.any(Object),
      'voice-prompt',
      expect.objectContaining({ provider: 'openai', model: 'gpt-4o-mini' }),
      expect.objectContaining({ agentRunId: 'run-1', operation: 'diagnose' })
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: expect.objectContaining({ total: 6, successful: 1, failed: 5 }),
      })
    )
    expect(mocks.markAgentRunFailed).not.toHaveBeenCalled()
  })

  it('marks the agent run failed but still returns 200 when every session fails', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const response = await POST(request(JSON.stringify({ session_ids: ids })))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary).toEqual({ total: 6, successful: 0, failed: 6 })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.objectContaining({ id: 'a,b,c,d,e', label: '6 session(s)' }),
      })
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'run-1',
      'All batch chat error diagnoses failed',
      expect.objectContaining({ total: 6, successful: 0, failed: 6 })
    )
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
    expect(mocks.diagnoseError).not.toHaveBeenCalled()
  })

  it('uses the chatbot prompt for non-voice sessions and swallows prompt lookup failures', async () => {
    seedSession('text-1', 'sms')
    mocks.getChatbotPrompt.mockRejectedValue(new Error('prompt down'))

    const response = await POST(request(JSON.stringify({ session_ids: ['text-1'] })))

    expect(response.status).toBe(200)
    expect(mocks.getVoiceAgentPrompt).not.toHaveBeenCalled()
    expect(mocks.diagnoseError.mock.calls[0][0].channel).toBe('text')
    expect(mocks.diagnoseError.mock.calls[0][2]).toBeUndefined()
  })
})
