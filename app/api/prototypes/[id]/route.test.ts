import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

import { DELETE, GET, PUT } from './route'

function params(id = 'proto-1') {
  return { params: { id } }
}

function request(method: string, body?: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {}
  if (body) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest('http://localhost/api/prototypes/proto-1', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function profileQuery(role: string | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: role ? { role } : null,
          error: role ? null : { message: 'missing' },
        }),
      })),
    })),
  }
}

describe('GET /api/prototypes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('is unauthenticated and returns unpublished rows with sorted demos and history', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'proto-1',
              title: 'Draft proto',
              demos: [
                { id: 'd2', display_order: 2 },
                { id: 'd1', display_order: 1 },
              ],
              stage_history: [
                { id: 'h-old', changed_at: '2026-01-01T00:00:00.000Z' },
                { id: 'h-new', changed_at: '2026-09-01T00:00:00.000Z' },
              ],
            },
            error: null,
          }),
        })),
      })),
    })

    const response = await GET(request('GET'), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.demos.map((d: { id: string }) => d.id)).toEqual(['d1', 'd2'])
    expect(body.stage_history.map((h: { id: string }) => h.id)).toEqual(['h-new', 'h-old'])
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('returns 500 with the database error message when the lookup fails', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'PGRST116' },
          }),
        })),
      })),
    })

    const response = await GET(request('GET'), params('missing'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'PGRST116' })
  })
})

describe('PUT /api/prototypes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
  })

  it('requires a bearer token', async () => {
    const response = await PUT(request('PUT', { title: 'Updated' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('forbids non-admin users before writing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PUT(request('PUT', { title: 'Updated' }, 'member-token'), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
  })

  it('spreads the request body onto the update for admins', async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'proto-1', title: 'Updated' },
            error: null,
          }),
        })),
      })),
    }))
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'app_prototypes') return { update }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PUT(
      request('PUT', { title: 'Updated', extra: 'passthrough' }, 'admin-token'),
      params(),
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Updated',
      extra: 'passthrough',
      updated_at: expect.any(String),
    }))
  })
})

describe('DELETE /api/prototypes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
  })

  it('requires a bearer token', async () => {
    const response = await DELETE(request('DELETE'), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes after admin verification', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'app_prototypes') {
        return { delete: vi.fn(() => ({ eq })) }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(request('DELETE', undefined, 'admin-token'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(eq).toHaveBeenCalledWith('id', 'proto-1')
  })
})
