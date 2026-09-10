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
  return new NextRequest(`http://localhost/api/videos${query}`)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/videos', {
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

function mockVideoQuery(result: { data: unknown; error: unknown }, applyPublishedEq: boolean) {
  const publishedEq = vi.fn().mockResolvedValue(result)
  const createdOrder = applyPublishedEq
    ? vi.fn().mockReturnValue({ eq: publishedEq })
    : vi.fn().mockReturnValue(thenable(result, { eq: publishedEq }))

  mocks.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ order: createdOrder }),
    }),
  })

  return { publishedEq }
}

describe('GET /api/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults to published videos and does not require auth', async () => {
    const published = [{ id: 1, title: 'Live', is_published: true, file_path: 'videos/live.mp4' }]
    const query = mockVideoQuery({ data: published, error: null }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(query.publishedEq).toHaveBeenCalledWith('is_published', true)
    await expect(response.json()).resolves.toEqual(published)
  })

  it('returns unpublished rows including file_path when published=false', async () => {
    const allRows = [{ id: 2, title: 'Draft', is_published: false, file_path: 'videos/draft.mp4' }]
    const query = mockVideoQuery({ data: allRows, error: null }, false)

    const response = await GET(getRequest('?published=false'))

    expect(response.status).toBe(200)
    expect(query.publishedEq).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual(allRows)
  })

  it('returns an empty list when the videos table is missing', async () => {
    mockVideoQuery({ data: null, error: { code: '42P01', message: 'does not exist' } }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  it('returns the database error message on unexpected failures', async () => {
    mockVideoQuery({ data: null, error: { code: 'XX000', message: 'videos query failed' } }, true)

    const response = await GET(getRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'videos query failed' })
  })
})

describe('POST /api/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ title: 'Talk' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a title', async () => {
    const response = await POST(postRequest({ description: 'No title' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Title is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults unpublished omission to published and display_order 0', async () => {
    const inserted = { id: 4, title: 'Talk' }
    const single = vi.fn().mockResolvedValue({ data: inserted, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(postRequest({ title: 'Talk', is_published: false }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: inserted })
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Talk',
        display_order: 0,
        is_published: false,
        created_by: 'admin-1',
      }),
    ])
  })
})
