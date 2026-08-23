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

import { PUT } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/admin/campaigns/camp-1/enrollments/enr-1/progress/crit-1',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

const params = {
  params: { id: 'camp-1', enrollmentId: 'enr-1', criterionId: 'crit-1' },
}

describe('PUT /api/admin/campaigns/[id]/enrollments/[enrollmentId]/progress/[criterionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(request({ status: 'met' }), params)

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects statuses outside met/not_met/waived', async () => {
    const response = await PUT(request({ status: 'in_progress' }), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Status must be met, not_met, or waived' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('promotes the enrollment to criteria_met when every required criterion is done', async () => {
    const updatedProgress = { id: 'prog-1', status: 'met', progress_value: 100 }
    const updateSingle = vi.fn().mockResolvedValue({ data: updatedProgress, error: null })
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
    const updateEqCriterion = vi.fn().mockReturnValue({ select: updateSelect })
    const updateEqEnrollment = vi.fn().mockReturnValue({ eq: updateEqCriterion })
    const update = vi.fn().mockReturnValue({ eq: updateEqEnrollment })

    const progressSelectEq = vi.fn().mockResolvedValue({
      data: [{ status: 'met' }, { status: 'waived' }],
      error: null,
    })
    const progressSelect = vi.fn().mockReturnValue({ eq: progressSelectEq })

    const criteriaOrder = vi.fn().mockResolvedValue({
      data: [{ required: true }, { required: true }],
      error: null,
    })
    const criteriaEq = vi.fn().mockReturnValue({ order: criteriaOrder })
    const criteriaSelect = vi.fn().mockReturnValue({ eq: criteriaEq })

    const enrollmentUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const enrollmentUpdate = vi.fn().mockReturnValue({ eq: enrollmentUpdateEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_progress') {
        return { update, select: progressSelect }
      }
      if (table === 'enrollment_criteria') {
        return { select: criteriaSelect }
      }
      if (table === 'campaign_enrollments') {
        return { update: enrollmentUpdate }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await PUT(request({ status: 'met', admin_notes: 'verified' }), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: updatedProgress })
    expect(enrollmentUpdate).toHaveBeenCalledWith({ status: 'criteria_met' })
    expect(enrollmentUpdateEq).toHaveBeenCalledWith('id', 'enr-1')
  })

  it('does not promote the enrollment when a required criterion is still pending', async () => {
    const updateSingle = vi.fn().mockResolvedValue({
      data: { id: 'prog-1', status: 'met', progress_value: 100 },
      error: null,
    })
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: updateSingle }),
        }),
      }),
    })
    const enrollmentUpdate = vi.fn()

    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_progress') {
        return {
          update,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ status: 'met' }, { status: 'pending' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'enrollment_criteria') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ required: true }, { required: true }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'campaign_enrollments') {
        return { update: enrollmentUpdate }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await PUT(request({ status: 'met' }), params)

    expect(response.status).toBe(200)
    expect(enrollmentUpdate).not.toHaveBeenCalled()
  })
})
