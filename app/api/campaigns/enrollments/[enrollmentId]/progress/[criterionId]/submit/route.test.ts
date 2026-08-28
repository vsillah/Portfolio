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
  supabaseAdmin: { from: mocks.from },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/campaigns/enrollments/enr-1/progress/crit-1/submit',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(enrollmentId = 'enr-1', criterionId = 'crit-1') {
  return { params: { enrollmentId, criterionId } }
}

describe('POST /api/campaigns/enrollments/[enrollmentId]/progress/[criterionId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated submissions before reading enrollments', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached' }),
      params(),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires non-empty evidence', async () => {
    const response = await POST(makeRequest({ client_evidence: '   ' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Evidence is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('hides enrollments that belong to another user', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'enr-1', user_id: 'other-user', status: 'active' },
            error: null,
          }),
        }),
      }),
    })

    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached' }),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment not found' })
  })

  it('rejects submissions when the enrollment is not active', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'enr-1', user_id: 'user-1', status: 'completed' },
            error: null,
          }),
        }),
      }),
    })

    const response = await POST(
      makeRequest({ client_evidence: 'Screenshot attached' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment is not active' })
  })

  it('writes trimmed evidence against the enrollment and criterion', async () => {
    const updated = { id: 'prog-1', status: 'in_progress' }
    const updateSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
    const eqCriterion = vi.fn().mockReturnValue({ select: updateSelect })
    const eqEnrollment = vi.fn().mockReturnValue({ eq: eqCriterion })
    const update = vi.fn().mockReturnValue({ eq: eqEnrollment })

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
        return { update }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ client_evidence: '  Screenshot attached  ', current_value: 3 }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: updated })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        client_evidence: 'Screenshot attached',
        current_value: 3,
        status: 'in_progress',
        client_submitted_at: expect.any(String),
      }),
    )
    expect(eqEnrollment).toHaveBeenCalledWith('enrollment_id', 'enr-1')
    expect(eqCriterion).toHaveBeenCalledWith('criterion_id', 'crit-1')
  })
})
