import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getProducts: vi.fn(),
  estimateOrder: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/printful', () => ({
  printful: {
    getProducts: mocks.getProducts,
    estimateOrder: mocks.estimateOrder,
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function request() {
  return new NextRequest('http://localhost/api/admin/printful/test-connection')
}

function mockVariantLookup(variantId: number | null) {
  const single = vi.fn().mockResolvedValue({
    data: variantId == null ? null : { printful_variant_id: variantId },
    error: variantId == null ? { message: 'none' } : null,
  })
  const limit = vi.fn().mockReturnValue({ single })
  const not = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ not })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'product_variants') throw new Error(`Unexpected table: ${table}`)
    return { select }
  })
  return { select, not }
}

describe('GET /api/admin/printful/test-connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    process.env.PRINTFUL_API_KEY = 'pf-test-key'
    mocks.getProducts.mockResolvedValue([])
    mocks.estimateOrder.mockResolvedValue({ costs: { total: '12.50' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('rejects non-admin callers before touching Printful', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.getProducts).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('reports a missing API key without calling Printful', async () => {
    delete process.env.PRINTFUL_API_KEY

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PRINTFUL_API_KEY is not set',
    })
    expect(mocks.getProducts).not.toHaveBeenCalled()
  })

  it('succeeds when the store has no synced products', async () => {
    mocks.getProducts.mockResolvedValue([])

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message:
        'Printful connection OK. No sync products in store yet — sync from Admin → Content → Merchandise to add products.',
    })
    expect(mocks.estimateOrder).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips cost estimate when no linked Printful variant exists', async () => {
    mocks.getProducts.mockResolvedValue([{ id: 1 }, { id: 2 }])
    mockVariantLookup(null)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message:
        'Printful connection OK. 2 product(s) in store. Link a variant to a Printful variant and re-run to test cost estimate.',
      productCount: 2,
    })
    expect(mocks.estimateOrder).not.toHaveBeenCalled()
  })

  it('runs a dry-run cost estimate when a linked variant exists', async () => {
    mocks.getProducts.mockResolvedValue([{ id: 11 }])
    mockVariantLookup(4455)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message:
        'Printful connection OK. 1 product(s) in store. Cost estimate for 1 item: $12.50 (no order was created).',
      productCount: 1,
      estimateTotal: '12.50',
    })
    expect(mocks.estimateOrder).toHaveBeenCalledWith([
      { variant_id: 4455, quantity: 1 },
    ])
    expect(mocks.from).toHaveBeenCalledWith('product_variants')
  })

  it('returns ok:false without throwing when Printful errors', async () => {
    mocks.getProducts.mockRejectedValue(new Error('401 Unauthorized'))

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: '401 Unauthorized',
    })
    expect(mocks.estimateOrder).not.toHaveBeenCalled()
  })
})
