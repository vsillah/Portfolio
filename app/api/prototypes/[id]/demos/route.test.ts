import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  isAdmin: mocks.isAdmin,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET, POST } from './route'

function params(id = 'proto-1') {
  return { params: { id } }
}

function makeGetRequest(id = 'proto-1') {
  return new NextRequest(`http://localhost/api/prototypes/${id}/demos`)
}

function makePostRequest(body: Record<string, unknown>, id = 'proto-1') {
  return new NextRequest(`http://localhost/api/prototypes/${id}/demos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/prototypes/[id]/demos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists demos for the prototype without requiring auth', async () => {
    const demos = [{ id: 'demo-1', prototype_id: 'proto-1', title: 'Walkthrough' }]
    const order = vi.fn().mockResolvedValue({ data: demos, error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(demos)
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('prototype_id', 'proto-1')
    expect(order).toHaveBeenCalledWith('display_order', { ascending: true })
  })

  it('returns an empty list when no demos exist', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })
})

describe('POST /api/prototypes/[id]/demos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires authentication before creating a demo', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await POST(
      makePostRequest({ title: 'Walkthrough', demo_url: 'https://demo.example' }),
      params()
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids non-admin users from creating a demo', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.isAdmin.mockResolvedValue(false)

    const response = await POST(
      makePostRequest({ title: 'Walkthrough', demo_url: 'https://demo.example' }),
      params()
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { title: 'Walkthrough' },
    { demo_url: 'https://demo.example' },
    { title: '', demo_url: 'https://demo.example' },
    { title: 'Walkthrough', demo_url: '' },
  ])('rejects a demo missing title or url %j', async (body) => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)

    const response = await POST(makePostRequest(body), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Title and demo URL are required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('unsets other primaries before inserting a primary demo', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    const created = { id: 'demo-2', title: 'Primary', is_primary: true }
    const updateEqPrimary = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateEqPrototype = vi.fn().mockReturnValue({ eq: updateEqPrimary })
    const update = vi.fn().mockReturnValue({ eq: updateEqPrototype })
    const insertSingle = vi.fn().mockResolvedValue({ data: created, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })
    mocks.from.mockReturnValue({ update, insert })

    const response = await POST(
      makePostRequest({
        title: 'Primary',
        demo_url: 'https://demo.example',
        is_primary: true,
        demo_type: 'interactive',
      }),
      params()
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: created })
    expect(update).toHaveBeenCalledWith({ is_primary: false })
    expect(updateEqPrototype).toHaveBeenCalledWith('prototype_id', 'proto-1')
    expect(updateEqPrimary).toHaveBeenCalledWith('is_primary', true)
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        prototype_id: 'proto-1',
        title: 'Primary',
        demo_url: 'https://demo.example',
        demo_type: 'interactive',
        is_primary: true,
      }),
    ])
  })
})
