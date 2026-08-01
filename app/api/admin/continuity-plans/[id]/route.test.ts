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

import { DELETE, GET, PUT } from './route'

type ContinuityPlanRow = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  amount_per_interval: number
}

function makeGetRequest(id = 'plan-1') {
  return new NextRequest(`http://localhost/api/admin/continuity-plans/${id}`, {
    method: 'GET',
  })
}

function makePutRequest(body: Record<string, unknown>, id = 'plan-1') {
  return new NextRequest(`http://localhost/api/admin/continuity-plans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'plan-1') {
  return new NextRequest(`http://localhost/api/admin/continuity-plans/${id}`, {
    method: 'DELETE',
  })
}

function params(id = 'plan-1') {
  return { params: { id } }
}

function planRow(overrides: Partial<ContinuityPlanRow> = {}): ContinuityPlanRow {
  return {
    id: 'plan-1',
    name: 'Monthly Continuity',
    description: 'Support plan',
    is_active: true,
    amount_per_interval: 250,
    ...overrides,
  }
}

function mockSelectPlan({
  plan,
  error = null as { code?: string; message?: string } | null,
}: {
  plan: ContinuityPlanRow | null
  error?: { code?: string; message?: string } | null
}) {
  const single = vi.fn().mockResolvedValue({
    data: plan,
    error: plan ? null : error ?? { code: 'PGRST116', message: 'not found' },
  })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'continuity_plans') throw new Error(`Unexpected table: ${table}`)
    return { select }
  })
  return { select, eq, single }
}

function mockUpdatePlan({
  updated,
  error = null as { code?: string; message?: string } | null,
}: {
  updated: ContinuityPlanRow | null
  error?: { code?: string; message?: string } | null
}) {
  const single = vi.fn().mockResolvedValue({
    data: updated,
    error: updated ? null : error ?? { code: 'PGRST116', message: 'not found' },
  })
  const select = vi.fn().mockReturnValue({ single })
  const eq = vi.fn().mockReturnValue({ select })
  const update = vi.fn().mockReturnValue({ eq })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'continuity_plans') throw new Error(`Unexpected table: ${table}`)
    return { update }
  })
  return { update, eq, select, single }
}

describe('/api/admin/continuity-plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('rejects unauthenticated requests before reading plans', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeGetRequest(), params())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 404 when the plan is missing', async () => {
      mockSelectPlan({ plan: null })

      const response = await GET(makeGetRequest(), params())

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: 'Plan not found' })
    })

    it('returns the plan when found', async () => {
      const plan = planRow()
      const { eq } = mockSelectPlan({ plan })

      const response = await GET(makeGetRequest(), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(plan)
      expect(eq).toHaveBeenCalledWith('id', 'plan-1')
    })
  })

  describe('PUT', () => {
    it('rejects unauthenticated requests before updating', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await PUT(makePutRequest({ name: 'Updated' }), params())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('trims name/description and persists only provided fields', async () => {
      const updated = planRow({ name: 'Updated Plan', description: 'Trimmed', is_active: false })
      const { update, eq } = mockUpdatePlan({ updated })

      const response = await PUT(
        makePutRequest({
          name: '  Updated Plan  ',
          description: '  Trimmed  ',
          is_active: false,
        }),
        params(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(updated)
      expect(update).toHaveBeenCalledWith({
        name: 'Updated Plan',
        description: 'Trimmed',
        is_active: false,
      })
      expect(eq).toHaveBeenCalledWith('id', 'plan-1')
    })

    it('returns 404 when updating a missing plan', async () => {
      mockUpdatePlan({ updated: null })

      const response = await PUT(makePutRequest({ name: 'Gone' }), params())

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: 'Plan not found' })
    })
  })

  describe('DELETE', () => {
    it('rejects unauthenticated requests before soft-deleting', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await DELETE(makeDeleteRequest(), params())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('soft-deletes by setting is_active false', async () => {
      const deactivated = planRow({ is_active: false })
      const { update, eq } = mockUpdatePlan({ updated: deactivated })

      const response = await DELETE(makeDeleteRequest(), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ success: true, data: deactivated })
      expect(update).toHaveBeenCalledWith({ is_active: false })
      expect(eq).toHaveBeenCalledWith('id', 'plan-1')
    })

    it('returns 404 when soft-deleting a missing plan', async () => {
      mockUpdatePlan({ updated: null })

      const response = await DELETE(makeDeleteRequest(), params())

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: 'Plan not found' })
    })
  })
})
