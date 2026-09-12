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
  return new NextRequest(`http://localhost/api/admin/users${query}`)
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)

    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('applies search, pagination, and completed-order spend stats', async () => {
    const users = [
      { id: 'user-1', email: 'ada@example.com', role: 'client', created_at: '2026-01-01', updated_at: '2026-01-02' },
    ]
    const pageResult = { data: users, error: null, count: 21 }
    const ilike = vi.fn().mockResolvedValue(pageResult)
    const range = vi.fn().mockReturnValue({
      ilike,
      then: (resolve: (value: typeof pageResult) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(pageResult).then(resolve, reject),
    })
    const order = vi.fn().mockReturnValue({ range })
    const select = vi.fn().mockReturnValue({ order })

    const orderEqStatus = vi.fn().mockResolvedValue({
      data: [
        { id: 'o1', final_amount: '40.50', status: 'completed' },
        { id: 'o2', final_amount: '9.50', status: 'completed' },
      ],
      error: null,
    })
    const orderEqUser = vi.fn().mockReturnValue({ eq: orderEqStatus })
    const orderSelect = vi.fn().mockReturnValue({ eq: orderEqUser })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return { select, order, ilike, range }
      if (table === 'orders') return { select: orderSelect }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request('?search=ada&page=2&limit=10'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      users: [
        {
          ...users[0],
          order_count: 2,
          total_spent: 50,
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      },
    })
    expect(ilike).toHaveBeenCalledWith('email', '%ada%')
    expect(range).toHaveBeenCalledWith(10, 19)
    expect(orderEqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(orderEqStatus).toHaveBeenCalledWith('status', 'completed')
  })
})
