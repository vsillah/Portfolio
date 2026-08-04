import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createOrder: vi.fn(),
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

vi.mock('@/lib/printful', () => ({
  printful: {
    createOrder: mocks.createOrder,
  },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/orders/fulfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

function mockOrderLookup(order: Record<string, unknown> | null) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: order,
    error: order ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })
  mocks.from.mockReturnValue({ select })
  return { select }
}

describe('POST /api/orders/fulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before reading orders', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ orderId: 42 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('requires orderId', async () => {
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Order ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the order is missing', async () => {
    mockOrderLookup(null)

    const response = await POST(makeRequest({ orderId: 999 }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Order not found' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('blocks resubmission when Printful already has the order', async () => {
    mockOrderLookup({
      id: 42,
      printful_order_id: 'pf-existing',
      shipping_address: { address1: '1 Main' },
    })

    const response = await POST(makeRequest({ orderId: 42 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Order already submitted to Printful',
    })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('returns 404 when order items are missing', async () => {
    let calls = 0
    mocks.from.mockImplementation((table: string) => {
      calls += 1
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 42,
                  printful_order_id: null,
                  shipping_address: { address1: '1 Main' },
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'order_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table} (call ${calls})`)
    })

    const response = await POST(makeRequest({ orderId: 42 }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Order items not found' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('rejects digital-only orders with no merchandise variants', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 42,
                  printful_order_id: null,
                  shipping_address: { address1: '1 Main' },
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'order_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 1,
                  order_id: 42,
                  product_id: 10,
                  product_variant_id: null,
                  printful_variant_id: null,
                  quantity: 1,
                  price_at_purchase: 29,
                },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ orderId: 42 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No merchandise items to fulfill',
    })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('requires a shipping address before calling Printful', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 42,
                  printful_order_id: null,
                  shipping_address: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'order_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 1,
                  order_id: 42,
                  product_id: 10,
                  product_variant_id: 77,
                  printful_variant_id: 'pv-1',
                  quantity: 1,
                  price_at_purchase: 29,
                },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ orderId: 42 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Shipping address is required',
    })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })
})
