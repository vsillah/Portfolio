import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: mocks.storageFrom,
    },
  },
}))

import { GET } from './route'

function makeRequest(productId: string, orderId?: string) {
  const url = new URL(`http://localhost/api/products/${productId}/instructions`)
  if (orderId !== undefined) url.searchParams.set('orderId', orderId)
  return new NextRequest(url)
}

function params(id = 'prod-1') {
  return { params: Promise.resolve({ id }) }
}

type TableResult = { data: unknown; error: { message?: string } | null }

function mockTables(results: Record<string, TableResult>) {
  mocks.from.mockImplementation((table: string) => {
    const result = results[table]
    if (!result) throw new Error(`Unexpected table: ${table}`)
    const single = vi.fn().mockResolvedValue(result)
    const eq2 = vi.fn().mockReturnValue({ single })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2, single })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    return { select }
  })
}

describe('GET /api/products/[id]/instructions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.createSignedUrl })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/install.pdf' },
      error: null,
    })
  })

  it('requires sign-in before looking up an order', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await GET(makeRequest('prod-1', '99'), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Sign in to download install instructions',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires an orderId from the purchase link', async () => {
    const response = await GET(makeRequest('prod-1'), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Order ID is required. Use the link from your purchase.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric orderId', async () => {
    const response = await GET(makeRequest('prod-1', 'abc'), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid order ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids downloading another user\'s completed order', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'other-user', status: 'completed' },
        error: null,
      },
    })

    const response = await GET(makeRequest('prod-1', '99'), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('forbids downloads until the order is completed', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', status: 'pending' },
        error: null,
      },
    })

    const response = await GET(makeRequest('prod-1', '99'), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Order must be completed to download instructions',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns 404 when the product is not on the order', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', status: 'completed' },
        error: null,
      },
      order_items: { data: null, error: { message: 'not found' } },
    })

    const response = await GET(makeRequest('prod-1', '99'), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Product not found in this order',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects non-template products even after a completed purchase', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', status: 'completed' },
        error: null,
      },
      order_items: { data: { id: 'item-1' }, error: null },
      products: {
        data: {
          id: 'prod-1',
          type: 'training',
          instructions_file_path: 'guides/install.pdf',
          title: 'Curriculum',
        },
        error: null,
      },
    })

    const response = await GET(makeRequest('prod-1', '99'), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Install instructions are only available for template products',
    })
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('returns a signed URL for a completed template purchase', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', status: 'completed' },
        error: null,
      },
      order_items: { data: { id: 'item-1' }, error: null },
      products: {
        data: {
          id: 'prod-1',
          type: 'template',
          instructions_file_path: 'guides/Install Guide.pdf',
          title: 'Ops Starter Kit!',
        },
        error: null,
      },
    })

    const response = await GET(makeRequest('prod-1', '99'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://signed.example/install.pdf',
      fileName: 'Ops-Starter-Kit-instructions.pdf',
    })
    expect(mocks.storageFrom).toHaveBeenCalledWith('products')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('guides/Install Guide.pdf', 3600)
  })
})
