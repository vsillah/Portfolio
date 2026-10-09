import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createLeadDashboardAccess: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/client-dashboard', () => ({
  createLeadDashboardAccess: mocks.createLeadDashboardAccess,
}))

import { POST } from './route'

function postRequest(body: unknown, origin = 'https://amadutown.com') {
  return new NextRequest('http://localhost/api/admin/lead-dashboard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function mockAudit(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

describe('POST /api/admin/lead-dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(postRequest({ diagnostic_audit_id: 12 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createLeadDashboardAccess).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(postRequest('{'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when diagnostic_audit_id is missing or not numeric', async () => {
    const missing = await POST(postRequest({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'diagnostic_audit_id is required' })

    const invalid = await POST(postRequest({ diagnostic_audit_id: 'abc' }))
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ error: 'diagnostic_audit_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the diagnostic does not exist', async () => {
    mocks.from.mockReturnValue(mockAudit({ data: null, error: { message: 'not found' } }))

    const response = await POST(postRequest({ diagnostic_audit_id: '42' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Diagnostic not found' })
    expect(mocks.createLeadDashboardAccess).not.toHaveBeenCalled()
  })

  it('rejects diagnostics that are not completed', async () => {
    mocks.from.mockReturnValue(
      mockAudit({
        data: { id: 7, status: 'in_progress', contact_submission_id: 3 },
        error: null,
      }),
    )

    const response = await POST(postRequest({ diagnostic_audit_id: 7 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Diagnostic must be completed' })
    expect(mocks.createLeadDashboardAccess).not.toHaveBeenCalled()
  })

  it('rejects completed diagnostics that have no contact', async () => {
    mocks.from.mockReturnValue(
      mockAudit({
        data: { id: 8, status: 'completed', contact_submission_id: null },
        error: null,
      }),
    )

    const response = await POST(postRequest({ diagnostic_audit_id: 8 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Lead dashboard requires a contact (contact_submission_id)',
    })
    expect(mocks.createLeadDashboardAccess).not.toHaveBeenCalled()
  })

  it('rejects when the linked contact has no email', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'diagnostic_audits') {
        return mockAudit({
          data: { id: 9, status: 'completed', contact_submission_id: 55 },
          error: null,
        })
      }
      if (table === 'contact_submissions') {
        return mockAudit({ data: { email: null }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(postRequest({ diagnostic_audit_id: 9 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Contact email not found' })
    expect(mocks.createLeadDashboardAccess).not.toHaveBeenCalled()
  })

  it('creates access from a string audit id and builds the dashboard URL from origin', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'diagnostic_audits') {
        return mockAudit({
          data: { id: 12, status: 'completed', contact_submission_id: 77 },
          error: null,
        })
      }
      if (table === 'contact_submissions') {
        return mockAudit({ data: { email: 'lead@example.com' }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createLeadDashboardAccess.mockResolvedValue({
      access: { access_token: 'lead-token-1' },
    })

    const response = await POST(postRequest({ diagnostic_audit_id: '12' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      accessToken: 'lead-token-1',
      url: 'https://amadutown.com/client/dashboard/lead-token-1',
    })
    expect(mocks.createLeadDashboardAccess).toHaveBeenCalledWith(12, 'lead@example.com')
  })

  it('returns 500 when access creation fails', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'diagnostic_audits') {
        return mockAudit({
          data: { id: 12, status: 'completed', contact_submission_id: 77 },
          error: null,
        })
      }
      if (table === 'contact_submissions') {
        return mockAudit({ data: { email: 'lead@example.com' }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createLeadDashboardAccess.mockResolvedValue({
      access: null,
      error: 'insert failed',
    })

    const response = await POST(postRequest({ diagnostic_audit_id: 12 }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'insert failed' })
  })
})
