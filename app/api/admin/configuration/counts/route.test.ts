// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
})

describe('GET /api/admin/configuration/counts', () => {
  it('requires admin before counting configuration rows', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    const response = await GET(new NextRequest('http://localhost/api/admin/configuration/counts'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('treats a missing count as zero and sums products with services', async () => {
    const selects: Array<{ table: string; args: unknown[] }> = []
    const counts: Record<string, { count: number | null; error: { message: string } | null }> = {
      user_profiles: { count: null, error: { message: 'users unavailable' } },
      system_prompts: { count: 4, error: null },
      products: { count: 2, error: null },
      services: { count: 3, error: null },
    }
    mocks.from.mockImplementation((table: string) => ({
      select: (...args: unknown[]) => {
        selects.push({ table, args })
        return Promise.resolve(counts[table])
      },
    }))
    const response = await GET(new NextRequest('http://localhost/api/admin/configuration/counts'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      users: 0,
      prompts: 4,
      contentItems: 5,
      products: 2,
      services: 3,
    })
    expect(selects.map((entry) => entry.table)).toEqual(['user_profiles', 'system_prompts', 'products', 'services'])
    for (const entry of selects) {
      expect(entry.args).toEqual(['*', { count: 'exact', head: true }])
    }
  })

  it('hides unexpected failures behind a generic error', async () => {
    mocks.from.mockImplementation(() => ({
      select: () => { throw new Error('private count failure') },
    }))
    const response = await GET(new NextRequest('http://localhost/api/admin/configuration/counts'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})
