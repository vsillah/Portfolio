import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeRequest(body: Record<string, unknown> = { orderId: 101 }) {
  return new NextRequest('http://localhost/api/orders/fulfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chainSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

function chainEq(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq }
}

function chainIn(data: unknown, error: unknown = null) {
  const inFilter = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ in: inFilter })
  return { select, inFilter }
}

function chainUpdate(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error })
  const update = vi.fn().mockReturnValue({ eq })
  return { update, eq }
}

const shippingAddress = {
  name: 'Ada',
  address1: '1 Market St',
  city: 'San Francisco',
  state_code: 'CA',
  country_code: 'US',
  zip: '94105',
}

describe('POST /api/orders/fulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before reading orders', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Admin access required', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('requires an order id', async () => {
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Order ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the order is missing', async () => {
    mocks.from.mockReturnValueOnce(chainSingle(null, { message: 'missing' }))

    const response = await POST(makeRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Order not found' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('does not resubmit an order that already has a Printful id', async () => {
    mocks.from.mockReturnValueOnce(chainSingle({
      id: 101,
      printful_order_id: 'pf-existing',
      shipping_address: shippingAddress,
    }))

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Order already submitted to Printful' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('rejects digital-only orders with no merchandise variants', async () => {
    mocks.from
      .mockReturnValueOnce(chainSingle({
        id: 101,
        printful_order_id: null,
        shipping_address: shippingAddress,
      }))
      .mockReturnValueOnce(chainEq([
        { id: 1, order_id: 101, product_variant_id: null, printful_variant_id: null, quantity: 1 },
      ]))

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No merchandise items to fulfill' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('requires a shipping address before submitting to Printful', async () => {
    mocks.from
      .mockReturnValueOnce(chainSingle({
        id: 101,
        printful_order_id: null,
        shipping_address: null,
      }))
      .mockReturnValueOnce(chainEq([
        { id: 1, order_id: 101, product_variant_id: 55, printful_variant_id: null, quantity: 1 },
      ]))

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Shipping address is required' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('fails closed when merchandise items have no Printful variant mapping', async () => {
    mocks.from
      .mockReturnValueOnce(chainSingle({
        id: 101,
        printful_order_id: null,
        shipping_address: shippingAddress,
      }))
      .mockReturnValueOnce(chainEq([
        { id: 1, order_id: 101, product_variant_id: 55, printful_variant_id: null, quantity: 1 },
      ]))
      .mockReturnValueOnce(chainIn([
        { id: 55, printful_variant_id: null, printful_sync_variant_id: null },
      ]))

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No valid Printful items found' })
    expect(mocks.createOrder).not.toHaveBeenCalled()
  })

  it('submits mapped merchandise to Printful and records the Printful order id', async () => {
    const orderUpdate = chainUpdate()
    mocks.from
      .mockReturnValueOnce(chainSingle({
        id: 101,
        printful_order_id: null,
        shipping_address: shippingAddress,
        guest_email: 'guest@example.com',
        guest_name: 'Guest Buyer',
        total_amount: 40,
        shipping_cost: 8,
        tax: 2,
      }))
      .mockReturnValueOnce(chainEq([
        { id: 1, order_id: 101, product_variant_id: 55, printful_variant_id: 9001, quantity: 2 },
      ]))
      .mockReturnValueOnce(chainIn([
        { id: 55, printful_variant_id: 9001, printful_sync_variant_id: 777 },
      ]))
      .mockReturnValueOnce(orderUpdate)
    mocks.createOrder.mockResolvedValue({
      id: 555,
      items: [],
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      printful_order_id: 555,
      order: { id: 555, items: [] },
    })
    expect(mocks.createOrder).toHaveBeenCalledWith(
      '101',
      expect.objectContaining({
        name: 'Guest Buyer',
        email: 'guest@example.com',
        address1: '1 Market St',
        city: 'San Francisco',
        zip: '94105',
      }),
      [{ sync_variant_id: 777, quantity: 2 }],
      { subtotal: '40', shipping: '8', tax: '2' },
    )
    expect(orderUpdate.update).toHaveBeenCalledWith({
      printful_order_id: 555,
      fulfillment_status: 'processing',
    })
    expect(orderUpdate.eq).toHaveBeenCalledWith('id', 101)
  })
})
