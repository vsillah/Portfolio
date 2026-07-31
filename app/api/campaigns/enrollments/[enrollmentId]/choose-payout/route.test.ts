import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
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
    'http://localhost/api/campaigns/enrollments/enr-1/choose-payout',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

describe('POST /api/campaigns/enrollments/[enrollmentId]/choose-payout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before loading the enrollment', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ payout_type: 'refund' }), {
      params: { enrollmentId: 'enr-1' },
    })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a valid payout type', async () => {
    const response = await POST(makeRequest({ payout_type: 'cash' }), {
      params: { enrollmentId: 'enr-1' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Valid payout type is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the enrollment belongs to another user', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'enr-1',
                  user_id: 'other-user',
                  status: 'criteria_met',
                  campaign_id: 'camp-1',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ payout_type: 'refund' }), {
      params: { enrollmentId: 'enr-1' },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment not found' })
  })

  it('blocks payout choice until all criteria are met', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'enr-1',
                  user_id: 'user-1',
                  status: 'active',
                  campaign_id: 'camp-1',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ payout_type: 'credit' }), {
      params: { enrollmentId: 'enr-1' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Enrollment must have all criteria met before choosing payout',
    })
  })

  it('marks the enrollment payout_pending with the chosen payout type', async () => {
    const updatePayloads: Record<string, unknown>[] = []
    const updated = {
      id: 'enr-1',
      status: 'payout_pending',
      resolution_notes: 'Client chose payout type: rollover_upsell',
    }

    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'enr-1',
                  user_id: 'user-1',
                  status: 'criteria_met',
                  campaign_id: 'camp-1',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayloads.push(payload)
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updated, error: null }),
                }),
              }),
            }
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ payout_type: 'rollover_upsell' }), {
      params: { enrollmentId: 'enr-1' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: updated })
    expect(updatePayloads[0]).toEqual({
      status: 'payout_pending',
      resolution_notes: 'Client chose payout type: rollover_upsell',
    })
  })
})
