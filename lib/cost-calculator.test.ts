import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.fromMock,
  },
}))

import {
  computeAnthropicCost,
  computeOpenAICost,
  recordAnthropicCost,
  recordCostEvent,
  recordOpenAICost,
} from './cost-calculator'

describe('cost calculator pricing', () => {
  it('computes OpenAI cost using known model rates', () => {
    const cost = computeOpenAICost(
      { prompt_tokens: 100_000, completion_tokens: 50_000 },
      'gpt-4o'
    )
    expect(cost).toBeCloseTo(0.75, 10)
  })

  it('falls back to default OpenAI rates for unknown models', () => {
    const cost = computeOpenAICost(
      { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 },
      'unknown-model'
    )
    expect(cost).toBeCloseTo(12.5, 10)
  })

  it('splits OpenAI total_tokens when prompt/completion tokens are missing', () => {
    const cost = computeOpenAICost({ total_tokens: 1_000_001 }, 'gpt-4o-mini')
    // floor(1_000_001 / 2) => 500_000 prompt, 500_001 completion
    expect(cost).toBeCloseTo(0.3750006, 10)
  })

  it('computes Anthropic cost from input/output token fields', () => {
    const cost = computeAnthropicCost(
      { input_tokens: 200_000, output_tokens: 100_000 },
      'claude-3-5-sonnet-20241022'
    )
    expect(cost).toBeCloseTo(2.1, 10)
  })

  it('falls back to default Anthropic rates for unknown models', () => {
    const cost = computeAnthropicCost(
      { input_tokens: 1_000_000, output_tokens: 1_000_000 },
      'unknown-model'
    )
    expect(cost).toBeCloseTo(18, 10)
  })
})

describe('recordCostEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromMock.mockReturnValue({ insert: mocks.insertMock })
    mocks.insertMock.mockResolvedValue({ error: null })
  })

  it('inserts rounded amount with default currency and nullable fields', async () => {
    const result = await recordCostEvent({
      occurred_at: '2026-03-11T10:00:00.000Z',
      source: 'llm_openai',
      amount: 1.23456,
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.fromMock).toHaveBeenCalledWith('cost_events')
    expect(mocks.insertMock).toHaveBeenCalledWith({
      occurred_at: '2026-03-11T10:00:00.000Z',
      source: 'llm_openai',
      amount: 1.2346,
      currency: 'usd',
      reference_type: null,
      reference_id: null,
      metadata: {},
    })
  })

  it('treats duplicate insert errors as idempotent success', async () => {
    mocks.insertMock.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const result = await recordCostEvent({
      occurred_at: '2026-03-11T10:00:00.000Z',
      source: 'llm_openai',
      amount: 0.42,
    })

    expect(result).toEqual({ ok: true })
  })

  it('returns failure for non-duplicate insert errors', async () => {
    mocks.insertMock.mockResolvedValue({
      error: { code: '22P02', message: 'invalid input syntax' },
    })

    const result = await recordCostEvent({
      occurred_at: '2026-03-11T10:00:00.000Z',
      source: 'llm_openai',
      amount: 0.42,
    })

    expect(result).toEqual({ ok: false, error: 'invalid input syntax' })
  })

  it('returns failure when insert throws', async () => {
    mocks.insertMock.mockRejectedValue(new Error('db unavailable'))

    const result = await recordCostEvent({
      occurred_at: '2026-03-11T10:00:00.000Z',
      source: 'llm_openai',
      amount: 0.42,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('db unavailable')
  })
})

describe('recordOpenAICost / recordAnthropicCost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fromMock.mockReturnValue({ insert: mocks.insertMock })
    mocks.insertMock.mockResolvedValue({ error: null })
  })

  it('records OpenAI cost event with source and merged metadata', async () => {
    await recordOpenAICost(
      { prompt_tokens: 1_000_000, completion_tokens: 0 },
      'gpt-4o-mini',
      { type: 'diagnostic_audit', id: 'audit-123' },
      { operation: 'generate_insights' }
    )

    expect(mocks.insertMock).toHaveBeenCalledTimes(1)
    expect(mocks.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'llm_openai',
        amount: 0.15,
        currency: 'usd',
        reference_type: 'diagnostic_audit',
        reference_id: 'audit-123',
        metadata: { model: 'gpt-4o-mini', operation: 'generate_insights' },
      })
    )
  })

  it('skips OpenAI record insertion when computed amount is zero', async () => {
    await recordOpenAICost({ prompt_tokens: 0, completion_tokens: 0 }, 'gpt-4o-mini')
    expect(mocks.insertMock).not.toHaveBeenCalled()
  })

  it('records Anthropic cost event with correct source', async () => {
    await recordAnthropicCost(
      { input_tokens: 1_000_000, output_tokens: 0 },
      'claude-3-5-sonnet-20241022'
    )

    expect(mocks.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'llm_anthropic',
        amount: 3,
      })
    )
  })
})
