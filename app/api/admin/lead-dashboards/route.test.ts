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

describe('GET /api/admin/lead-dashboards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(new NextRequest('http://localhost/api/admin/lead-dashboards'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists only dashboards without a client project and builds token URLs from origin', async () => {
    const is = vi.fn()
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('client_dashboard_access')
      return {
        select: () => ({
          is: (field: string, value: unknown) => {
            is(field, value)
            return {
              order: vi.fn().mockResolvedValue({
                data: [{
                  id: 'dash-1',
                  diagnostic_audit_id: 9,
                  client_email: 'lead@example.com',
                  access_token: 'token-abc',
                  created_at: '2026-09-01T00:00:00Z',
                  last_accessed_at: null,
                }],
                error: null,
              }),
            }
          },
        }),
      }
    })

    const response = await GET(new NextRequest('http://localhost/api/admin/lead-dashboards', {
      headers: { origin: 'https://preview.example' },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(is).toHaveBeenCalledWith('client_project_id', null)
    expect(body).toEqual([{
      id: 'dash-1',
      diagnostic_audit_id: 9,
      client_email: 'lead@example.com',
      access_token: 'token-abc',
      created_at: '2026-09-01T00:00:00Z',
      last_accessed_at: null,
      url: 'https://preview.example/client/dashboard/token-abc',
    }])
  })

  it('falls back to the request origin when the Origin header is omitted', async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        is: () => ({
          order: vi.fn().mockResolvedValue({
            data: [{
              id: 'dash-2',
              diagnostic_audit_id: null,
              client_email: 'other@example.com',
              access_token: 'token-def',
              created_at: '2026-09-02T00:00:00Z',
              last_accessed_at: '2026-09-03T00:00:00Z',
            }],
            error: null,
          }),
        }),
      }),
    })

    const response = await GET(new NextRequest('http://localhost:3000/api/admin/lead-dashboards'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].url).toBe('http://localhost:3000/client/dashboard/token-def')
  })
})
