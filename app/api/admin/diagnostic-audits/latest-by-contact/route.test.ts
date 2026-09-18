import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/diagnostic-audits/latest-by-contact${query}`)
}

describe('GET /api/admin/diagnostic-audits/latest-by-contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(request('?contact_submission_id=12'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each(['', '?contact_submission_id=', '?contact_submission_id=abc', '?contact_submission_id=12.5'])(
    'rejects a missing or non-integer contact id (%s)',
    async (query) => {
      const response = await GET(request(query))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'contact_submission_id is required and must be a number',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    },
  )

  it('returns auditId null when no audit exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn()
    mocks.from.mockReturnValue({
      select: () => ({
        eq: (field: string, value: unknown) => {
          eq(field, value)
          return {
            order: () => ({
              order: () => ({
                limit: () => ({ maybeSingle }),
              }),
            }),
          }
        },
      }),
    })

    const response = await GET(request('?contact_submission_id=42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ auditId: null })
    expect(eq).toHaveBeenCalledWith('contact_submission_id', 42)
  })

  it('returns the latest audit id for the contact', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 88 }, error: null }),
              }),
            }),
          }),
        }),
      }),
    })

    const response = await GET(request('?contact_submission_id=42'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ auditId: 88 })
  })
})
