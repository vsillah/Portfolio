import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  notifyShipmentUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/notifications', () => ({
  notifyShipmentUpdate: mocks.notifyShipmentUpdate,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/webhooks/printful', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function shippedPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'package_shipped',
    data: {
      shipment: {
        tracking_number: '1Z999',
        tracking_url: 'https://track.example.com/1Z999',
        carrier: 'UPS',
        ship_date: '2026-08-10',
        ...((overrides.shipment as Record<string, unknown>) ?? {}),
      },
      order: {
        id: 4242,
        external_id: 'ord-external',
        ...((overrides.order as Record<string, unknown>) ?? {}),
      },
    },
  }
}

describe('POST /api/webhooks/printful', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.notifyShipmentUpdate.mockResolvedValue(undefined)
    process.env.NEXT_PUBLIC_SITE_URL = 'https://amadutown.com'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('acks non-package_shipped or incomplete payloads without DB access', async () => {
    const ignored = await POST(makeRequest({ type: 'order_updated', data: {} }))
    expect(ignored.status).toBe(200)
    await expect(ignored.json()).resolves.toEqual({ received: true })
    expect(mocks.from).not.toHaveBeenCalled()

    const incomplete = await POST(
      makeRequest({ type: 'package_shipped', data: { order: { id: 1 } } }),
    )
    expect(incomplete.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('acks when no local order matches the Printful order id', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
    })

    const response = await POST(makeRequest(shippedPayload()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.notifyShipmentUpdate).not.toHaveBeenCalled()
  })

  it('marks the order shipped, persists tracking, and emails the guest', async () => {
    const order = {
      id: 'order-1',
      user_id: null,
      guest_email: 'guest@example.com',
      guest_name: 'Guest Buyer',
    }
    const selectSingle = vi.fn().mockResolvedValue({ data: order, error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
          update,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(shippedPayload()))

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      fulfillment_status: 'shipped',
      tracking_number: '1Z999',
      tracking_url: 'https://track.example.com/1Z999',
      estimated_delivery: '2026-08-10',
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'order-1')
    expect(mocks.notifyShipmentUpdate).toHaveBeenCalledWith({
      clientEmail: 'guest@example.com',
      clientName: 'Guest Buyer',
      orderId: 'order-1',
      trackingNumber: '1Z999',
      trackingUrl: 'https://track.example.com/1Z999',
      carrier: 'UPS',
      purchasesUrl: 'https://amadutown.com/purchases?orderId=order-1',
    })
  })

  it('prefers the signed-in profile email and still returns 200 if email send fails', async () => {
    const order = {
      id: 'order-2',
      user_id: 'user-1',
      guest_email: 'guest@example.com',
      guest_name: 'Guest',
    }
    const orderSingle = vi.fn().mockResolvedValue({ data: order, error: null })
    const profileSingle = vi.fn().mockResolvedValue({
      data: { email: 'member@example.com', full_name: 'Member Name' },
      error: null,
    })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: orderSingle }) }),
          update,
        }
      }
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: profileSingle }) }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.notifyShipmentUpdate.mockRejectedValueOnce(new Error('smtp down'))

    const response = await POST(makeRequest(shippedPayload()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.notifyShipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: 'member@example.com',
        clientName: 'Member Name',
        orderId: 'order-2',
      }),
    )
  })

  it('returns 500 when the order update fails', async () => {
    const order = {
      id: 'order-3',
      user_id: null,
      guest_email: 'guest@example.com',
      guest_name: null,
    }
    const selectSingle = vi.fn().mockResolvedValue({ data: order, error: null })
    const updateEq = vi.fn().mockResolvedValue({ error: { message: 'db write failed' } })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
      update,
    })

    const response = await POST(makeRequest(shippedPayload()))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to update order' })
    expect(mocks.notifyShipmentUpdate).not.toHaveBeenCalled()
  })
})
