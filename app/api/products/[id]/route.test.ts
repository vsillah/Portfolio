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

import { DELETE, GET, PUT } from './route'

function params(id = 'prod-1') {
  return { params: { id } }
}

function makeGetRequest(id = 'prod-1') {
  return new NextRequest(`http://localhost/api/products/${id}`)
}

function makePutRequest(body: Record<string, unknown>, id = 'prod-1') {
  return new NextRequest(`http://localhost/api/products/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'prod-1') {
  return new NextRequest(`http://localhost/api/products/${id}`, { method: 'DELETE' })
}

function mockProductRead(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq, single }
}

function mockProductWrite({
  data,
  error = null,
}: {
  data?: Record<string, unknown> | null
  error?: { code?: string; message?: string } | null
}) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ single })
  const updateEq = vi.fn().mockReturnValue({ select })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const deleteEq = vi.fn().mockResolvedValue({ error })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })
  mocks.from.mockReturnValue({ update, delete: del })
  return { update, delete: del, eq: updateEq, deleteEq }
}

const paidProduct = {
  id: 'prod-1',
  title: 'Curriculum',
  type: 'training',
  is_print_on_demand: false,
  asset_url: 'https://private.example/asset.zip',
  instructions_file_path: 'private/instructions.pdf',
}

describe('GET /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 404 when the product is missing', async () => {
    mockProductRead({ data: null, error: { code: 'PGRST116', message: 'not found' } })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Product not found' })
  })

  it('omits paid-asset fields for public requests', async () => {
    mockProductRead({ data: paidProduct, error: null })
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.product).toEqual({
      id: 'prod-1',
      title: 'Curriculum',
      type: 'training',
      is_print_on_demand: false,
      asset_url: null,
      instructions_file_path: null,
    })
    expect(body.variants).toEqual([])
  })

  it('returns paid-asset fields to admins', async () => {
    mockProductRead({ data: paidProduct, error: null })
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)

    const response = await GET(makeGetRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.product.asset_url).toBe(paidProduct.asset_url)
    expect(body.product.instructions_file_path).toBe(paidProduct.instructions_file_path)
  })
})

describe('PUT /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated updates before writing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(makePutRequest({ title: 'Updated' }), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown product type', async () => {
    const response = await PUT(makePutRequest({ type: 'not-a-type' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid product type' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates the product with a canonical type', async () => {
    const updated = { id: 'prod-1', title: 'Curriculum', type: 'training' }
    const { update, eq } = mockProductWrite({ data: updated })

    const response = await PUT(makePutRequest({
      title: 'Curriculum',
      type: 'training',
      price: '49',
    }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: updated })
    expect(update).toHaveBeenCalledWith({
      title: 'Curriculum',
      type: 'training',
      price: 49,
    })
    expect(eq).toHaveBeenCalledWith('id', 'prod-1')
  })
})

describe('DELETE /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated deletes before writing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes the product by id', async () => {
    const { deleteEq } = mockProductWrite({ data: null, error: null })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(deleteEq).toHaveBeenCalledWith('id', 'prod-1')
  })
})
