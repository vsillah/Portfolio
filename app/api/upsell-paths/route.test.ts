import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/upsell-paths${query}`)
}

function thenableQuery(result: { data: unknown; error: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

describe('GET /api/upsell-paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires content_type and content_id', async () => {
    const missingBoth = await GET(makeRequest())
    expect(missingBoth.status).toBe(400)
    await expect(missingBoth.json()).resolves.toEqual({
      error: 'content_type and content_id are required',
    })

    const missingId = await GET(makeRequest('?content_type=service'))
    expect(missingId.status).toBe(400)
    await expect(missingId.json()).resolves.toEqual({
      error: 'content_type and content_id are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns only active paths for the source offer', async () => {
    const query = thenableQuery({
      data: [{ id: 'path-1', is_active: true }],
      error: null,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('?content_type=service&content_id=svc-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ paths: [{ id: 'path-1', is_active: true }] })
    expect(query.eq).toHaveBeenCalledWith('source_content_type', 'service')
    expect(query.eq).toHaveBeenCalledWith('source_content_id', 'svc-1')
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
    expect(query.eq).not.toHaveBeenCalledWith('source_tier_slug', expect.anything())
    expect(query.order).toHaveBeenCalledWith('display_order', { ascending: true })
  })

  it('optionally filters by source tier slug', async () => {
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(
      makeRequest('?content_type=product&content_id=prod-1&tier_slug=growth'),
    )

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('source_tier_slug', 'growth')
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('returns 500 when the query fails', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'db down' } }))

    const response = await GET(makeRequest('?content_type=service&content_id=svc-1'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch upsell paths' })
  })

  it('returns an empty paths array when the query yields null data', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: null }))

    const response = await GET(makeRequest('?content_type=service&content_id=svc-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ paths: [] })
  })
})
