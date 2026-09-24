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
  supabaseAdmin: { from: mocks.from },
}))

import { DELETE, GET, POST, PUT } from './route'

function request(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function thenable(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

describe('chat-eval categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  describe('GET', () => {
    it('rejects non-admins', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

      const response = await GET(request('http://localhost/api/admin/chat-eval/categories'))

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('lists active categories and does not restrict source unless for_annotation=true', async () => {
      const categories = thenable({
        data: [
          {
            id: 'cat-1',
            name: 'Tone',
            description: 'Voice',
            color: '#fff',
            sort_order: 2,
            created_at: '2026-01-01',
            chat_evaluations: [{ count: 4 }],
            source: 'manual',
          },
        ],
        error: null,
      })
      const openCodes = thenable({ data: [{ code: 'vague', usage_count: 3 }], error: null })
      mocks.from.mockImplementation((table: string) => {
        if (table === 'evaluation_categories') return categories
        if (table === 'open_codes') return openCodes
        throw new Error(table)
      })

      const response = await GET(request('http://localhost/api/admin/chat-eval/categories?for_annotation=TRUE'))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        categories: [
          {
            id: 'cat-1',
            name: 'Tone',
            description: 'Voice',
            color: '#fff',
            sort_order: 2,
            usage_count: 4,
            created_at: '2026-01-01',
          },
        ],
        open_codes: [{ code: 'vague', usage_count: 3 }],
      })
      expect(categories.eq).toHaveBeenCalledWith('is_active', true)
      expect(categories.in).not.toHaveBeenCalled()
      expect(openCodes.order).toHaveBeenCalledWith('usage_count', { ascending: false })
      expect(openCodes.limit).toHaveBeenCalledWith(50)
    })

    it('limits annotation categories to promoted axial and open codes', async () => {
      const categories = thenable({
        data: [{ id: 'cat-2', name: 'Clarity', chat_evaluations: [] }],
        error: null,
      })
      const openCodes = thenable({ data: null, error: { message: 'ignored' } })
      mocks.from.mockImplementation((table: string) => (table === 'open_codes' ? openCodes : categories))

      const response = await GET(request('http://localhost/api/admin/chat-eval/categories?for_annotation=true'))

      expect(categories.in).toHaveBeenCalledWith('source', ['axial_code', 'open_code'])
      expect(await response.json()).toEqual({
        categories: [
          {
            id: 'cat-2',
            name: 'Clarity',
            usage_count: 0,
          },
        ],
        open_codes: [],
      })
    })

    it('returns a generic error and skips open codes when categories fail', async () => {
      const categories = thenable({ data: null, error: { message: 'db down' } })
      mocks.from.mockReturnValue(categories)

      const response = await GET(request('http://localhost/api/admin/chat-eval/categories'))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to fetch categories' })
      expect(mocks.from).toHaveBeenCalledTimes(1)
    })
  })

  describe('POST', () => {
    function categoryTable(sortOrder: { data: { sort_order?: number } | null }, insertResult: { data: unknown; error: { code?: string; message?: string } | null }) {
      const insert = vi.fn((row: unknown) => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(insertResult),
        })),
        row,
      }))
      mocks.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn().mockResolvedValue(sortOrder),
            })),
          })),
        })),
        insert,
      })
      return insert
    }

    it('rejects a missing or non-string name', async () => {
      const response = await POST(request('http://localhost/api/admin/chat-eval/categories', 'POST', { name: 12 }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Name is required' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('trims the name, defaults color, and places the row after the current max sort order', async () => {
      const insert = categoryTable(
        { data: { sort_order: 4 } },
        { data: { id: 'cat-new' }, error: null }
      )

      const response = await POST(
        request('http://localhost/api/admin/chat-eval/categories', 'POST', {
          name: '  Ops  ',
          description: '  How it failed  ',
        })
      )

      expect(response.status).toBe(200)
      expect(insert).toHaveBeenCalledWith({
        name: 'Ops',
        description: 'How it failed',
        color: '#6B7280',
        sort_order: 5,
      })
      expect(await response.json()).toEqual({ success: true, category: { id: 'cat-new' } })
    })

    it('treats a max sort_order of 0 as missing and starts at 1', async () => {
      const insert = categoryTable({ data: { sort_order: 0 } }, { data: { id: 'cat-1' }, error: null })

      await POST(request('http://localhost/api/admin/chat-eval/categories', 'POST', { name: 'First', color: '#111' }))

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 1, color: '#111', description: null }))
    })

    it('maps a unique-name violation to 409 and other insert errors to a generic 500', async () => {
      categoryTable({ data: null }, { data: null, error: { code: '23505', message: 'duplicate' } })
      const conflict = await POST(request('http://localhost/api/admin/chat-eval/categories', 'POST', { name: 'Tone' }))
      expect(conflict.status).toBe(409)
      expect(await conflict.json()).toEqual({ error: 'A category with this name already exists' })

      categoryTable({ data: null }, { data: null, error: { code: '42501', message: 'permission denied' } })
      const failed = await POST(request('http://localhost/api/admin/chat-eval/categories', 'POST', { name: 'Tone' }))
      expect(failed.status).toBe(500)
      expect(await failed.json()).toEqual({ error: 'Failed to create category' })
    })
  })

  describe('PUT', () => {
    it('requires an id and writes only provided fields', async () => {
      const missing = await PUT(request('http://localhost/api/admin/chat-eval/categories', 'PUT', { name: 'Tone' }))
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ error: 'Category ID is required' })

      const single = vi.fn().mockResolvedValue({ data: { id: 'cat-1', name: 'Tone' }, error: null })
      const eq = vi.fn(() => ({ select: vi.fn(() => ({ single })) }))
      const update = vi.fn(() => ({ eq }))
      mocks.from.mockReturnValue({ update })

      const response = await PUT(
        request('http://localhost/api/admin/chat-eval/categories', 'PUT', {
          id: 'cat-1',
          name: '  Tone  ',
          description: '   ',
          is_active: false,
          sort_order: 0,
        })
      )

      expect(update).toHaveBeenCalledWith({
        name: 'Tone',
        description: null,
        is_active: false,
        sort_order: 0,
      })
      expect(eq).toHaveBeenCalledWith('id', 'cat-1')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, category: { id: 'cat-1', name: 'Tone' } })
    })

    it('returns a generic error when the update fails', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'check violation' } })
      mocks.from.mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) })),
      })

      const response = await PUT(request('http://localhost/api/admin/chat-eval/categories', 'PUT', { id: 'cat-1' }))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to update category' })
    })
  })

  describe('DELETE', () => {
    it('requires an id and soft-deletes by clearing is_active', async () => {
      mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 })
      const denied = await DELETE(request('http://localhost/api/admin/chat-eval/categories?id=cat-1', 'DELETE'))
      expect(denied.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()

      const missing = await DELETE(request('http://localhost/api/admin/chat-eval/categories', 'DELETE'))
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ error: 'Category ID is required' })

      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq }))
      mocks.from.mockReturnValue({ update })

      const response = await DELETE(request('http://localhost/api/admin/chat-eval/categories?id=cat-1', 'DELETE'))

      expect(update).toHaveBeenCalledWith({ is_active: false })
      expect(eq).toHaveBeenCalledWith('id', 'cat-1')
      expect(await response.json()).toEqual({ success: true })
    })

    it('returns a generic error when the soft delete fails', async () => {
      mocks.from.mockReturnValue({
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { message: 'locked' } }) })),
      })

      const response = await DELETE(request('http://localhost/api/admin/chat-eval/categories?id=cat-1', 'DELETE'))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to delete category' })
    })
  })
})
