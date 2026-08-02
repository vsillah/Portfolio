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

function makeGetRequest(id = 'camp-1', enrollmentId = 'enr-1') {
  return new NextRequest(
    `http://localhost/api/admin/campaigns/${id}/enrollments/${enrollmentId}`,
  )
}

function params(id = 'camp-1', enrollmentId = 'enr-1') {
  return { params: { id, enrollmentId } }
}

describe('GET /api/admin/campaigns/[id]/enrollments/[enrollmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before fetching enrollment detail', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('scopes the lookup by enrollment id and campaign id', async () => {
    const enrollment = {
      id: 'enr-1',
      campaign_id: 'camp-1',
      status: 'active',
      enrollment_criteria: [],
      campaign_progress: [],
    }
    const single = vi.fn().mockResolvedValue({ data: enrollment, error: null })
    const eqCampaign = vi.fn().mockReturnValue({ single })
    const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'campaign_enrollments') throw new Error(`Unexpected table: ${table}`)
      return { select }
    })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: enrollment })
    expect(eqId).toHaveBeenCalledWith('id', 'enr-1')
    expect(eqCampaign).toHaveBeenCalledWith('campaign_id', 'camp-1')
  })

  it('returns 404 when the enrollment is missing for that campaign', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const eqCampaign = vi.fn().mockReturnValue({ single })
    const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params('camp-1', 'missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment not found' })
  })

  it('returns a generic 500 when the database lookup fails', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'boom' },
    })
    const eqCampaign = vi.fn().mockReturnValue({ single })
    const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
    const select = vi.fn().mockReturnValue({ eq: eqId })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch enrollment',
    })
  })
})
