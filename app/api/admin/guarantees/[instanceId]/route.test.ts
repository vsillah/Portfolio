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
  return new NextRequest('http://localhost/api/admin/guarantees/inst-1')
}

function params(instanceId = 'inst-1') {
  return { params: { instanceId } }
}

function mockInstanceLookup(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq }
}

describe('GET /api/admin/guarantees/[instanceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before reading guarantee instances', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the instance is missing', async () => {
    mockInstanceLookup({ data: null, error: { code: 'PGRST116', message: 'not found' } })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Guarantee instance not found' })
  })

  it('returns the instance with template and milestone embeds', async () => {
    const instance = {
      id: 'inst-1',
      status: 'active',
      guarantee_templates: { id: 'tmpl-1', name: 'ROI Guarantee' },
      guarantee_milestones: [{ id: 'ms-1', status: 'pending' }],
    }
    const { select, eq } = mockInstanceLookup({ data: instance, error: null })

    const response = await GET(makeRequest(), params('inst-1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(instance)
    expect(mocks.from).toHaveBeenCalledWith('guarantee_instances')
    expect(select).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', 'inst-1')
  })

  it('returns the database error message on unexpected failures', async () => {
    mockInstanceLookup({ data: null, error: { code: 'XX000', message: 'relation exploded' } })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'relation exploded' })
  })
})
