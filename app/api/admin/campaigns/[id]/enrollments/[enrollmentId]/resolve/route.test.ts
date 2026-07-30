import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  getResolvedStatus: vi.fn(),
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

vi.mock('@/lib/guarantees', async () => {
  const actual = await vi.importActual<typeof import('@/lib/guarantees')>('@/lib/guarantees')
  return {
    ...actual,
    getResolvedStatus: mocks.getResolvedStatus,
  }
})

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(
    'http://localhost/api/admin/campaigns/camp-1/enrollments/enr-1/resolve',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(id = 'camp-1', enrollmentId = 'enr-1') {
  return { params: { id, enrollmentId } }
}

const baseEnrollment = {
  id: 'enr-1',
  campaign_id: 'camp-1',
  status: 'criteria_met',
  order_id: 'ord-1',
  client_email: 'client@example.com',
  client_name: 'Client Name',
  user_id: 'user-1',
  purchase_amount: 1500,
  enrolled_at: '2026-01-01T00:00:00.000Z',
  deadline_at: '2026-04-01T00:00:00.000Z',
  attraction_campaigns: {
    id: 'camp-1',
    name: 'Spring Attraction',
    payout_type: 'refund',
    payout_amount_type: 'fixed',
    payout_amount_value: 500,
    rollover_bonus_multiplier: 1,
  },
}

function mockEnrollmentLookup(enrollment: typeof baseEnrollment | null) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: enrollment,
    error: enrollment ? null : { message: 'not found' },
  })
  const eqCampaign = vi.fn().mockReturnValue({ single: selectSingle })
  const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
  const select = vi.fn().mockReturnValue({ eq: eqId })
  return { select }
}

function mockSuccessfulResolve({
  enrollment = baseEnrollment,
  payoutType = 'refund',
  guaranteeId = 'gi-1',
  insertError = null as { message: string } | null,
  terminalStatus = 'refund_issued',
} = {}) {
  const { select } = mockEnrollmentLookup(enrollment)
  const insertSingle = vi.fn().mockResolvedValue({
    data: insertError ? null : { id: guaranteeId },
    error: insertError,
  })
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updated = {
    id: enrollment.id,
    status: terminalStatus,
    guarantee_instance_id: insertError ? null : guaranteeId,
  }
  const updateSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.getResolvedStatus.mockReturnValue(
    payoutType === 'credit'
      ? 'credit_issued'
      : payoutType === 'rollover_upsell'
        ? 'rollover_upsell_applied'
        : payoutType === 'rollover_continuity'
          ? 'rollover_continuity_applied'
          : 'refund_issued',
  )

  mocks.from.mockImplementation((table: string) => {
    if (table === 'campaign_enrollments') {
      return { select, update }
    }
    if (table === 'guarantee_instances') {
      return { insert }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { insert, update }
}

describe('POST /api/admin/campaigns/[id]/enrollments/[enrollmentId]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before reading enrollments', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ payout_type: 'refund' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the enrollment is missing', async () => {
    const { select } = mockEnrollmentLookup(null)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') return { select }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ payout_type: 'refund' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enrollment not found' })
  })

  it('blocks resolve when enrollment status is not criteria_met or payout_pending', async () => {
    const { select } = mockEnrollmentLookup({
      ...baseEnrollment,
      status: 'enrolled',
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaign_enrollments') return { select }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({ payout_type: 'refund' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Cannot resolve enrollment with status "enrolled". Must be criteria_met or payout_pending.',
    })
  })

  it('resolves a criteria_met enrollment with refund payout and links guarantee instance', async () => {
    const { insert, update } = mockSuccessfulResolve({
      payoutType: 'refund',
      terminalStatus: 'refund_issued',
    })

    const response = await POST(
      makeRequest({ payout_type: 'refund', resolution_notes: 'Paid via Stripe' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'enr-1',
        status: 'refund_issued',
        guarantee_instance_id: 'gi-1',
      },
      guarantee_instance_id: 'gi-1',
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payout_type: 'refund',
        status: 'refund_issued',
        client_email: 'client@example.com',
        resolution_notes: expect.stringContaining('Spring Attraction'),
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'refund_issued',
        resolution_notes: 'Paid via Stripe',
        guarantee_instance_id: 'gi-1',
      }),
    )
  })

  it('maps rollover payout types to rollover_applied enrollment status', async () => {
    mockSuccessfulResolve({
      enrollment: {
        ...baseEnrollment,
        status: 'payout_pending',
        attraction_campaigns: {
          ...baseEnrollment.attraction_campaigns,
          payout_type: 'rollover_continuity',
        },
      },
      payoutType: 'rollover_continuity',
      terminalStatus: 'rollover_applied',
    })

    const response = await POST(makeRequest({ payout_type: 'rollover_continuity' }), params())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.status).toBe('rollover_applied')
    expect(body.guarantee_instance_id).toBe('gi-1')
  })

  it('still updates enrollment when guarantee instance insert fails', async () => {
    mockSuccessfulResolve({
      insertError: { message: 'guarantee_template_id required' },
      terminalStatus: 'credit_issued',
      payoutType: 'credit',
    })

    const response = await POST(makeRequest({ payout_type: 'credit' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'enr-1',
        status: 'credit_issued',
        guarantee_instance_id: null,
      },
      guarantee_instance_id: null,
    })
  })
})
