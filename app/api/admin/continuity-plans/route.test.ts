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

function makePost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/continuity-plans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGet(query = '') {
  return new NextRequest(`http://localhost/api/admin/continuity-plans${query}`, {
    method: 'GET',
  })
}

describe('/api/admin/continuity-plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated GET before listing plans', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a plan name on create', async () => {
    const response = await POST(
      makePost({ name: '  ', billing_interval: 'month', amount_per_interval: 99 }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid billing intervals', async () => {
    const response = await POST(
      makePost({
        name: 'Support Retainer',
        billing_interval: 'biweekly',
        amount_per_interval: 99,
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid billing_interval. Must be one of: week, month, quarter, year',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects non-positive amounts', async () => {
    const response = await POST(
      makePost({
        name: 'Support Retainer',
        billing_interval: 'month',
        amount_per_interval: 0,
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'amount_per_interval must be positive',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a continuity plan with trimmed fields and admin creator', async () => {
    const inserts: Record<string, unknown>[] = []
    const created = {
      id: 'plan-1',
      name: 'Support Retainer',
      billing_interval: 'month',
      amount_per_interval: 99,
    }

    mocks.from.mockImplementation((table: string) => {
      if (table === 'continuity_plans') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            inserts.push(payload)
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: created, error: null }),
              }),
            }
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makePost({
        name: '  Support Retainer  ',
        description: '  Monthly help  ',
        billing_interval: 'month',
        amount_per_interval: 99,
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual(created)
    expect(inserts[0]).toMatchObject({
      name: 'Support Retainer',
      description: 'Monthly help',
      billing_interval: 'month',
      amount_per_interval: 99,
      created_by: 'admin-1',
    })
  })
})
