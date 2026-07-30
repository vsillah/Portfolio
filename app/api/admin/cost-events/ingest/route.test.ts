import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(body: unknown, authHeader?: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (authHeader === undefined) {
    headers.set('Authorization', 'Bearer ingest-secret')
  } else if (authHeader !== null) {
    headers.set('Authorization', authHeader)
  }

  return new NextRequest('http://localhost/api/admin/cost-events/ingest', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function mockInsert(result: { error: { code?: string; message?: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result)
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'cost_events') throw new Error(`Unexpected table: ${table}`)
    return { insert }
  })
  return insert
}

describe('POST /api/admin/cost-events/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = 'ingest-secret'
  })

  afterEach(() => {
    restoreEnv()
  })

  it('rejects requests when the ingest secret is missing', async () => {
    delete process.env.N8N_INGEST_SECRET

    const response = await POST(makeRequest({ occurred_at: '2026-07-28T00:00:00Z', source: 'other', amount: 1 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects requests with an invalid bearer token', async () => {
    const response = await POST(
      makeRequest(
        { occurred_at: '2026-07-28T00:00:00Z', source: 'other', amount: 1 },
        'Bearer wrong-secret',
      ),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns zero counts for an empty events array', async () => {
    const response = await POST(makeRequest({ events: [] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      total: 0,
      inserted: 0,
      errors: [],
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('collects validation errors without inserting invalid rows', async () => {
    const insert = mockInsert({ error: null })

    const response = await POST(
      makeRequest({
        events: [
          { source: 'other', amount: 1 },
          {
            occurred_at: '2026-07-28T00:00:00Z',
            source: 'not_a_source',
            amount: 2,
          },
          {
            occurred_at: '2026-07-28T00:00:00Z',
            source: 'other',
            amount: -5,
          },
        ],
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      total: 3,
      inserted: 0,
      errors: [
        'Missing required fields: occurred_at, source, amount',
        'Invalid source: not_a_source',
        'Invalid amount: -5',
      ],
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('inserts valid events and treats unique violations as idempotent skips', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(
      makeRequest([
        {
          occurred_at: '2026-07-28T00:00:00Z',
          source: 'llm_openai',
          amount: '1.25',
          currency: 'usd',
          reference_type: 'agent_run',
          reference_id: 'run-1',
        },
        {
          occurred_at: '2026-07-28T00:00:00Z',
          source: 'llm_openai',
          amount: 1.25,
          reference_type: 'agent_run',
          reference_id: 'run-1',
        },
      ]),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      total: 2,
      inserted: 1,
      errors: [
        'Duplicate (idempotent skip): llm_openai run-1 2026-07-28T00:00:00Z',
      ],
    })
    expect(insert).toHaveBeenCalledTimes(2)
    expect(insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        occurred_at: '2026-07-28T00:00:00Z',
        source: 'llm_openai',
        amount: 1.25,
        currency: 'usd',
        reference_type: 'agent_run',
        reference_id: 'run-1',
      }),
    )
  })

  it('returns 400 for invalid JSON bodies', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/admin/cost-events/ingest', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ingest-secret',
          'Content-Type': 'application/json',
        },
        body: '{not-json',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
  })
})
