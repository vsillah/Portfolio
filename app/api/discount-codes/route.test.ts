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

import { GET, POST } from './route'

function makeGetRequest() {
  return new NextRequest('http://localhost/api/discount-codes')
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/discount-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/discount-codes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated list requests before reading codes', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated creates before writing codes', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      makePostRequest({ code: 'save10', discount_type: 'percent', discount_value: 10 }),
    )

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires code, discount type, and discount value', async () => {
    const response = await POST(makePostRequest({ code: 'SAVE10' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Code, discount type, and discount value are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('uppercases the code and records the creating admin', async () => {
    const created = { id: 'dc-1', code: 'SAVE10' }
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(
      makePostRequest({
        code: 'save10',
        discount_type: 'percent',
        discount_value: '10',
        applicable_product_ids: [],
        applicable_user_ids: ['user-9'],
        max_uses: '5',
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, code: created })
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        code: 'SAVE10',
        discount_type: 'percent',
        discount_value: 10,
        applicable_product_ids: null,
        applicable_user_ids: ['user-9'],
        max_uses: 5,
        is_active: true,
        created_by: 'admin-1',
      }),
    ])
  })
})
