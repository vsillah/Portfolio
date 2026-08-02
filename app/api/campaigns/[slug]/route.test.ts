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

function makeGetRequest(slug = 'spring-attraction') {
  return new NextRequest(`http://localhost/api/campaigns/${slug}`)
}

function params(slug = 'spring-attraction') {
  return { params: { slug } }
}

describe('GET /api/campaigns/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only active campaigns for the requested slug', async () => {
    const campaign = {
      id: 'camp-1',
      slug: 'spring-attraction',
      status: 'active',
      name: 'Spring Attraction',
    }
    const single = vi.fn().mockResolvedValue({ data: campaign, error: null })
    const statusEq = vi.fn().mockReturnValue({ single })
    const slugEq = vi.fn().mockReturnValue({ eq: statusEq })
    const select = vi.fn().mockReturnValue({ eq: slugEq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: campaign })
    expect(slugEq).toHaveBeenCalledWith('slug', 'spring-attraction')
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
  })

  it('returns 404 when the slug is missing or not active', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const statusEq = vi.fn().mockReturnValue({ single })
    const slugEq = vi.fn().mockReturnValue({ eq: statusEq })
    const select = vi.fn().mockReturnValue({ eq: slugEq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest('draft-only'), params('draft-only'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Campaign not found' })
  })

  it('returns a generic 500 when the campaign lookup fails', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'boom' },
    })
    const statusEq = vi.fn().mockReturnValue({ single })
    const slugEq = vi.fn().mockReturnValue({ eq: statusEq })
    const select = vi.fn().mockReturnValue({ eq: slugEq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch campaign',
    })
  })
})
