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

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/extract-leads/preflight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/extract-leads/preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ contact_submission_ids: [1] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing or empty id list', async () => {
    const response = await POST(request({ contact_submission_ids: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_ids is required and must be a non-empty array',
    })
  })

  it('rejects more than 50 ids', async () => {
    const response = await POST(request({
      contact_submission_ids: Array.from({ length: 51 }, (_, index) => index + 1),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Maximum 50 contact IDs per request',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('truncates full_report and flags extractable text from a completed diagnostic', async () => {
    const longReport = 'x'.repeat(210)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [{
                id: 4,
                name: 'Ada',
                email: ' ada@example.com ',
                company: 'Ada Co',
                company_domain: ' ada.co ',
                industry: 'ops',
                job_title: ' COO ',
                phone_number: ' 555 ',
                linkedin_url: ' https://linkedin.com/in/ada ',
                lead_source: 'warm_form',
                employee_count: ' 12 ',
                message: '   ',
                quick_wins: null,
                full_report: longReport,
                rep_pain_points: null,
              }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'diagnostic_audits') {
        return {
          select: () => ({
            in: () => ({
              eq: vi.fn().mockResolvedValue({
                data: [{ contact_submission_id: 4 }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'pain_point_evidence') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { contact_submission_id: 4 },
                { contact_submission_id: 4 },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await POST(request({ contact_submission_ids: [4, 4] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.leads).toHaveLength(1)
    expect(body.leads[0]).toEqual(expect.objectContaining({
      id: 4,
      email: 'ada@example.com',
      full_report: `${'x'.repeat(200)}...`,
      has_diagnostic: true,
      has_extractable_text: true,
      evidence_count: 2,
    }))
  })
})
