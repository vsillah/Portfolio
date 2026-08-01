import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  areAllCriteriaMet: vi.fn(),
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

vi.mock('@/lib/campaigns', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campaigns')>('@/lib/campaigns')
  return {
    ...actual,
    areAllCriteriaMet: mocks.areAllCriteriaMet,
  }
})

import { PUT } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/admin/campaigns/camp-1/enrollments/enr-1/progress/crit-1',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(
  id = 'camp-1',
  enrollmentId = 'enr-1',
  criterionId = 'crit-1',
) {
  return { params: { id, enrollmentId, criterionId } }
}

function mockProgressUpdate({
  progress,
  allProgress = [{ status: 'met' }],
  allCriteria = [{ required: true }],
  allMet = false,
}: {
  progress: Record<string, unknown>
  allProgress?: { status: string }[]
  allCriteria?: { required: boolean }[]
  allMet?: boolean
}) {
  const progressSingle = vi.fn().mockResolvedValue({ data: progress, error: null })
  const progressSelect = vi.fn().mockReturnValue({ single: progressSingle })
  const progressEqCriterion = vi.fn().mockReturnValue({ select: progressSelect })
  const progressEqEnrollment = vi.fn().mockReturnValue({ eq: progressEqCriterion })
  const progressUpdate = vi.fn().mockReturnValue({ eq: progressEqEnrollment })

  const allProgressEq = vi.fn().mockResolvedValue({ data: allProgress, error: null })
  const allProgressSelect = vi.fn().mockReturnValue({ eq: allProgressEq })

  const criteriaOrder = vi.fn().mockResolvedValue({ data: allCriteria, error: null })
  const criteriaEq = vi.fn().mockReturnValue({ order: criteriaOrder })
  const criteriaSelect = vi.fn().mockReturnValue({ eq: criteriaEq })

  const enrollmentUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const enrollmentUpdate = vi.fn().mockReturnValue({ eq: enrollmentUpdateEq })

  mocks.areAllCriteriaMet.mockReturnValue(allMet)

  let progressSelectCalls = 0
  mocks.from.mockImplementation((table: string) => {
    if (table === 'campaign_progress') {
      progressSelectCalls += 1
      if (progressSelectCalls === 1) {
        return { update: progressUpdate }
      }
      return { select: allProgressSelect }
    }
    if (table === 'enrollment_criteria') {
      return { select: criteriaSelect }
    }
    if (table === 'campaign_enrollments') {
      return { update: enrollmentUpdate }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    progressUpdate,
    progressEqEnrollment,
    progressEqCriterion,
    enrollmentUpdate,
    enrollmentUpdateEq,
  }
}

describe('PUT /api/admin/campaigns/[id]/enrollments/[enrollmentId]/progress/[criterionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-06-15T12:00:00.000Z')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before touching progress', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(makeRequest({ status: 'met' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid verification statuses', async () => {
    const response = await PUT(makeRequest({ status: 'pending' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Status must be met, not_met, or waived',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('persists verification fields and marks progress complete for met status', async () => {
    const progress = {
      id: 'prog-1',
      status: 'met',
      progress_value: 100,
      admin_verified_by: 'admin-1',
    }
    const { progressUpdate, progressEqEnrollment, progressEqCriterion, enrollmentUpdate } =
      mockProgressUpdate({ progress, allMet: false })

    const response = await PUT(
      makeRequest({
        status: 'met',
        admin_notes: 'Looks good',
        current_value: 3,
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: progress })
    expect(progressUpdate).toHaveBeenCalledWith({
      status: 'met',
      admin_notes: 'Looks good',
      current_value: 3,
      admin_verified_by: 'admin-1',
      admin_verified_at: '2026-06-15T12:00:00.000Z',
      progress_value: 100,
    })
    expect(progressEqEnrollment).toHaveBeenCalledWith('enrollment_id', 'enr-1')
    expect(progressEqCriterion).toHaveBeenCalledWith('criterion_id', 'crit-1')
    expect(enrollmentUpdate).not.toHaveBeenCalled()
  })

  it('advances enrollment to criteria_met when all required criteria are satisfied', async () => {
    const progress = { id: 'prog-1', status: 'waived', progress_value: 100 }
    const { progressUpdate, enrollmentUpdate, enrollmentUpdateEq } = mockProgressUpdate({
      progress,
      allProgress: [{ status: 'waived' }, { status: 'met' }],
      allCriteria: [{ required: true }, { required: true }],
      allMet: true,
    })

    const response = await PUT(makeRequest({ status: 'waived' }), params())

    expect(response.status).toBe(200)
    expect(progressUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'waived',
        progress_value: 100,
        admin_verified_by: 'admin-1',
      }),
    )
    expect(mocks.areAllCriteriaMet).toHaveBeenCalledWith(
      [{ status: 'waived' }, { status: 'met' }],
      [{ required: true }, { required: true }],
    )
    expect(enrollmentUpdate).toHaveBeenCalledWith({ status: 'criteria_met' })
    expect(enrollmentUpdateEq).toHaveBeenCalledWith('id', 'enr-1')
    await expect(response.json()).resolves.toEqual({ data: progress })
  })

  it('sets progress_value to 0 when status is not_met', async () => {
    const progress = { id: 'prog-1', status: 'not_met', progress_value: 0 }
    const { progressUpdate } = mockProgressUpdate({ progress, allMet: false })

    const response = await PUT(makeRequest({ status: 'not_met' }), params())

    expect(response.status).toBe(200)
    expect(progressUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'not_met',
        progress_value: 0,
      }),
    )
  })
})
