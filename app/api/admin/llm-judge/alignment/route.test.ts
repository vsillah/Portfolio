import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  calculateAlignment: vi.fn(),
  from: vi.fn(),
  results: [] as Array<{ data: unknown; error?: unknown }>,
  updates: [] as unknown[],
  chains: [] as Array<{ table: string; calls: Array<{ method: string; args: unknown[] }> }>,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/llm-judge', () => ({
  calculateAlignment: mocks.calculateAlignment,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, POST } from './route'

const alignment = {
  totalCompared: 2,
  alignedCount: 1,
  alignmentRate: 50,
  breakdown: {
    humanGoodLlmGood: 1,
    humanGoodLlmBad: 0,
    humanBadLlmGood: 1,
    humanBadLlmBad: 0,
  },
}

function resetDb() {
  mocks.results = []
  mocks.updates = []
  mocks.chains = []
  mocks.from.mockImplementation((table: string) => {
    const result = mocks.results.shift() ?? { data: [], error: null }
    const trace = { table, calls: [] as Array<{ method: string; args: unknown[] }> }
    mocks.chains.push(trace)
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'not', 'gte', 'eq', 'update']) {
      chain[method] = vi.fn((...args: unknown[]) => {
        trace.calls.push({ method, args })
        if (method === 'update') mocks.updates.push(args[0])
        return chain
      })
    }
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    return chain
  })
}

describe('GET /api/admin/llm-judge/alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T10:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.calculateAlignment.mockReturnValue(alignment)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-admins before reading evaluations', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(new NextRequest('http://localhost/api/admin/llm-judge/alignment'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('links unmatched rows, keeps a stored disagreement, and filters by model', async () => {
    mocks.results.push(
      {
        data: [
          { id: 'human-1', session_id: 's1', rating: 'good', evaluated_at: '2026-09-20T00:00:00.000Z' },
          { id: 'human-2', session_id: 's2', rating: 'good', evaluated_at: '2026-09-21T00:00:00.000Z' },
        ],
      },
      {
        data: [
          {
            id: 'llm-1',
            session_id: 's1',
            rating: 'good',
            confidence_score: 0.8,
            model_used: 'claude',
            human_evaluation_id: null,
            human_alignment: null,
            evaluated_at: '2026-09-20T00:00:00.000Z',
          },
          {
            id: 'llm-2',
            session_id: 's2',
            rating: 'good',
            confidence_score: 0.2,
            model_used: 'claude',
            human_evaluation_id: 'human-2',
            human_alignment: false,
            evaluated_at: '2026-09-21T00:00:00.000Z',
          },
          {
            id: 'llm-3',
            session_id: 'unmatched',
            rating: 'bad',
            confidence_score: 0.1,
            model_used: 'claude',
            human_evaluation_id: null,
            human_alignment: null,
            evaluated_at: '2026-09-22T00:00:00.000Z',
          },
        ],
      },
      { data: null, error: null },
    )

    const response = await GET(new NextRequest('http://localhost/api/admin/llm-judge/alignment?days=7&model=claude'))
    const body = await response.json()
    const expectedFrom = new Date('2026-09-29T10:00:00.000Z')
    expectedFrom.setDate(expectedFrom.getDate() - 7)

    expect(response.status).toBe(200)
    expect(mocks.chains[0].calls.find((call) => call.method === 'gte')?.args).toEqual([
      'evaluated_at',
      expectedFrom.toISOString(),
    ])
    expect(mocks.chains[1].calls.find((call) => call.method === 'eq')?.args).toEqual(['model_used', 'claude'])
    expect(mocks.updates).toEqual([
      { human_evaluation_id: 'human-1', human_alignment: true },
    ])
    expect(mocks.calculateAlignment).toHaveBeenCalledWith([
      { humanRating: 'good', llmRating: 'good' },
      { humanRating: 'good', llmRating: 'good' },
    ])
    expect(body.by_model.claude).toEqual({ total: 2, aligned: 1, rate: 50 })
    expect(body.disagreements).toEqual([
      expect.objectContaining({
        session_id: 's2',
        llm_rating: 'good',
        human_rating: 'good',
        confidence: 0.2,
      }),
    ])
    expect(body.confidence_analysis).toEqual({
      avg_aligned_confidence: 0.8,
      avg_misaligned_confidence: 0.2,
    })
    expect(body.period_days).toBe(7)
    expect(body.overall).toEqual(alignment)
  })

  it('returns a fetch error and a generic error for an invalid day window', async () => {
    mocks.results.push({ data: null, error: { message: 'human down' } }, { data: [], error: null })
    const failed = await GET(new NextRequest('http://localhost/api/admin/llm-judge/alignment'))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to fetch alignment data' })
    expect(mocks.calculateAlignment).not.toHaveBeenCalled()

    const invalid = await GET(new NextRequest('http://localhost/api/admin/llm-judge/alignment?days=abc'))
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Internal server error' })
  })
})

describe('POST /api/admin/llm-judge/alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDb()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires an evaluation id and stores only boolean alignment', async () => {
    const missing = await POST(new NextRequest('http://localhost/api/admin/llm-judge/alignment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aligned: true }),
    }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'llm_evaluation_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.results.push({ data: null, error: null })
    const response = await POST(new NextRequest('http://localhost/api/admin/llm-judge/alignment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        llm_evaluation_id: 'llm-1',
        human_evaluation_id: '',
        aligned: 'yes',
      }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mocks.updates).toEqual([
      { human_evaluation_id: null, human_alignment: null },
    ])
    expect(mocks.chains[0].calls.find((call) => call.method === 'eq')?.args).toEqual(['id', 'llm-1'])
  })

  it('returns a generic update error and hides invalid JSON', async () => {
    mocks.results.push({ data: null, error: { message: 'write failed' } })
    const failed = await POST(new NextRequest('http://localhost/api/admin/llm-judge/alignment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ llm_evaluation_id: 'llm-1', aligned: false }),
    }))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to update alignment' })

    const invalid = await POST(new NextRequest('http://localhost/api/admin/llm-judge/alignment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }))
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Internal server error' })
  })
})
