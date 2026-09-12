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

import { GET, PUT } from './route'

function makeGetRequest(id = 'user-2') {
  return new NextRequest(`http://localhost/api/admin/users/${id}`)
}

function makePutRequest(body: Record<string, unknown>, id = 'user-2') {
  return new NextRequest(`http://localhost/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = 'user-2') {
  return { params: { id } }
}

describe('GET /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated reads before loading profiles', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the profile is missing', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'User not found' })
  })

  it('counts only completed orders toward total spent', async () => {
    const profileSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-2', email: 'ada@example.com', role: 'user' },
      error: null,
    })
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

    const ordersOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 1, final_amount: '40.00', status: 'completed', created_at: '2026-01-02' },
        { id: 2, final_amount: '99.00', status: 'pending', created_at: '2026-01-03' },
        { id: 3, final_amount: '10.50', status: 'completed', created_at: '2026-01-01' },
      ],
      error: null,
    })
    const ordersEq = vi.fn().mockReturnValue({ order: ordersOrder })
    const ordersSelect = vi.fn().mockReturnValue({ eq: ordersEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return { select: profileSelect }
      if (table === 'orders') return { select: ordersSelect }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.user.order_count).toBe(2)
    expect(body.user.total_spent).toBe(50.5)
    expect(body.user.orders).toHaveLength(3)
  })
})

describe('PUT /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated role changes', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(makePutRequest({ role: 'admin' }), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects roles outside user/admin', async () => {
    const response = await PUT(makePutRequest({ role: 'superadmin' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid role. Must be "user" or "admin"',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('prevents an admin from removing their own admin privileges', async () => {
    const response = await PUT(
      makePutRequest({ role: 'user' }, 'admin-1'),
      params('admin-1'),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'You cannot remove your own admin privileges',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty update payload', async () => {
    const response = await PUT(makePutRequest({}), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No valid fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates another user\'s role', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'user-2', role: 'admin' },
      error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(makePutRequest({ role: 'admin' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      user: { id: 'user-2', role: 'admin' },
    })
    expect(update).toHaveBeenCalledWith({ role: 'admin' })
    expect(eq).toHaveBeenCalledWith('id', 'user-2')
  })
})
