import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  validateConditions: vi.fn(),
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

vi.mock('@/lib/guarantees', () => ({
  validateConditions: mocks.validateConditions,
}))

import { DELETE, GET, PUT } from './route'

function makeGetRequest(id = 'tpl-1') {
  return new NextRequest(`http://localhost/api/admin/guarantee-templates/${id}`)
}

function makePutRequest(body: Record<string, unknown>, id = 'tpl-1') {
  return new NextRequest(`http://localhost/api/admin/guarantee-templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'tpl-1') {
  return new NextRequest(`http://localhost/api/admin/guarantee-templates/${id}`, {
    method: 'DELETE',
  })
}

function params(id = 'tpl-1') {
  return { params: { id } }
}

function mockTemplateWrite({
  data,
  error = null,
}: {
  data: Record<string, unknown> | null
  error?: { code?: string; message?: string } | null
}) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn().mockReturnValue({ single })
  const eq = vi.fn().mockReturnValue({ select, single })
  const update = vi.fn().mockReturnValue({ eq })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'guarantee_templates') throw new Error(`Unexpected table: ${table}`)
    return { select: vi.fn().mockReturnValue({ eq }), update }
  })
  return { update, eq, single }
}

describe('GET /api/admin/guarantee-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated reads before fetching templates', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the template is missing', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Template not found' })
  })
})

describe('PUT /api/admin/guarantee-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.validateConditions.mockReturnValue(true)
  })

  it('rejects invalid payout types before updating', async () => {
    const response = await PUT(
      makePutRequest({ default_payout_type: 'store_credit' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid default_payout_type',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid amount types before updating', async () => {
    const response = await PUT(
      makePutRequest({ payout_amount_type: 'percent' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid payout_amount_type',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects malformed conditions before updating', async () => {
    mocks.validateConditions.mockReturnValue(false)

    const response = await PUT(makePutRequest({ conditions: [{ id: 'x' }] }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid conditions structure',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates only provided fields and trims name/description', async () => {
    const updated = { id: 'tpl-1', name: 'Updated Guarantee', is_active: true }
    const { update, eq } = mockTemplateWrite({ data: updated })

    const response = await PUT(
      makePutRequest({
        name: '  Updated Guarantee  ',
        description: '  Clarified terms  ',
        is_active: true,
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(updated)
    expect(update).toHaveBeenCalledWith({
      name: 'Updated Guarantee',
      description: 'Clarified terms',
      is_active: true,
    })
    expect(eq).toHaveBeenCalledWith('id', 'tpl-1')
  })

  it('returns 404 when updating a missing template', async () => {
    mockTemplateWrite({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    const response = await PUT(makePutRequest({ name: 'Gone' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Template not found' })
  })
})

describe('DELETE /api/admin/guarantee-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('soft-deletes by setting is_active=false', async () => {
    const deactivated = { id: 'tpl-1', is_active: false }
    const { update, eq } = mockTemplateWrite({ data: deactivated })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: deactivated,
    })
    expect(update).toHaveBeenCalledWith({ is_active: false })
    expect(eq).toHaveBeenCalledWith('id', 'tpl-1')
  })

  it('returns 404 when soft-deleting a missing template', async () => {
    mockTemplateWrite({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Template not found' })
  })
})
