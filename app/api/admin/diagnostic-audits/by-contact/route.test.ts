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
  return new NextRequest(`http://localhost/api/admin/diagnostic-audits/by-contact${query}`)
}

describe('GET /api/admin/diagnostic-audits/by-contact', () => {
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

  it('rejects a non-numeric contact id', async () => {
    const response = await GET(request('?contact_submission_id=lead-12'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_id is required and must be a number',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists audits for the numeric contact id and caps at 50', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 1, status: 'completed', audit_type: 'meeting' }],
      error: null,
    })
    const eq = vi.fn()
    mocks.from.mockReturnValue({
      select: () => ({
        eq: (field: string, value: unknown) => {
          eq(field, value)
          return {
            order: () => ({
              order: () => ({ limit }),
            }),
          }
        },
      }),
    })

    const response = await GET(request('?contact_submission_id=12'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      audits: [{ id: 1, status: 'completed', audit_type: 'meeting' }],
    })
    expect(eq).toHaveBeenCalledWith('contact_submission_id', 12)
    expect(limit).toHaveBeenCalledWith(50)
  })

  it('returns an empty audits list when the query has no rows', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              limit: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })

    const response = await GET(request('?contact_submission_id=12'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ audits: [] })
  })
})
