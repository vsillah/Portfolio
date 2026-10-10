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

import { POST } from './route'

type QueryResult = { data: unknown; error: unknown }

function terminal(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => query
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update']) {
    query[method] = vi.fn(chain)
  }
  query.single = vi.fn(() => Promise.resolve(result))
  query.maybeSingle = vi.fn(() => Promise.resolve(result))
  return query
}

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/categories/from-open-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/chat-eval/categories/from-open-code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before reading the body', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request('{'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing, non-string, or blank open code', async () => {
    for (const body of [{}, { code: 12 }, { code: '   ' }]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'Open code (code) is required' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('trims the code, copies the open-code description, and places a zero sort order next', async () => {
    const openCodes = terminal({ data: { description: '  Mentions tools  ' }, error: null })
    const maxOrder = terminal({ data: { sort_order: 0 }, error: null })
    const inserted = terminal({ data: { id: 'cat-1', name: 'Referencing AI tools' }, error: null })
    const categoryQueries = [maxOrder, inserted]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'open_codes') return openCodes
      if (table === 'evaluation_categories') return categoryQueries.shift()
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await POST(request({ code: '  Referencing AI tools  ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      category: { id: 'cat-1', name: 'Referencing AI tools' },
      message: '"Referencing AI tools" is now an issue category and will appear in the Issue Category dropdown.',
    })
    expect(openCodes.eq).toHaveBeenCalledWith('code', 'Referencing AI tools')
    expect(inserted.insert).toHaveBeenCalledWith({
      name: 'Referencing AI tools',
      description: '  Mentions tools  ',
      color: '#8B5CF6',
      sort_order: 1,
      is_active: true,
      source: 'open_code',
    })
  })

  it('starts at sort order 1 when no category exists and stores a null description', async () => {
    const openCodes = terminal({ data: null, error: null })
    const maxOrder = terminal({ data: null, error: null })
    const inserted = terminal({ data: { id: 'cat-2' }, error: null })
    const categoryQueries = [maxOrder, inserted]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'open_codes') return openCodes
      return categoryQueries.shift()
    })

    const response = await POST(request({ code: 'New code' }))

    expect(response.status).toBe(200)
    expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({
      description: null,
      sort_order: 1,
    }))
  })

  it('returns 409 when the category name already exists', async () => {
    const inserted = terminal({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const categoryQueries = [terminal({ data: { sort_order: 4 }, error: null }), inserted]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'open_codes') return terminal({ data: null, error: null })
      return categoryQueries.shift()
    })

    const response = await POST(request({ code: 'Existing' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'A category with this name already exists' })
    expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 5 }))
  })

  it('explains the source check constraint without returning the database message', async () => {
    const categoryQueries = [
      terminal({ data: { sort_order: 2 }, error: null }),
      terminal({ data: null, error: { code: '23514', message: 'check violation source' } }),
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'open_codes') return terminal({ data: null, error: null })
      return categoryQueries.shift()
    })

    const response = await POST(request({ code: 'Blocked source' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Database does not allow source 'open_code' yet. Run migration 2026_02_27_evaluation_categories_source_open_code.sql",
    })
  })

  it('hides other insert failures and invalid JSON', async () => {
    const categoryQueries = [
      terminal({ data: null, error: null }),
      terminal({ data: null, error: { code: 'XX000', message: 'relation missing' } }),
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'open_codes') return terminal({ data: null, error: null })
      return categoryQueries.shift()
    })

    const insertResponse = await POST(request({ code: 'Broken' }))
    expect(insertResponse.status).toBe(500)
    await expect(insertResponse.json()).resolves.toEqual({ error: 'Failed to create category' })

    const jsonResponse = await POST(request('{'))
    expect(jsonResponse.status).toBe(500)
    await expect(jsonResponse.json()).resolves.toEqual({ error: 'Internal server error' })
  })
})
