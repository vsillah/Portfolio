import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

describe('GET /api/campaigns/active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists only active campaigns within the open window', async () => {
    const campaigns = [
      { id: 'camp-1', name: 'Spring Attraction', status: 'active', slug: 'spring' },
    ]
    const order = vi.fn().mockResolvedValue({ data: campaigns, error: null })
    const endsOr = vi.fn().mockReturnValue({ order })
    const startsOr = vi.fn().mockReturnValue({ or: endsOr })
    const statusEq = vi.fn().mockReturnValue({ or: startsOr })
    const select = vi.fn().mockReturnValue({ eq: statusEq })
    mocks.from.mockReturnValue({ select })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: campaigns })
    expect(mocks.from).toHaveBeenCalledWith('attraction_campaigns')
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
    expect(startsOr).toHaveBeenCalledWith(expect.stringMatching(/^starts_at\.is\.null,starts_at\.lte\./))
    expect(endsOr).toHaveBeenCalledWith(expect.stringMatching(/^ends_at\.is\.null,ends_at\.gte\./))
  })

  it('returns an empty list when the campaigns table is missing', async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'missing table' },
    })
    const endsOr = vi.fn().mockReturnValue({ order })
    const startsOr = vi.fn().mockReturnValue({ or: endsOr })
    const statusEq = vi.fn().mockReturnValue({ or: startsOr })
    const select = vi.fn().mockReturnValue({ eq: statusEq })
    mocks.from.mockReturnValue({ select })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [] })
  })

  it('returns a generic 500 when the active listing fails', async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'boom' },
    })
    const endsOr = vi.fn().mockReturnValue({ order })
    const startsOr = vi.fn().mockReturnValue({ or: endsOr })
    const statusEq = vi.fn().mockReturnValue({ or: startsOr })
    const select = vi.fn().mockReturnValue({ eq: statusEq })
    mocks.from.mockReturnValue({ select })

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch active campaigns',
    })
  })
})
