import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'
import { dedupePickLatest } from './audit-helpers'

describe('dedupePickLatest', () => {
  it('returns null for an empty list', () => {
    expect(dedupePickLatest([])).toBeNull()
  })

  it('keeps the newest completed_at when the same audit id appears twice', () => {
    const latest = dedupePickLatest([
      { id: 'a1', completed_at: '2026-01-01T00:00:00.000Z', business_name: 'Old', report_tier: 'lite', audit_type: 'standalone' },
      { id: 'a1', completed_at: '2026-08-01T00:00:00.000Z', business_name: 'New', report_tier: 'full', audit_type: 'standalone' },
      { id: 'a2', completed_at: '2026-07-01T00:00:00.000Z', business_name: 'Other', report_tier: 'lite', audit_type: 'chat' },
    ])

    expect(latest).toMatchObject({
      id: 'a1',
      completed_at: '2026-08-01T00:00:00.000Z',
      business_name: 'New',
    })
  })
})

describe('GET /api/user/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1', email: 'owner@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns auth error when the user is not signed in', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/user/audit'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns audit null when no completed audits exist', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'diagnostic_audits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'contact_submissions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(new NextRequest('http://localhost/api/user/audit'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ audit: null })
  })
})
