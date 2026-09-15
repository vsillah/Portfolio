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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/campaigns/camp-1/enrollments/enr-1')
}

const params = { params: { id: 'camp-1', enrollmentId: 'enr-1' } }

describe('GET /api/admin/campaigns/[id]/enrollments/[enrollmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when PostgREST reports no matching enrollment', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const campaignEq = vi.fn().mockReturnValue({ single })
    const idEq = vi.fn().mockReturnValue({ eq: campaignEq })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: idEq }),
    })

    const response = await GET(request(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment not found' })
    expect(idEq).toHaveBeenCalledWith('id', 'enr-1')
    expect(campaignEq).toHaveBeenCalledWith('campaign_id', 'camp-1')
  })

  it('returns the enrollment when it belongs to the campaign', async () => {
    const enrollment = { id: 'enr-1', campaign_id: 'camp-1', status: 'active' }
    const single = vi.fn().mockResolvedValue({ data: enrollment, error: null })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single }),
        }),
      }),
    })

    const response = await GET(request(), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: enrollment })
    expect(mocks.from).toHaveBeenCalledWith('campaign_enrollments')
  })

  it('returns 500 for unexpected database errors', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'XX000', message: 'boom' },
            }),
          }),
        }),
      }),
    })

    const response = await GET(request(), params)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch enrollment' })
  })
})
