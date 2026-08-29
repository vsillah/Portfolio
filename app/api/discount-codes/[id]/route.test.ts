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

import { DELETE, PUT } from './route'

function makePutRequest(body: Record<string, unknown>, id = 'dc-1') {
  return new NextRequest(`http://localhost/api/discount-codes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'dc-1') {
  return new NextRequest(`http://localhost/api/discount-codes/${id}`, {
    method: 'DELETE',
  })
}

function params(id = 'dc-1') {
  return { params: { id } }
}

function mockDiscountWrite({
  data,
  error = null,
}: {
  data: Record<string, unknown> | null
  error?: { code?: string; message?: string } | null
}) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ single })
  const updateEq = vi.fn().mockReturnValue({ select })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const deleteEq = vi.fn().mockResolvedValue({ error })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'discount_codes') throw new Error(`Unexpected table: ${table}`)
    return { update, delete: del }
  })
  return { update, delete: del, eq: updateEq, deleteEq, single }
}

describe('PUT /api/discount-codes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated updates before writing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(makePutRequest({ code: 'SAVE10' }), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('uppercases codes and clears empty applicability lists', async () => {
    const updated = { id: 'dc-1', code: 'SAVE10', is_active: false }
    const { update, eq } = mockDiscountWrite({ data: updated })

    const response = await PUT(
      makePutRequest({
        code: 'save10',
        discount_type: 'percent',
        discount_value: '15.5',
        applicable_product_ids: [],
        applicable_user_ids: [],
        max_uses: '',
        valid_until: '',
        is_active: false,
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, code: updated })
    expect(update).toHaveBeenCalledWith({
      code: 'SAVE10',
      discount_type: 'percent',
      discount_value: 15.5,
      applicable_product_ids: null,
      applicable_user_ids: null,
      max_uses: null,
      valid_until: null,
      is_active: false,
    })
    expect(eq).toHaveBeenCalledWith('id', 'dc-1')
  })

  it('returns 404 when the discount code is missing', async () => {
    mockDiscountWrite({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    const response = await PUT(makePutRequest({ code: 'GONE' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Discount code not found' })
  })
})

describe('DELETE /api/discount-codes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated deletes before writing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes the matching discount code', async () => {
    const { delete: del, deleteEq } = mockDiscountWrite({ data: { id: 'dc-1' } })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(del).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 'dc-1')
  })

  it('returns 404 when deleting a missing discount code', async () => {
    mockDiscountWrite({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Discount code not found' })
  })
})
