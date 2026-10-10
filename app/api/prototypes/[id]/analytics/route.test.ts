import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
  isAdmin: mocks.isAdmin,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function params(id = 'proto-1') {
  return { params: { id } }
}

function makeRequest(id = 'proto-1', days?: string) {
  const url = new URL(`http://localhost/api/prototypes/${id}/analytics`)
  if (days !== undefined) url.searchParams.set('days', days)
  return new NextRequest(url)
}

const analyticsRows = [
  { metric_date: '2026-09-10', metric_type: 'views', metric_value: '10' },
  { metric_date: '2026-09-11', metric_type: 'views', metric_value: '30' },
  { metric_date: '2026-09-11', metric_type: 'signups', metric_value: '4' },
]

function mockPrototypeAndAnalytics(stage: string | null, rows = analyticsRows) {
  const prototypeSingle = vi.fn().mockResolvedValue({
    data: stage ? { production_stage: stage } : null,
    error: stage ? null : { code: 'PGRST116' },
  })
  const analyticsOrder = vi.fn().mockResolvedValue({ data: rows, error: null })
  const analyticsGte = vi.fn().mockReturnValue({ order: analyticsOrder })
  const analyticsEq = vi.fn().mockReturnValue({ gte: analyticsGte })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'app_prototypes') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: prototypeSingle }),
        }),
      }
    }
    if (table === 'prototype_analytics') {
      return {
        select: vi.fn().mockReturnValue({ eq: analyticsEq }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
  return { analyticsEq, analyticsGte, analyticsOrder }
}

describe('GET /api/prototypes/[id]/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue(null)
    mocks.isAdmin.mockResolvedValue(false)
  })

  it('returns 404 when the prototype is missing', async () => {
    mockPrototypeAndAnalytics(null)

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Prototype not found' })
  })

  it('forbids anonymous access to non-production analytics', async () => {
    mockPrototypeAndAnalytics('Pilot')

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Analytics only available for production prototypes',
    })
  })

  it('forbids signed-in non-admins on non-production analytics', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.isAdmin.mockResolvedValue(false)
    mockPrototypeAndAnalytics('Pilot')

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Analytics only available for production prototypes',
    })
  })

  it('returns aggregated production analytics without raw rows for the public', async () => {
    const { analyticsEq, analyticsGte } = mockPrototypeAndAnalytics('Production')

    const response = await GET(makeRequest('proto-1', '7'), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.raw).toBeUndefined()
    expect(body.daily).toEqual({
      '2026-09-10': { views: 10 },
      '2026-09-11': { views: 30, signups: 4 },
    })
    expect(body.aggregated.views).toEqual({
      total: 40,
      average: 20,
      max: 30,
      min: 10,
      count: 2,
    })
    expect(body.aggregated.signups).toEqual({
      total: 4,
      average: 4,
      max: 4,
      min: 4,
      count: 1,
    })
    expect(analyticsEq).toHaveBeenCalledWith('prototype_id', 'proto-1')
    expect(analyticsGte).toHaveBeenCalledWith('metric_date', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('includes raw rows for admins, including non-production prototypes', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mocks.isAdmin.mockResolvedValue(true)
    mockPrototypeAndAnalytics('Pilot')

    const response = await GET(makeRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.raw).toEqual(analyticsRows)
    expect(body.aggregated.views.total).toBe(40)
  })
})
