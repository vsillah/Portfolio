import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  fetchReportContext: vi.fn(),
  buildEvidenceForReport: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/gamma-report-builder', () => ({
  fetchReportContext: mocks.fetchReportContext,
  buildEvidenceForReport: mocks.buildEvidenceForReport,
}))

import { GET } from './route'

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/gamma-reports/evidence-preview${query}`)
}

describe('GET /api/admin/gamma-reports/evidence-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns the auth error when the caller is not an admin', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('?contactSubmissionId=12'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.fetchReportContext).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric contactSubmissionId before fetching context', async () => {
    const response = await GET(makeRequest('?contactSubmissionId=abc'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contactSubmissionId must be a number',
    })
    expect(mocks.fetchReportContext).not.toHaveBeenCalled()
  })

  it('returns an empty index when no identifiers are provided', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      items: [],
      counts: {
        audit_response: 0,
        meeting_quote: 0,
        tech_stack: 0,
        value_formula: 0,
        benchmark: 0,
        pain_point_excerpt: 0,
      },
      meetingsAvailable: 0,
    })
    expect(mocks.fetchReportContext).not.toHaveBeenCalled()
  })

  it('builds evidence counts from the report context', async () => {
    mocks.fetchReportContext.mockResolvedValue({ meetings: [{ id: 1 }, { id: 2 }] })
    mocks.buildEvidenceForReport.mockReturnValue([
      { kind: 'meeting_quote' },
      { kind: 'meeting_quote' },
      { kind: 'audit_response' },
    ])

    const response = await GET(makeRequest('?contactSubmissionId=42&auditId=audit-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.meetingsAvailable).toBe(2)
    expect(body.counts.meeting_quote).toBe(2)
    expect(body.counts.audit_response).toBe(1)
    expect(body.counts.tech_stack).toBe(0)
    expect(mocks.fetchReportContext).toHaveBeenCalledWith({
      reportType: 'audit_summary',
      contactSubmissionId: 42,
      diagnosticAuditId: 'audit-1',
      valueReportId: undefined,
    })
  })

  it('returns a generic 500 when context assembly fails', async () => {
    mocks.fetchReportContext.mockRejectedValue(new Error('db down'))

    const response = await GET(makeRequest('?valueReportId=vr-1'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to build evidence preview' })
  })
})
