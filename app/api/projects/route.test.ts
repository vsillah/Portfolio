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
  return new NextRequest(`http://localhost/api/projects${query}`)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/projects', {
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

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults to published projects and does not require auth', async () => {
    const published = [
      { id: 1, title: 'Live', is_published: true, file_path: 'projects/live.pdf' },
    ]
    const publishedEq = vi.fn().mockResolvedValue({ data: published, error: null })
    const createdOrder = vi.fn().mockReturnValue(thenable({ data: published, error: null }, { eq: publishedEq }))
    const displayOrder = vi.fn().mockReturnValue({ order: createdOrder })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ order: displayOrder }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(publishedEq).toHaveBeenCalledWith('is_published', true)
    await expect(response.json()).resolves.toEqual(published)
  })

  it('returns unpublished rows when published=false is sent', async () => {
    const allRows = [
      { id: 2, title: 'Draft', is_published: false, file_path: 'projects/draft.pdf' },
    ]
    const publishedEq = vi.fn()
    const createdOrder = vi.fn().mockReturnValue(thenable({ data: allRows, error: null }, { eq: publishedEq }))
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ order: createdOrder }),
      }),
    })

    const response = await GET(getRequest('?published=false'))

    expect(response.status).toBe(200)
    expect(publishedEq).not.toHaveBeenCalled()
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual(allRows)
  })

  it('returns an empty list when the projects table is missing', async () => {
    const publishedEq = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'does not exist' },
    })
    const createdOrder = vi.fn().mockReturnValue({ eq: publishedEq })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ order: createdOrder }),
      }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  it('returns the database error message on unexpected failures', async () => {
    const publishedEq = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'projects query failed' },
    })
    const createdOrder = vi.fn().mockReturnValue({ eq: publishedEq })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ order: createdOrder }),
      }),
    })

    const response = await GET(getRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'projects query failed' })
  })
})

describe('POST /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ title: 'New project' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a title', async () => {
    const response = await POST(postRequest({ description: 'No title' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Title is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
