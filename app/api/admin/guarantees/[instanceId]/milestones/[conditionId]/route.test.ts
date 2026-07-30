import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import { PUT } from './route'

function makeRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/admin/guarantees/gi-1/milestones/cond-1',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(instanceId = 'gi-1', conditionId = 'cond-1') {
  return { params: { instanceId, conditionId } }
}

describe('PUT /api/admin/guarantees/[instanceId]/milestones/[conditionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects non-admin callers before database access', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(makeRequest({ status: 'met' }), params())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid milestone status', async () => {
    const response = await PUT(makeRequest({ status: 'pending' }), params())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid status. Must be one of: met, not_met, waived',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the guarantee instance is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PUT(makeRequest({ status: 'met' }), params())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Guarantee instance not found' })
  })

  it('blocks milestone updates when the guarantee is not active', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'gi-1', status: 'expired' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PUT(makeRequest({ status: 'met' }), params())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Cannot update milestones on a guarantee with status: expired',
    })
  })

  it('updates a milestone and auto-advances when all conditions are met or waived', async () => {
    const milestoneUpdatePayloads: Record<string, unknown>[] = []
    const instanceUpdates: Record<string, unknown>[] = []
    const milestoneSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'ms-1',
        condition_id: 'cond-1',
        status: 'met',
        verified_by: 'admin-1',
      },
      error: null,
    })
    const milestoneSelectAfterUpdate = vi.fn().mockReturnValue({ single: milestoneSingle })
    const milestoneEqCondition = vi.fn().mockReturnValue({ select: milestoneSelectAfterUpdate })
    const milestoneEqInstance = vi.fn().mockReturnValue({ eq: milestoneEqCondition })
    const milestoneUpdate = vi.fn((payload: Record<string, unknown>) => {
      milestoneUpdatePayloads.push(payload)
      return { eq: milestoneEqInstance }
    })
    const allMilestonesEq = vi.fn().mockResolvedValue({
      data: [{ status: 'met' }, { status: 'waived' }],
      error: null,
    })
    const allMilestonesSelect = vi.fn().mockReturnValue({ eq: allMilestonesEq })
    const instanceStatusEq = vi.fn().mockResolvedValue({ error: null })
    const instanceIdEq = vi.fn().mockReturnValue({ eq: instanceStatusEq })
    const instanceUpdate = vi.fn((payload: Record<string, unknown>) => {
      instanceUpdates.push(payload)
      return { eq: instanceIdEq }
    })
    let instanceFromCalls = 0
    let milestoneFromCalls = 0

    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        instanceFromCalls += 1
        if (instanceFromCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'gi-1', status: 'active' },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { update: instanceUpdate }
      }
      if (table === 'guarantee_milestones') {
        milestoneFromCalls += 1
        if (milestoneFromCalls === 1) {
          return { update: milestoneUpdate }
        }
        return { select: allMilestonesSelect }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PUT(
      makeRequest({ status: 'met', admin_notes: 'Verified in call' }),
      params(),
    )

    expect(milestoneUpdatePayloads[0]).toMatchObject({
      status: 'met',
      verified_by: 'admin-1',
      admin_notes: 'Verified in call',
      verified_at: expect.any(String),
    })
    expect(instanceUpdates).toEqual([{ status: 'conditions_met' }])
    expect(instanceIdEq).toHaveBeenCalledWith('id', 'gi-1')
    expect(instanceStatusEq).toHaveBeenCalledWith('status', 'active')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      milestone: {
        id: 'ms-1',
        condition_id: 'cond-1',
        status: 'met',
        verified_by: 'admin-1',
      },
      all_conditions_met: true,
    })
  })

  it('returns 404 when the milestone row is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'gi-1', status: 'active' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'guarantee_milestones') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'not found' },
                  }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await PUT(makeRequest({ status: 'waived' }), params())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Milestone not found' })
  })
})
