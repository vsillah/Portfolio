import { beforeEach, describe, expect, it, vi } from 'vitest'

const recommendationQuery = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: recommendationQuery.from,
  },
}))

import { getRecommendationsForDashboard } from './acceleration-engine'

describe('getRecommendationsForDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recommendationQuery.from.mockReturnValue(recommendationQuery)
    recommendationQuery.select.mockReturnValue(recommendationQuery)
    recommendationQuery.eq.mockReturnValue(recommendationQuery)
    recommendationQuery.is.mockReturnValue(recommendationQuery)
    recommendationQuery.order.mockResolvedValue({ data: [] })
  })

  it('excludes recommendations that have already been dismissed or converted', async () => {
    await getRecommendationsForDashboard('client-project-1')

    expect(recommendationQuery.from).toHaveBeenCalledWith('acceleration_recommendations')
    expect(recommendationQuery.is).toHaveBeenCalledWith('dismissed_at', null)
    expect(recommendationQuery.is).toHaveBeenCalledWith('converted_at', null)
  })
})
