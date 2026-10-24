import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/market-intel${query}`)
}

function listBuilder(result: { data: unknown; error: unknown; count: number | null }) {
  const builder: {
    eq: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    eq: vi.fn(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
  }
  builder.eq.mockReturnValue(builder)
  const range = vi.fn(() => builder)
  const order = vi.fn(() => ({ range }))
  const select = vi.fn(() => ({ order }))
  return { select, order, range, eq: builder.eq }
}

function platformBuilder(rows: Array<{ source_platform: string }>) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  const select = vi.fn(() => ({ order }))
  return { select, order }
}

describe('GET /api/admin/value-evidence/market-intel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before reading market intelligence', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('caps limit at 500, defaults offset, and skips empty filters', async () => {
    const list = listBuilder({ data: [{ id: 'row-1' }], error: null, count: 1 })
    const platforms = platformBuilder([{ source_platform: 'yelp' }, { source_platform: 'google' }, { source_platform: 'yelp' }])
    mocks.from.mockReturnValueOnce(list).mockReturnValueOnce(platforms)

    const response = await GET(request('?limit=1000&platform=&is_processed=&industry='))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(list.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(list.order).toHaveBeenCalledWith('scraped_at', { ascending: false })
    expect(list.range).toHaveBeenCalledWith(0, 499)
    expect(list.eq).not.toHaveBeenCalled()
    expect(platforms.order).toHaveBeenCalledWith('source_platform')
    expect(body).toEqual({
      items: [{ id: 'row-1' }],
      platforms: ['google', 'yelp'],
      total: 1,
      limit: 500,
      offset: 0,
    })
  })

  it('applies platform, processed, and industry filters and pages with the requested window', async () => {
    const list = listBuilder({ data: [], error: null, count: 0 })
    const platforms = platformBuilder([])
    mocks.from.mockReturnValueOnce(list).mockReturnValueOnce(platforms)

    const response = await GET(request('?platform=reddit&is_processed=false&industry=hvac&limit=25&offset=50'))

    expect(response.status).toBe(200)
    expect(list.eq).toHaveBeenCalledWith('source_platform', 'reddit')
    expect(list.eq).toHaveBeenCalledWith('is_processed', false)
    expect(list.eq).toHaveBeenCalledWith('industry_detected', 'hvac')
    expect(list.range).toHaveBeenCalledWith(50, 74)
    expect(await response.json()).toMatchObject({ items: [], total: 0, limit: 25, offset: 50, platforms: [] })
  })

  it('treats is_processed=true as a boolean match and ignores unrecognized processed values', async () => {
    const processed = listBuilder({ data: null, error: null, count: null })
    const unrecognized = listBuilder({ data: [], error: null, count: 0 })
    const platforms = platformBuilder([])
    mocks.from
      .mockReturnValueOnce(processed)
      .mockReturnValueOnce(platforms)
      .mockReturnValueOnce(unrecognized)
      .mockReturnValueOnce(platformBuilder([]))

    await GET(request('?is_processed=true'))
    expect(processed.eq).toHaveBeenCalledWith('is_processed', true)

    await GET(request('?is_processed=yes'))
    expect(unrecognized.eq).not.toHaveBeenCalled()
  })

  it('returns the database error message when the list query fails', async () => {
    const list = listBuilder({ data: null, error: { message: 'relation missing' }, count: null })
    mocks.from.mockReturnValueOnce(list).mockReturnValueOnce(platformBuilder([]))

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'relation missing' })
  })
})
