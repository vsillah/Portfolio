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

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/admin/guarantees/inst-1/resolve',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(instanceId = 'inst-1') {
  return { params: { instanceId } }
}

function mockInstanceLookup({
  instance,
  updated = null,
  updateError = null,
}: {
  instance: { id: string; status: string } | null
  updated?: Record<string, unknown> | null
  updateError?: { message: string } | null
}) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: instance,
    error: instance ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  const updateSingle = vi.fn().mockResolvedValue({
    data: updated,
    error: updateError,
  })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'guarantee_instances') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { select, update }
  })

  return { update, updateEq }
}

describe('POST /api/admin/guarantees/[instanceId]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before reading guarantee instances', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ resolution: 'voided' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid resolution values', async () => {
    const response = await POST(makeRequest({ resolution: 'force_paid' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid resolution. Must be one of: voided, expired',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the guarantee instance is missing', async () => {
    mockInstanceLookup({ instance: null })

    const response = await POST(makeRequest({ resolution: 'voided' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Instance not found' })
  })

  it('blocks manual resolution when the instance is already paid out', async () => {
    mockInstanceLookup({ instance: { id: 'inst-1', status: 'paid_out' } })

    const response = await POST(makeRequest({ resolution: 'voided' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot resolve guarantee with status: paid_out',
    })
  })

  it('voids an active guarantee and persists resolution notes', async () => {
    const updated = {
      id: 'inst-1',
      status: 'voided',
      resolution_notes: 'Client withdrew claim',
    }
    const { update, updateEq } = mockInstanceLookup({
      instance: { id: 'inst-1', status: 'active' },
      updated,
    })

    const response = await POST(
      makeRequest({ resolution: 'voided', notes: 'Client withdrew claim' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: updated })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'voided',
        resolution_notes: 'Client withdrew claim',
        resolved_at: expect.any(String),
      }),
    )
    expect(updateEq).toHaveBeenCalledWith('id', 'inst-1')
  })

  it('allows resolving conditions_met instances as expired with default notes', async () => {
    const updated = {
      id: 'inst-1',
      status: 'expired',
      resolution_notes: 'Manually expired by admin.',
    }
    const { update } = mockInstanceLookup({
      instance: { id: 'inst-1', status: 'conditions_met' },
      updated,
    })

    const response = await POST(makeRequest({ resolution: 'expired' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: updated })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'expired',
        resolution_notes: 'Manually expired by admin.',
      }),
    )
  })
})
