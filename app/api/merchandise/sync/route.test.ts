import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  getProductDetails: vi.fn(),
  getProducts: vi.fn(),
  batchGenerateMockups: vi.fn(),
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
    getProductDetails: mocks.getProductDetails,
    getProducts: mocks.getProducts,
  },
  parsePrintfulPrice: (priceString: string) => parseFloat(priceString) || 0,
  calculatePriceWithMarkup: (baseCost: number, markupPercentage: number) =>
    baseCost * (1 + markupPercentage / 100),
}))

vi.mock('@/lib/mockup-generator', () => ({
  batchGenerateMockups: mocks.batchGenerateMockups,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/merchandise/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mugDetails = {
  product: {
    id: 55,
    name: 'Logo Mug',
    type_name: 'Mug',
    brand: 'Generic',
    model: '11oz',
    image: 'https://img.example/mug.png',
  },
  variants: [
    {
      id: 101,
      price: '10.00',
      is_enabled: true,
      is_discontinued: false,
      size: null,
      color: 'White',
      color_code: '#fff',
      name: 'SKU-WHITE',
    },
    {
      id: 102,
      price: '10.00',
      is_enabled: false,
      is_discontinued: false,
      size: null,
      color: 'Black',
      color_code: '#000',
      name: 'SKU-BLACK',
    },
    {
      id: 103,
      price: '10.00',
      is_enabled: true,
      is_discontinued: true,
      size: null,
      color: 'Red',
      color_code: '#f00',
      name: 'SKU-RED',
    },
  ],
}

function mockCatalogTables(existingProduct: { id: number } | null) {
  const productInserts: Record<string, unknown>[] = []
  const productUpdates: Record<string, unknown>[] = []
  const variantInserts: Record<string, unknown>[] = []

  mocks.from.mockImplementation((table: string) => {
    if (table === 'products') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: existingProduct,
                error: existingProduct ? null : { message: 'not found' },
              }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          productInserts.push(payload)
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: 9 }, error: null }),
            }),
          }
        },
        update: (payload: Record<string, unknown>) => {
          productUpdates.push(payload)
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    }
    if (table === 'product_variants') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'not found' },
                }),
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          variantInserts.push(payload)
          return Promise.resolve({ error: null })
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return { productInserts, productUpdates, variantInserts }
}

describe('POST /api/merchandise/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.batchGenerateMockups.mockResolvedValue({})
  })

  it('rejects unauthenticated sync requests before calling Printful', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ productIds: [55] }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.getProductDetails).not.toHaveBeenCalled()
    expect(mocks.getProducts).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a merchandise product, maps mug types to houseware, and skips disabled variants', async () => {
    mocks.getProductDetails.mockResolvedValue(mugDetails)
    const { productInserts, variantInserts } = mockCatalogTables(null)

    const response = await POST(
      makeRequest({ productIds: [55], defaultMarkup: 50 }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      results: { created: 1, updated: 0, errors: [] },
    })
    expect(mocks.getProductDetails).toHaveBeenCalledWith(55)
    expect(mocks.getProducts).not.toHaveBeenCalled()
    expect(productInserts[0]).toEqual(
      expect.objectContaining({
        title: 'Logo Mug',
        type: 'merchandise',
        category: 'houseware',
        printful_product_id: 55,
        base_cost: 10,
        markup_percentage: 50,
        price: 15,
        is_print_on_demand: true,
        is_active: true,
        created_by: 'admin-1',
      }),
    )
    expect(variantInserts).toHaveLength(1)
    expect(variantInserts[0]).toEqual(
      expect.objectContaining({
        printful_variant_id: 101,
        sku: 'SKU-WHITE',
        price: 15,
        is_available: true,
        mockup_urls: [],
      }),
    )
    expect(mocks.batchGenerateMockups).not.toHaveBeenCalled()
  })

  it('updates an existing Printful product instead of inserting a duplicate', async () => {
    mocks.getProductDetails.mockResolvedValue(mugDetails)
    const { productInserts, productUpdates } = mockCatalogTables({ id: 9 })

    const response = await POST(makeRequest({ productIds: [55] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      results: { created: 0, updated: 1, errors: [] },
    })
    expect(productInserts).toEqual([])
    expect(productUpdates[0]).toEqual(
      expect.objectContaining({
        title: 'Logo Mug',
        category: 'houseware',
        price: 15,
      }),
    )
  })

  it('returns 500 when Printful catalog loading fails', async () => {
    mocks.getProductDetails.mockRejectedValue(new Error('catalog unavailable'))

    const response = await POST(makeRequest({ productIds: [55] }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'catalog unavailable',
    })
  })
})
