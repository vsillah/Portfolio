import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/proposals/${id}/onboarding-plan`)
}

describe('GET /api/proposals/[id]/onboarding-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns a null plan when no client project is linked', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      onboarding_plan_id: null,
      message: 'No client project found for this proposal',
    })
  })

  it('returns the linked client project and onboarding plan ids', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'proj-9', onboarding_plan_id: 'plan-3' },
              error: null,
            }),
        }),
      }),
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      client_project_id: 'proj-9',
      onboarding_plan_id: 'plan-3',
    })
  })

  it('returns 500 when the lookup throws', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('db down')
    })

    const response = await GET(makeRequest('prop-1'), {
      params: Promise.resolve({ id: 'prop-1' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      onboarding_plan_id: null,
      error: 'db down',
    })
  })
})
