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
    evalResult: vi.fn(),
    generationSingle: vi.fn(),
    reviewInsert: vi.fn(),
    generateAxialCodes: vi.fn(),
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
  generateAxialCodes: mocks.generateAxialCodes,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
  recordAgentStep: mocks.recordAgentStep,
}))

import { POST } from './route'

function request(body?: string) {
  return new NextRequest('http://localhost/api/admin/chat-eval/axial-codes/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('POST /api/admin/chat-eval/axial-codes/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.evalResult.mockResolvedValue({
      data: [
        { open_code: 'price', session_id: 's1', rating: 'bad', notes: '' },
        { open_code: 'price', session_id: 's1', rating: 'good', notes: 'kept' },
        { open_code: 'tone', session_id: 's2', rating: null, notes: null },
      ],
      error: null,
    })
    mocks.generationSingle.mockResolvedValue({ data: { id: 'gen-1' }, error: null })
    mocks.reviewInsert.mockResolvedValue({ error: null })
    mocks.generateAxialCodes.mockResolvedValue({
      axial_codes: [
        {
          code: 'pricing_gap',
          description: 'Price was missing',
          source_open_codes: ['price'],
          source_sessions: ['s1'],
        },
      ],
    })
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_evaluations') {
        return {
          select: () => ({
            in: () => ({ not: () => mocks.evalResult() }),
          }),
        }
      }
      if (table === 'axial_code_generations') {
        return {
          insert: (payload: unknown) => ({
            select: () => ({ single: () => mocks.generationSingle(payload) }),
          }),
        }
      }
      if (table === 'axial_code_reviews') {
        return { insert: mocks.reviewInsert }
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('rejects non-admins and empty session lists before querying', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)
    const unauthorized = await POST(request(JSON.stringify({ session_ids: ['s1'] })))
    expect(unauthorized.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.isAuthError.mockReturnValue(false)
    const missing = await POST(request(JSON.stringify({ session_ids: [] })))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'session_ids array is required' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('stops when no selected session has an open code', async () => {
    mocks.evalResult.mockResolvedValue({ data: [], error: null })

    const response = await POST(request(JSON.stringify({ session_ids: ['s1'] })))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'No sessions with open codes found in the selection',
    })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('returns a generic error when evaluations cannot be loaded', async () => {
    mocks.evalResult.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const response = await POST(request(JSON.stringify({ session_ids: ['s1'] })))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch evaluations' })
    expect(mocks.generateAxialCodes).not.toHaveBeenCalled()
  })

  it('dedupes codes, falls back to the default model, and still succeeds when review inserts fail', async () => {
    mocks.reviewInsert.mockResolvedValue({ error: { message: 'review write failed' } })

    const response = await POST(
      request(JSON.stringify({ session_ids: ['s1', 's2'], provider: 'openai', model: 'not-a-model' }))
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.generateAxialCodes).toHaveBeenCalledWith(
      [
        { code: 'price', sessionId: 's1', rating: 'bad', notes: undefined },
        { code: 'price', sessionId: 's1', rating: 'good', notes: 'kept' },
        { code: 'tone', sessionId: 's2', rating: null, notes: undefined },
      ],
      {
        provider: 'openai',
        model: 'claude-sonnet-4-20250514',
        promptVersion: 'v1',
        temperature: 0.3,
      },
      expect.objectContaining({ agentRunId: 'run-1', operation: 'axial_codes' })
    )
    expect(mocks.generationSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        source_session_ids: ['s1', 's2'],
        source_open_codes: ['price', 'tone'],
        model_used: 'claude-sonnet-4-20250514',
        status: 'pending',
        created_by: 'admin-user',
      })
    )
    expect(mocks.reviewInsert).toHaveBeenCalledWith([
      {
        generation_id: 'gen-1',
        original_code: 'pricing_gap',
        original_description: 'Price was missing',
        mapped_open_codes: ['price'],
        mapped_session_ids: ['s1'],
        status: 'pending',
      },
    ])
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: expect.objectContaining({ review_error: 'review write failed' }),
      })
    )
    expect(body).toEqual({
      generation_id: 'gen-1',
      agentRunId: 'run-1',
      axial_codes: [
        {
          code: 'pricing_gap',
          description: 'Price was missing',
          source_open_codes: ['price'],
          source_sessions: ['s1'],
        },
      ],
      source_sessions_count: 2,
      source_open_codes_count: 2,
      model_used: 'claude-sonnet-4-20250514',
    })
  })

  it('keeps a known OpenAI model and fails the agent run when storage fails', async () => {
    mocks.generationSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } })

    const response = await POST(
      request(JSON.stringify({ session_ids: ['s1'], provider: 'openai', model: 'gpt-4o-mini' }))
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to store generation result' })
    expect(mocks.generateAxialCodes.mock.calls[0][1].model).toBe('gpt-4o-mini')
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'run-1',
      'Failed to store axial code generation',
      expect.objectContaining({ operation: 'axial_codes' })
    )
    expect(mocks.reviewInsert).not.toHaveBeenCalled()
  })

  it('returns the budget message and a generic message for non-Error failures', async () => {
    mocks.generateAxialCodes.mockRejectedValueOnce(new mocks.LlmJudgeBudgetError('over cap'))
    const budget = await POST(request(JSON.stringify({ session_ids: ['s1'] })))
    expect(budget.status).toBe(400)
    expect(await budget.json()).toEqual({
      error:
        'This axial code generation request is over the current Agent Ops budget limit. Select fewer sessions or use a lower-cost model before retrying.',
      agentRunId: 'run-1',
    })
    expect(mocks.markAgentRunFailed).toHaveBeenCalled()

    mocks.generateAxialCodes.mockRejectedValueOnce('nope')
    const unknown = await POST(request(JSON.stringify({ session_ids: ['s1'] })))
    expect(unknown.status).toBe(500)
    expect(await unknown.json()).toEqual({ error: 'Internal server error' })
  })
})
