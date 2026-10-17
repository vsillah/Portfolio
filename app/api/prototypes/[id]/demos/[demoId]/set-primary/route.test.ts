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

import { PATCH } from './route'

function params(id = 'proto-1', demoId = 'demo-2') {
  return { params: { id, demoId } }
}

function makeRequest(id = 'proto-1', demoId = 'demo-2') {
  return new NextRequest(`http://localhost/api/prototypes/${id}/demos/${demoId}/set-primary`, {
    method: 'PATCH',
  })
}

describe('PATCH /api/prototypes/[id]/demos/[demoId]/set-primary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires authentication before changing the primary demo', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await PATCH(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids non-admin users from changing the primary demo', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.isAdmin.mockResolvedValue(false)

    const response = await PATCH(makeRequest(), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('unsets other primaries then marks the requested demo primary', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    const promoted = { id: 'demo-2', is_primary: true }
    const unsetEqPrimary = vi.fn().mockResolvedValue({ data: null, error: null })
    const unsetEqPrototype = vi.fn().mockReturnValue({ eq: unsetEqPrimary })
    const setEqPrototype = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: promoted, error: null }),
      }),
    })
    const setEqId = vi.fn().mockReturnValue({ eq: setEqPrototype })
    const update = vi.fn()
      .mockReturnValueOnce({ eq: unsetEqPrototype })
      .mockReturnValueOnce({ eq: setEqId })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: promoted })
    expect(update).toHaveBeenNthCalledWith(1, { is_primary: false })
    expect(unsetEqPrototype).toHaveBeenCalledWith('prototype_id', 'proto-1')
    expect(unsetEqPrimary).toHaveBeenCalledWith('is_primary', true)
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ is_primary: true, updated_at: expect.any(String) })
    )
    expect(setEqId).toHaveBeenCalledWith('id', 'demo-2')
    expect(setEqPrototype).toHaveBeenCalledWith('prototype_id', 'proto-1')
  })
})
