import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET, PATCH } from './route'

function request(method: 'GET' | 'PATCH', authHeader: string | null, body?: unknown) {
  return new NextRequest('http://localhost/api/user/profile', {
    method,
    headers: {
      ...(authHeader ? { authorization: authHeader } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function profileGetQuery(result: { data: unknown; error: { code?: string; message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

function profilePatchQuery(result: { data: unknown; error: { message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ single })
  const eq = vi.fn().mockReturnValue({ select })
  const update = vi.fn().mockReturnValue({ eq })
  return { update, eq, select, single }
}

describe('/api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('returns 401 when the bearer token is missing or invalid', async () => {
      const missing = await GET(request('GET', null))
      expect(missing.status).toBe(401)
      expect(await missing.json()).toEqual({ error: 'Unauthorized' })
      expect(mocks.createClient).not.toHaveBeenCalled()

      mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } })
      const invalid = await GET(request('GET', 'Bearer bad-token'))
      expect(invalid.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns profile null when the user has no profile row yet', async () => {
      mocks.from.mockReturnValue(
        profileGetQuery({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
      )

      const response = await GET(request('GET', 'Bearer user-token'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ profile: null })
    })

    it('returns the caller profile with no-store cache headers', async () => {
      const query = profileGetQuery({
        data: { id: 'user-1', email: 'a@example.com', role: 'client' },
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const response = await GET(request('GET', 'Bearer user-token'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        profile: { id: 'user-1', email: 'a@example.com', role: 'client' },
      })
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(query.eq).toHaveBeenCalledWith('id', 'user-1')
    })
  })

  describe('PATCH', () => {
    it('returns 401 without a valid session', async () => {
      const missing = await PATCH(request('PATCH', null, { full_name: 'Ada' }))
      expect(missing.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 400 when no allowlisted fields are present', async () => {
      const response = await PATCH(request('PATCH', 'Bearer user-token', { role: 'admin' }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'No valid fields to update' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('drops incomplete shipping addresses and extra keys, then updates only the caller row', async () => {
      const query = profilePatchQuery({
        data: { id: 'user-1', shipping_address: null },
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const incomplete = await PATCH(
        request('PATCH', 'Bearer user-token', {
          shipping_address: { address1: '1 Main', extra: 'drop-me' },
        }),
      )
      expect(incomplete.status).toBe(200)
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ shipping_address: null }),
      )
      expect(query.eq).toHaveBeenCalledWith('id', 'user-1')
    })

    it('persists a complete shipping address using only the allowlisted shape', async () => {
      const query = profilePatchQuery({
        data: { id: 'user-1' },
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const response = await PATCH(
        request('PATCH', 'Bearer user-token', {
          full_name: 'Ada Lovelace',
          shipping_address: {
            address1: '1 Main St',
            city: 'Austin',
            state_code: 'TX',
            zip: '78701',
            country_code: 'US',
            phone: '555-0100',
            role: 'admin',
          },
        }),
      )

      expect(response.status).toBe(200)
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Ada Lovelace',
          shipping_address: {
            address1: '1 Main St',
            city: 'Austin',
            state_code: 'TX',
            zip: '78701',
            country_code: 'US',
            phone: '555-0100',
          },
        }),
      )
      const written = query.update.mock.calls[0][0].shipping_address
      expect(written).not.toHaveProperty('role')
    })
  })
})
