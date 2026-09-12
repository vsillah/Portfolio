import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  calculateShipping: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/printful', () => ({
  printful: {
    calculateShipping: mocks.calculateShipping,
  },
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/checkout/shipping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const recipient = {
  address1: '1 Main St',
  city: 'Austin',
  state_code: 'TX',
  country_code: 'US',
  zip: '78701',
}

describe('POST /api/checkout/shipping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires items and a recipient address', async () => {
    const noItems = await POST(makeRequest({ recipient }))
    expect(noItems.status).toBe(400)
    await expect(noItems.json()).resolves.toEqual({ error: 'Items are required' })

    const noRecipient = await POST(
      makeRequest({
        items: [{ productId: 'p1', quantity: 1 }],
      }),
    )
    expect(noRecipient.status).toBe(400)
    await expect(noRecipient.json()).resolves.toEqual({
      error: 'Recipient address is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns free shipping when merchandise subtotal meets the threshold', async () => {
    const variantSingle = vi.fn().mockResolvedValue({ data: { price: 40 }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'product_variants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: variantSingle }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        recipient,
        items: [
          {
            variantId: 'var-1',
            printfulVariantId: 111,
            quantity: 2,
          },
        ],
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      shipping_cost: 0,
      subtotal: 80,
      total: 80,
      free_shipping: true,
      free_shipping_threshold: 75,
    })
    expect(mocks.calculateShipping).not.toHaveBeenCalled()
  })

  it('uses the first Printful rate below the free-shipping threshold', async () => {
    const variantSingle = vi.fn().mockResolvedValue({ data: { price: 20 }, error: null })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: variantSingle }),
      }),
    })
    mocks.calculateShipping.mockResolvedValue([{ rate: '5.50' }, { rate: '9.00' }])

    const response = await POST(
      makeRequest({
        recipient,
        items: [
          {
            variantId: 'var-1',
            printfulVariantId: 222,
            quantity: 1,
          },
        ],
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      shipping_cost: 5.5,
      subtotal: 20,
      total: 25.5,
      free_shipping: false,
      free_shipping_threshold: 75,
    })
    expect(mocks.calculateShipping).toHaveBeenCalledWith(
      {
        address1: '1 Main St',
        city: 'Austin',
        state_code: 'TX',
        country_code: 'US',
        zip: '78701',
      },
      [{ variant_id: 222, quantity: 1 }],
    )
  })

  it('falls back to the flat rate when Printful fails or items are digital-only', async () => {
    const variantSingle = vi.fn().mockResolvedValue({ data: { price: 10 }, error: null })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: variantSingle }),
      }),
    })
    mocks.calculateShipping.mockRejectedValueOnce(new Error('printful down'))

    const printfulFail = await POST(
      makeRequest({
        recipient,
        items: [{ variantId: 'var-1', printfulVariantId: 333, quantity: 1 }],
      }),
    )
    expect(printfulFail.status).toBe(200)
    const printfulFailJson = await printfulFail.json()
    expect(printfulFailJson).toMatchObject({
      shipping_cost: 7.99,
      subtotal: 10,
      free_shipping: false,
    })
    expect(printfulFailJson.total).toBeCloseTo(17.99, 2)

    const productSingle = vi.fn().mockResolvedValue({ data: { price: 15 }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: productSingle }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const digitalOnly = await POST(
      makeRequest({
        recipient,
        items: [{ productId: 'prod-1', quantity: 2 }],
      }),
    )
    expect(digitalOnly.status).toBe(200)
    const digitalJson = await digitalOnly.json()
    expect(digitalJson).toMatchObject({
      shipping_cost: 7.99,
      subtotal: 30,
      free_shipping: false,
    })
    expect(digitalJson.total).toBeCloseTo(37.99, 2)
    // Second call should not hit Printful (no merchandise variants)
    expect(mocks.calculateShipping).toHaveBeenCalledTimes(1)
  })
})
