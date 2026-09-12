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

function makeRequest(slug: string) {
  return new NextRequest(`http://localhost/api/campaigns/${slug}`)
}

describe('GET /api/campaigns/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 404 when the campaign is missing or inactive', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'not found' },
            }),
          }),
        }),
      }),
    })

    const response = await GET(makeRequest('summer-sprint'), { params: { slug: 'summer-sprint' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Campaign not found' })
    expect(mocks.from).toHaveBeenCalledWith('attraction_campaigns')
  })

  it('returns the active campaign payload', async () => {
    const campaign = { id: 'camp-1', slug: 'summer-sprint', status: 'active', name: 'Summer Sprint' }
    const statusEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: campaign, error: null }),
    })
    const slugEq = vi.fn().mockReturnValue({ eq: statusEq })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: slugEq }),
    })

    const response = await GET(makeRequest('summer-sprint'), { params: { slug: 'summer-sprint' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: campaign })
    expect(slugEq).toHaveBeenCalledWith('slug', 'summer-sprint')
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
  })

  it('returns 500 for unexpected query errors', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'XX000', message: 'boom' },
            }),
          }),
        }),
      }),
    })

    const response = await GET(makeRequest('summer-sprint'), { params: { slug: 'summer-sprint' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch campaign' })
  })
})
