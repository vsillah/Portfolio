import { beforeEach, describe, expect, it, vi } from 'vitest'

const jsonMock = vi.fn((body: unknown, init?: { status?: number }) => ({
  body,
  status: init?.status ?? 200,
}))

const fromMock = vi.fn()
const classifyMarketIntelMock = vi.fn()

vi.mock('next/server', () => ({
  NextResponse: {
    json: jsonMock,
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}))

vi.mock('@/lib/market-intel-classifier', () => ({
  classifyMarketIntel: classifyMarketIntelMock,
}))

function makeRequest(body: unknown, token = 'secret-token') {
  return {
    headers: {
      get: vi.fn().mockReturnValue(token ? `Bearer ${token}` : null),
    },
    json: vi.fn().mockResolvedValue(body),
  } as never
}

describe('POST /api/admin/value-evidence/ingest-market', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv, N8N_INGEST_SECRET: 'secret-token' }
    classifyMarketIntelMock.mockResolvedValue({ evidenceCreated: 0, irrelevant: 1, errors: [] })
  })

  it('falls back to lookup plus insert when source_url upsert has no unique constraint', async () => {
    const insertedRows: Record<string, unknown>[] = []
    const upsertSelect = vi.fn().mockResolvedValue({
      data: null,
      count: null,
      error: {
        message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
      },
    })
    const upsert = vi.fn(() => ({ select: upsertSelect }))

    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const lookupEq = vi.fn(() => ({ maybeSingle }))
    const tableSelect = vi.fn(() => ({ eq: lookupEq }))

    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'market-1' }, error: null })
    const insertSelect = vi.fn(() => ({ single: insertSingle }))
    const insert = vi.fn((row: Record<string, unknown>) => {
      insertedRows.push(row)
      return { select: insertSelect }
    })

    fromMock.mockReturnValue({
      upsert,
      select: tableSelect,
      insert,
    })

    const { POST } = await import('./route')
    const response = await POST(makeRequest({
      is_test_data: true,
      items: [
        {
          source_platform: 'google_maps',
          source_url: 'https://maps.example/review-1',
          source_author: 'Reviewer',
          content_text: 'Manual paperwork took weeks to process.',
          content_type: 'review',
        },
      ],
    }))

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_platform: 'google_maps',
        source_url: 'https://maps.example/review-1',
        is_test_data: true,
      }),
      { onConflict: 'source_url', ignoreDuplicates: true, count: 'exact' },
    )
    expect(lookupEq).toHaveBeenCalledWith('source_url', 'https://maps.example/review-1')
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0]).toMatchObject({
      source_platform: 'google_maps',
      source_url: 'https://maps.example/review-1',
      is_test_data: true,
    })
    expect(classifyMarketIntelMock).toHaveBeenCalledWith(1, ['market-1'])
    expect(jsonMock).toHaveBeenCalledWith({
      total: 1,
      inserted: 1,
      duplicates: 0,
      errors: [],
      classification: { evidenceCreated: 0, irrelevant: 1 },
    })
    expect(response.status).toBe(200)
  })

  it('counts fallback lookup hits as duplicates without inserting', async () => {
    const upsert = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: null,
        count: null,
        error: {
          message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        },
      }),
    }))
    const insert = vi.fn()

    fromMock.mockReturnValue({
      upsert,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-market' }, error: null }),
        })),
      })),
      insert,
    })

    const { POST } = await import('./route')
    await POST(makeRequest({
      items: [
        {
          source_platform: 'google_maps',
          source_url: 'https://maps.example/review-1',
          content_text: 'Manual paperwork took weeks to process.',
          content_type: 'review',
        },
      ],
    }))

    expect(insert).not.toHaveBeenCalled()
    expect(classifyMarketIntelMock).not.toHaveBeenCalled()
    expect(jsonMock).toHaveBeenCalledWith({
      total: 1,
      inserted: 0,
      duplicates: 1,
      errors: [],
      classification: null,
    })
  })

  it('counts fallback duplicate insert races as duplicates without failing the request', async () => {
    const upsert = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({
        data: null,
        count: null,
        error: {
          message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        },
      }),
    }))
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "idx_market_intelligence_source_url_unique"',
          },
        }),
      })),
    }))

    fromMock.mockReturnValue({
      upsert,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert,
    })

    const { POST } = await import('./route')
    const response = await POST(makeRequest({
      items: [
        {
          source_platform: 'google_maps',
          source_url: 'https://maps.example/review-race',
          content_text: 'Manual paperwork took weeks to process.',
          content_type: 'review',
        },
      ],
    }))

    expect(classifyMarketIntelMock).not.toHaveBeenCalled()
    expect(jsonMock).toHaveBeenCalledWith({
      total: 1,
      inserted: 0,
      duplicates: 1,
      errors: [],
      classification: null,
    })
    expect(response.status).toBe(200)
  })
})
