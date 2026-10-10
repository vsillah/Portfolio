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

import { DELETE, PUT } from './route'

function params(id = 'proto-1', demoId = 'demo-1') {
  return { params: { id, demoId } }
}

function makePutRequest(body: Record<string, unknown>, id = 'proto-1', demoId = 'demo-1') {
  return new NextRequest(`http://localhost/api/prototypes/${id}/demos/${demoId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'proto-1', demoId = 'demo-1') {
  return new NextRequest(`http://localhost/api/prototypes/${id}/demos/${demoId}`, {
    method: 'DELETE',
  })
}

describe('PUT /api/prototypes/[id]/demos/[demoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires authentication before updating a demo', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await PUT(makePutRequest({ title: 'Updated' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids non-admin updates', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.isAdmin.mockResolvedValue(false)

    const response = await PUT(makePutRequest({ title: 'Updated' }), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('unsets sibling primaries when promoting a demo', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    const updated = { id: 'demo-1', is_primary: true, title: 'Primary' }
    const unsetNeq = vi.fn().mockResolvedValue({ data: null, error: null })
    const unsetEqPrimary = vi.fn().mockReturnValue({ neq: unsetNeq })
    const unsetEqPrototype = vi.fn().mockReturnValue({ eq: unsetEqPrimary })
    const updateEqDemo = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: updated, error: null }),
        }),
      }),
    })
    const update = vi.fn()
      .mockReturnValueOnce({ eq: unsetEqPrototype })
      .mockReturnValueOnce({ eq: updateEqDemo })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(makePutRequest({ is_primary: true, title: 'Primary' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: updated })
    expect(unsetEqPrototype).toHaveBeenCalledWith('prototype_id', 'proto-1')
    expect(unsetEqPrimary).toHaveBeenCalledWith('is_primary', true)
    expect(unsetNeq).toHaveBeenCalledWith('id', 'demo-1')
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ is_primary: true, title: 'Primary', updated_at: expect.any(String) })
    )
  })
})

describe('DELETE /api/prototypes/[id]/demos/[demoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires authentication before deleting a demo', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids non-admin deletes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.isAdmin.mockResolvedValue(false)

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('refuses to delete the only remaining demo', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    const del = vi.fn()
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'demo-1' }], error: null }),
      }),
      delete: del,
    })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot delete the only demo for a prototype',
    })
    expect(del).not.toHaveBeenCalled()
  })

  it('deletes a demo when siblings remain', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    const deleteEqPrototype = vi.fn().mockResolvedValue({ error: null })
    const deleteEqId = vi.fn().mockReturnValue({ eq: deleteEqPrototype })
    const del = vi.fn().mockReturnValue({ eq: deleteEqId })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'demo-1' }, { id: 'demo-2' }], error: null }),
      }),
      delete: del,
    })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(deleteEqId).toHaveBeenCalledWith('id', 'demo-1')
    expect(deleteEqPrototype).toHaveBeenCalledWith('prototype_id', 'proto-1')
  })
})
