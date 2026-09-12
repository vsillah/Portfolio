import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  authResult: { user: { id: 'user-1' }, isAdmin: false } as Record<string, unknown>,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: vi.fn(async () => mocks.authResult),
  isAuthError: (result: { error?: string }) => 'error' in result,
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

function params(enrollmentId = 'enr-1') {
  return { params: { enrollmentId } }
}

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('POST /api/campaigns/enrollments/[enrollmentId]/choose-payout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.authResult = { user: { id: 'user-1' }, isAdmin: false }
  })

  it('rejects unauthenticated requests before loading the enrollment', async () => {
    mocks.authResult = { error: 'Authentication required', status: 401 }

    const response = await POST(makeRequest({ payout_type: 'refund' }), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing or invalid payout_type', async () => {
    const missing = await POST(makeRequest({}), params())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Valid payout type is required' })

    const invalid = await POST(makeRequest({ payout_type: 'cash' }), params())
    expect(invalid.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the enrollment is missing or owned by another user', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: 'missing' } }))
    const missing = await POST(makeRequest({ payout_type: 'refund' }), params())
    expect(missing.status).toBe(404)

    mocks.from.mockReturnValue(
      chain({
        data: { id: 'enr-1', user_id: 'other-user', status: 'criteria_met', campaign_id: 'camp-1' },
        error: null,
      }),
    )
    const foreign = await POST(makeRequest({ payout_type: 'refund' }), params())
    expect(foreign.status).toBe(404)
    await expect(foreign.json()).resolves.toEqual({ error: 'Enrollment not found' })
  })

  it('rejects payout choice until enrollment status is criteria_met', async () => {
    mocks.from.mockReturnValue(
      chain({
        data: { id: 'enr-1', user_id: 'user-1', status: 'in_progress', campaign_id: 'camp-1' },
        error: null,
      }),
    )

    const response = await POST(makeRequest({ payout_type: 'credit' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Enrollment must have all criteria met before choosing payout',
    })
  })

  it('marks the enrollment payout_pending without processing money', async () => {
    const lookup = chain({
      data: { id: 'enr-1', user_id: 'user-1', status: 'criteria_met', campaign_id: 'camp-1' },
      error: null,
    })
    const updated = {
      id: 'enr-1',
      status: 'payout_pending',
      resolution_notes: 'Client chose payout type: rollover_upsell',
    }
    const update = chain({ data: updated, error: null })
    let calls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'campaign_enrollments') {
        throw new Error(`Unexpected table: ${table}`)
      }
      calls += 1
      return calls === 1 ? lookup : update
    })

    const response = await POST(
      makeRequest({ payout_type: 'rollover_upsell' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: updated })
    expect(update.update).toHaveBeenCalledWith({
      status: 'payout_pending',
      resolution_notes: 'Client chose payout type: rollover_upsell',
    })
    expect(update.eq).toHaveBeenCalledWith('id', 'enr-1')
  })
})
