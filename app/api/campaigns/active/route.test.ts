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

function activeQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result)
  const endsOr = vi.fn().mockReturnValue({ order })
  const startsOr = vi.fn().mockReturnValue({ or: endsOr })
  const statusEq = vi.fn().mockReturnValue({ or: startsOr })
  const select = vi.fn().mockReturnValue({ eq: statusEq })
  mocks.from.mockReturnValue({ select })
  return { select, statusEq, startsOr, endsOr, order }
}

describe('GET /api/campaigns/active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns currently active campaigns', async () => {
    const campaigns = [{ id: 'camp-1', name: 'Spring', status: 'active' }]
    const query = activeQuery({ data: campaigns, error: null })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: campaigns })
    expect(mocks.from).toHaveBeenCalledWith('attraction_campaigns')
    expect(query.statusEq).toHaveBeenCalledWith('status', 'active')
    expect(query.startsOr).toHaveBeenCalledWith(expect.stringMatching(/^starts_at\.is\.null,starts_at\.lte\./))
    expect(query.endsOr).toHaveBeenCalledWith(expect.stringMatching(/^ends_at\.is\.null,ends_at\.gte\./))
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns an empty list when the campaigns table is missing', async () => {
    activeQuery({ data: null, error: { code: '42P01', message: 'undefined_table' } })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [] })
  })

  it('returns a generic 500 for other lookup failures', async () => {
    activeQuery({ data: null, error: { code: '42501', message: 'permission denied' } })

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch active campaigns' })
  })
})
