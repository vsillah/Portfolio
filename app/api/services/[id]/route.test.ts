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

function params(id = 'svc-1') {
  return { params: { id } }
}

function makeGetRequest(id = 'svc-1') {
  return new NextRequest(`http://localhost/api/services/${id}`)
}

function makePutRequest(body: Record<string, unknown>, id = 'svc-1') {
  return new NextRequest(`http://localhost/api/services/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'svc-1') {
  return new NextRequest(`http://localhost/api/services/${id}`, { method: 'DELETE' })
}

function mockServiceRead(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq, single }
}

function mockServiceWrite({
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
  return { update, delete: del, eq: updateEq, deleteEq, single }
}

describe('GET /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the service when found', async () => {
    const service = { id: 'svc-1', title: 'Workshop', service_type: 'workshop' }
    mockServiceRead({ data: service, error: null })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(service)
  })

  it('returns 404 when the service is missing', async () => {
    mockServiceRead({ data: null, error: { code: 'PGRST116', message: 'not found' } })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Service not found' })
  })
})

describe('PUT /api/services/[id]', () => {
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

  it('rejects an unknown service type', async () => {
    const response = await PUT(makePutRequest({ service_type: 'not-a-type' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid service type'),
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates the service with parsed numeric fields', async () => {
    const updated = { id: 'svc-1', title: 'Updated', price: 2500 }
    const { update, eq } = mockServiceWrite({ data: updated })

    const response = await PUT(makePutRequest({
      title: 'Updated',
      price: '2500',
      unit_cost: '400',
      is_active: false,
    }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: updated })
    expect(update).toHaveBeenCalledWith({
      title: 'Updated',
      price: 2500,
      unit_cost: 400,
      is_active: false,
    })
    expect(eq).toHaveBeenCalledWith('id', 'svc-1')
  })

  it('returns 404 when the service is missing', async () => {
    mockServiceWrite({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    const response = await PUT(makePutRequest({ title: 'Gone' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Service not found' })
  })
})

describe('DELETE /api/services/[id]', () => {
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

  it('deletes the service by id', async () => {
    const { deleteEq } = mockServiceWrite({ data: null, error: null })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(deleteEq).toHaveBeenCalledWith('id', 'svc-1')
  })
})
