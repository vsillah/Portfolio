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

function request(token?: string) {
  const url = token
    ? `http://localhost/api/tools/roi/validate?token=${encodeURIComponent(token)}`
    : 'http://localhost/api/tools/roi/validate'
  return new NextRequest(url)
}

function magnetLookup(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eqActive = vi.fn().mockReturnValue({ maybeSingle })
  const eqToken = vi.fn().mockReturnValue({ eq: eqActive })
  const select = vi.fn().mockReturnValue({ eq: eqToken })
  return { select, eqToken, eqActive }
}

describe('GET /api/tools/roi/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects missing or too-short tokens before querying', async () => {
    const missing = await GET(request())
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'Invalid or missing token' })

    const short = await GET(request('short-token'))
    expect(short.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the private link is missing or inactive', async () => {
    mocks.from.mockReturnValue(magnetLookup({ data: null, error: null }))

    const response = await GET(request('private-link-token-ok'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Link invalid or expired' })
    expect(mocks.from).toHaveBeenCalledWith('lead_magnets')
  })

  it('returns 500 when the lookup fails', async () => {
    mocks.from.mockReturnValue(
      magnetLookup({ data: null, error: { message: 'db down' } }),
    )

    const response = await GET(request('private-link-token-ok'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Something went wrong' })
  })

  it('allows an active private-link token and exposes the magnet title', async () => {
    const lookup = magnetLookup({
      data: {
        id: 'lm-1',
        title: 'ROI Calculator',
        private_link_token: 'private-link-token-ok',
      },
      error: null,
    })
    mocks.from.mockReturnValue(lookup)

    const response = await GET(request('private-link-token-ok'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      allowed: true,
      contactName: 'ROI Calculator',
    })
    expect(lookup.eqToken).toHaveBeenCalledWith('private_link_token', 'private-link-token-ok')
    expect(lookup.eqActive).toHaveBeenCalledWith('is_active', true)
  })
})
