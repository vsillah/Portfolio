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
  return new NextRequest(`http://localhost/api/prototypes/${id}/history`)
}

function makePostRequest(body: Record<string, unknown>, id = 'proto-1') {
  return new NextRequest(`http://localhost/api/prototypes/${id}/history`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/prototypes/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists stage history without requiring auth', async () => {
    const history = [{ id: 'h1', new_stage: 'Pilot' }]
    const order = vi.fn().mockResolvedValue({ data: history, error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(history)
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('prototype_id', 'proto-1')
    expect(order).toHaveBeenCalledWith('changed_at', { ascending: false })
  })
})

describe('POST /api/prototypes/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires authentication before recording a stage change', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await POST(makePostRequest({ new_stage: 'Pilot' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids non-admin stage history writes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.isAdmin.mockResolvedValue(false)

    const response = await POST(makePostRequest({ new_stage: 'Pilot' }), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([{}, { new_stage: '' }, { old_stage: 'Idea' }])(
    'requires new_stage for %j',
    async (body) => {
      mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
      mocks.isAdmin.mockResolvedValue(true)

      const response = await POST(makePostRequest(body), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'New stage is required' })
      expect(mocks.from).not.toHaveBeenCalled()
    }
  )

  it('records the stage change with the acting admin id', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    const created = { id: 'h2', new_stage: 'Pilot', changed_by: 'admin-1' }
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(
      makePostRequest({ old_stage: 'Idea', new_stage: 'Pilot', change_reason: 'Ready' }),
      params()
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: created })
    expect(insert).toHaveBeenCalledWith([
      {
        prototype_id: 'proto-1',
        old_stage: 'Idea',
        new_stage: 'Pilot',
        changed_by: 'admin-1',
        change_reason: 'Ready',
      },
    ])
  })
})
