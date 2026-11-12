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

import { GET, POST } from './route'

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/music${query}`)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenable<T extends Record<string, unknown>>(value: T, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
}

function mockMusicQuery(result: { data: unknown; error: unknown }, applyPublishedEq: boolean) {
  const publishedEq = vi.fn().mockResolvedValue(result)
  const createdOrder = applyPublishedEq
    ? vi.fn().mockReturnValue({ eq: publishedEq })
    : vi.fn().mockReturnValue(thenable(result, { eq: publishedEq }))
  const displayOrder = vi.fn().mockReturnValue({ order: createdOrder })
  const productEq = vi.fn().mockResolvedValue({ data: [], error: null })
  const productIn = vi.fn().mockReturnValue({ eq: productEq })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'music') {
      return { select: vi.fn().mockReturnValue({ order: displayOrder }) }
    }
    if (table === 'products') {
      return { select: vi.fn().mockReturnValue({ in: productIn }) }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { publishedEq, productIn, productEq }
}

describe('GET /api/music', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults to published tracks and does not require auth', async () => {
    const published = [{ id: 1, title: 'Live', is_published: true, file_path: 'music/live.mp3' }]
    const query = mockMusicQuery({ data: published, error: null }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(query.publishedEq).toHaveBeenCalledWith('is_published', true)
    expect(query.productIn).toHaveBeenCalledWith('music_id', [1])
    expect(query.productEq).toHaveBeenCalledWith('is_active', true)
    await expect(response.json()).resolves.toEqual([
      { ...published[0], linked_product: null },
    ])
  })

  it('returns unpublished rows including file_path when published=false', async () => {
    const allRows = [{ id: 2, title: 'Draft', is_published: false, file_path: 'music/draft.mp3' }]
    const query = mockMusicQuery({ data: allRows, error: null }, false)

    const response = await GET(getRequest('?published=false'))

    expect(response.status).toBe(200)
    expect(query.publishedEq).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual([
      { ...allRows[0], linked_product: null },
    ])
  })

  it('attaches the last active product when multiple products share a music_id', async () => {
    const tracks = [{ id: 3, title: 'Linked', is_published: true, file_path: 'music/linked.mp3' }]
    const query = mockMusicQuery({ data: tracks, error: null }, true)
    query.productEq.mockResolvedValue({
      data: [
        { id: 10, price: 9, music_id: 3 },
        { id: 11, price: 19, music_id: 3 },
      ],
      error: null,
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { ...tracks[0], linked_product: { id: 11, price: 19 } },
    ])
  })

  it('skips product lookup when the music list is empty', async () => {
    const query = mockMusicQuery({ data: [], error: null }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
    expect(query.productIn).not.toHaveBeenCalled()
  })

  it('returns an empty list when the music table is missing', async () => {
    mockMusicQuery({ data: null, error: { code: '42P01', message: 'does not exist' } }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('returns the database error message on unexpected failures', async () => {
    mockMusicQuery({ data: null, error: { code: 'XX000', message: 'music query failed' } }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'music query failed' })
  })
})

describe('POST /api/music', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ title: 'Song', artist: 'Band' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    { title: '', artist: 'Band' },
    { title: 'Song', artist: '' },
    { title: 'Song' },
    { artist: 'Band' },
  ])('requires title and artist: %j', async (body) => {
    const response = await POST(postRequest(body))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Title and artist are required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults unpublished omission to published and display_order 0', async () => {
    const inserted = { id: 8, title: 'Song', artist: 'Band' }
    const single = vi.fn().mockResolvedValue({ data: inserted, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(postRequest({ title: 'Song', artist: 'Band' }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: inserted })
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Song',
        artist: 'Band',
        display_order: 0,
        is_published: true,
        created_by: 'admin-1',
      }),
    ])
  })
})
