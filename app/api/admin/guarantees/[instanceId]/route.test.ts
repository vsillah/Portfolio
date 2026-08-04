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

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/guarantees/inst-1', {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
  })
}

function params(instanceId = 'inst-1') {
  return { params: { instanceId } }
}

describe('GET /api/admin/guarantees/[instanceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before reading instances', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when PostgREST reports no rows (PGRST116)', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
          }),
        }),
      }),
    })

    const response = await GET(makeRequest(), params('missing-inst'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Guarantee instance not found',
    })
    expect(mocks.from).toHaveBeenCalledWith('guarantee_instances')
  })

  it('returns the instance with nested template and milestones', async () => {
    const instance = {
      id: 'inst-1',
      status: 'active',
      guarantee_templates: { id: 'tmpl-1', name: 'ROI Guarantee' },
      guarantee_milestones: [{ id: 'ms-1', status: 'pending' }],
    }

    const eq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: instance, error: null }),
    })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(instance)
    expect(eq).toHaveBeenCalledWith('id', 'inst-1')
  })
})
