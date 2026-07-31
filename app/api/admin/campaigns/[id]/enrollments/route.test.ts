import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  materializeCriteria: vi.fn(),
  calculateDeadline: vi.fn(),
  isValidEnrollmentSource: vi.fn(),
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

vi.mock('@/lib/campaigns', async () => {
  const actual = await vi.importActual<typeof import('@/lib/campaigns')>('@/lib/campaigns')
  return {
    ...actual,
    materializeCriteria: mocks.materializeCriteria,
    calculateDeadline: mocks.calculateDeadline,
    isValidEnrollmentSource: mocks.isValidEnrollmentSource,
  }
})

import { GET, POST } from './route'

function makePost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/campaigns/camp-1/enrollments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGet(query = '') {
  return new NextRequest(
    `http://localhost/api/admin/campaigns/camp-1/enrollments${query}`,
    { method: 'GET' },
  )
}

describe('admin campaign enrollments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isValidEnrollmentSource.mockImplementation(
      (value: string) =>
        value === 'auto_purchase' ||
        value === 'admin_manual' ||
        value === 'sales_conversation',
    )
    mocks.calculateDeadline.mockReturnValue(new Date('2026-04-01T00:00:00.000Z'))
    mocks.materializeCriteria.mockReturnValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('GET /api/admin/campaigns/[id]/enrollments', () => {
    it('rejects unauthenticated requests before querying enrollments', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeGet(), { params: { id: 'camp-1' } })

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/admin/campaigns/[id]/enrollments', () => {
    it('rejects unauthenticated requests before validating the body', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await POST(makePost({ client_email: 'client@example.com' }), {
        params: { id: 'camp-1' },
      })

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('requires a client email', async () => {
      const response = await POST(makePost({ client_email: '  ' }), {
        params: { id: 'camp-1' },
      })

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Client email is required',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('rejects invalid enrollment sources', async () => {
      mocks.isValidEnrollmentSource.mockReturnValue(false)

      const response = await POST(
        makePost({
          client_email: 'client@example.com',
          enrollment_source: 'partner_referral',
        }),
        { params: { id: 'camp-1' } },
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Invalid enrollment source',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 404 when the campaign is missing', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'attraction_campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'missing' },
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(
        makePost({ client_email: 'client@example.com' }),
        { params: { id: 'missing' } },
      )

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: 'Campaign not found' })
    })

    it('requires completed AI audit data before enrollment', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'attraction_campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    completion_window_days: 90,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'diagnostic_audits') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(
        makePost({ client_email: 'client@example.com' }),
        { params: { id: 'camp-1' } },
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error:
          'Client must have completed the AI Audit Calculator before enrollment. No audit data found for this email.',
      })
    })

    it('rejects duplicate active enrollments for the same email', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'attraction_campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    completion_window_days: 90,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'diagnostic_audits') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'audit-1', email: 'client@example.com' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'campaign_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: 'enr-existing' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(
        makePost({ client_email: 'client@example.com' }),
        { params: { id: 'camp-1' } },
      )

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({
        error: 'Client already has an active enrollment in this campaign',
      })
    })

    it('creates an enrollment when audit data exists and no active duplicate', async () => {
      const enrollmentInserts: Record<string, unknown>[] = []
      const created = {
        id: 'enr-new',
        campaign_id: 'camp-1',
        client_email: 'client@example.com',
        status: 'active',
      }

      mocks.from.mockImplementation((table: string) => {
        if (table === 'attraction_campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    completion_window_days: 90,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'diagnostic_audits') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'audit-1', email: 'client@example.com' }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'campaign_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn((payload: Record<string, unknown>) => {
              enrollmentInserts.push(payload)
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: created, error: null }),
                }),
              }
            }),
          }
        }
        if (table === 'value_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'campaign_criteria_templates') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(
        makePost({
          client_email: '  client@example.com  ',
          client_name: ' Client ',
          enrollment_source: 'admin_manual',
        }),
        { params: { id: 'camp-1' } },
      )

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual({ data: created })
      expect(enrollmentInserts[0]).toMatchObject({
        campaign_id: 'camp-1',
        client_email: 'client@example.com',
        client_name: 'Client',
        enrollment_source: 'admin_manual',
        status: 'active',
        diagnostic_audit_id: 'audit-1',
        deadline_at: '2026-04-01T00:00:00.000Z',
      })
    })
  })
})
