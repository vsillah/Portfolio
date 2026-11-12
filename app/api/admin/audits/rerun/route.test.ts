import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  resolveLatestAudit: vi.fn(),
  rerunAuditSummaryGamma: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/latest-audit', () => ({
  resolveLatestAudit: mocks.resolveLatestAudit,
}))

vi.mock('@/lib/rerun-audit-summary-gamma', () => ({
  rerunAuditSummaryGamma: mocks.rerunAuditSummaryGamma,
}))

import { POST } from './route'

function makeRequest(body: unknown | string, asRaw = false) {
  return new NextRequest('http://localhost/api/admin/audits/rerun', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: asRaw ? (body as string) : JSON.stringify(body),
  })
}

describe('POST /api/admin/audits/rerun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.resolveLatestAudit.mockResolvedValue({ auditId: 'aud-resolved' })
    mocks.rerunAuditSummaryGamma.mockResolvedValue({
      ok: true,
      auditId: 'aud-1',
      gammaReportId: 'gamma-2',
      supersededCount: 0,
    })
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ auditId: 'aud-1' }))

    expect(response.status).toBe(403)
    expect(mocks.rerunAuditSummaryGamma).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const response = await POST(makeRequest('{nope', true))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
  })

  it('requires auditId, email, or contactSubmissionId', async () => {
    const response = await POST(makeRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Provide auditId, email, or contactSubmissionId',
    })
    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
  })

  it('skips lookup when auditId is supplied and stamps the admin as createdBy', async () => {
    const response = await POST(makeRequest({ auditId: 17 }))

    expect(response.status).toBe(200)
    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
    expect(mocks.rerunAuditSummaryGamma).toHaveBeenCalledWith('17', 'admin-1')
    await expect(response.json()).resolves.toEqual({
      ok: true,
      auditId: 'aud-1',
      gammaReportId: 'gamma-2',
      supersededCount: 0,
      adminReportUrl: '/admin/reports/gamma?auditId=aud-1',
    })
  })

  it('resolves by email when auditId is omitted', async () => {
    const response = await POST(makeRequest({ email: 'owner@example.com' }))

    expect(response.status).toBe(200)
    expect(mocks.resolveLatestAudit).toHaveBeenCalledWith({
      email: 'owner@example.com',
      contactSubmissionId: undefined,
    })
    expect(mocks.rerunAuditSummaryGamma).toHaveBeenCalledWith('aud-resolved', 'admin-1')
  })

  it('returns 404 when no prior audit matches the contact', async () => {
    mocks.resolveLatestAudit.mockResolvedValue(null)

    const response = await POST(makeRequest({ contactSubmissionId: 9 }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'No prior audit found for the given contact',
    })
    expect(mocks.rerunAuditSummaryGamma).not.toHaveBeenCalled()
  })
})
