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
    'http://localhost/api/campaigns/enrollments/enr-1/progress/crit-1/submit',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

describe('POST /api/campaigns/enrollments/[enrollmentId]/progress/[criterionId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before loading the enrollment', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached' }),
      { params: { enrollmentId: 'enr-1', criterionId: 'crit-1' } },
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires non-empty evidence', async () => {
    const response = await POST(makeRequest({ client_evidence: '   ' }), {
      params: { enrollmentId: 'enr-1', criterionId: 'crit-1' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Evidence is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the enrollment is missing or owned by another user', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'enr-1', user_id: 'other-user', status: 'active' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached' }),
      { params: { enrollmentId: 'enr-1', criterionId: 'crit-1' } },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment not found' })
  })

  it('blocks evidence submission when the enrollment is not active', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'enr-1', user_id: 'user-1', status: 'criteria_met' },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached' }),
      { params: { enrollmentId: 'enr-1', criterionId: 'crit-1' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment is not active' })
  })

  it('persists trimmed evidence and marks progress in_progress', async () => {
    const updatePayloads: Record<string, unknown>[] = []
    const progressRow = {
      id: 'prog-1',
      enrollment_id: 'enr-1',
      criterion_id: 'crit-1',
      status: 'in_progress',
      client_evidence: 'Screenshot attached',
    }

    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'enr-1', user_id: 'user-1', status: 'active' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'campaign_progress') {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayloads.push(payload)
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: progressRow, error: null }),
                  }),
                }),
              }),
            }
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        client_evidence: '  Screenshot attached  ',
        current_value: '3',
      }),
      { params: { enrollmentId: 'enr-1', criterionId: 'crit-1' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: progressRow })
    expect(updatePayloads[0]).toMatchObject({
      client_evidence: 'Screenshot attached',
      current_value: '3',
      status: 'in_progress',
    })
    expect(typeof updatePayloads[0].client_submitted_at).toBe('string')
  })
})
