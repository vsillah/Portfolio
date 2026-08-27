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

function getRequest(url = 'http://localhost/api/admin/continuity-plans') {
  return new NextRequest(url)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/continuity-plans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.eq = vi.fn(self)
  api.order = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('/api/admin/continuity-plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  describe('GET', () => {
    it('rejects unauthenticated requests before querying plans', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(getRequest())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('defaults to active plans only', async () => {
      const query = chain({
        data: [{ id: 'plan-1', is_active: true }],
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const response = await GET(getRequest())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual([{ id: 'plan-1', is_active: true }])
      expect(query.eq).toHaveBeenCalledWith('is_active', true)
    })

    it('omits the active filter when active=false', async () => {
      const query = chain({ data: [{ id: 'plan-2', is_active: false }], error: null })
      mocks.from.mockReturnValue(query)

      const response = await GET(getRequest('http://localhost/api/admin/continuity-plans?active=false'))

      expect(response.status).toBe(200)
      expect(query.eq).not.toHaveBeenCalled()
    })

    it('returns an empty list when the table has not been applied', async () => {
      mocks.from.mockReturnValue(chain({ data: null, error: { code: '42P01', message: 'missing' } }))

      const response = await GET(getRequest())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual([])
    })
  })

  describe('POST', () => {
    it('rejects unauthenticated creates', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await POST(postRequest({
        name: 'Monthly',
        billing_interval: 'month',
        amount_per_interval: 99,
      }))

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('requires a name, valid interval, and positive amount', async () => {
      const noName = await POST(postRequest({
        name: '  ',
        billing_interval: 'month',
        amount_per_interval: 99,
      }))
      expect(noName.status).toBe(400)
      await expect(noName.json()).resolves.toEqual({ error: 'Name is required' })

      const badInterval = await POST(postRequest({
        name: 'Weekly',
        billing_interval: 'day',
        amount_per_interval: 99,
      }))
      expect(badInterval.status).toBe(400)
      await expect(badInterval.json()).resolves.toEqual({
        error: 'Invalid billing_interval. Must be one of: week, month, quarter, year',
      })

      const badAmount = await POST(postRequest({
        name: 'Monthly',
        billing_interval: 'month',
        amount_per_interval: 0,
      }))
      expect(badAmount.status).toBe(400)
      await expect(badAmount.json()).resolves.toEqual({
        error: 'amount_per_interval must be positive',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('creates a plan with the admin as created_by', async () => {
      const created = { id: 'plan-1', name: 'Monthly Continuity' }
      const query = chain({ data: created, error: null })
      mocks.from.mockReturnValue(query)

      const response = await POST(postRequest({
        name: '  Monthly Continuity  ',
        billing_interval: 'month',
        amount_per_interval: 149,
      }))

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual(created)
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Monthly Continuity',
          billing_interval: 'month',
          amount_per_interval: 149,
          billing_interval_count: 1,
          currency: 'usd',
          created_by: 'admin-1',
        }),
      )
    })
  })
})
