import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  getDiagnosticAudit: vi.fn(),
  userOwnsAudit: vi.fn(),
  auditRecordToPdfData: vi.fn(),
  generateAuditReportPDFBuffer: vi.fn(),
  sendEmail: vi.fn(),
  getEmailFromName: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/diagnostic', () => ({
  getDiagnosticAudit: mocks.getDiagnosticAudit,
}))

vi.mock('@/lib/audit-report-access', () => ({
  userOwnsAudit: mocks.userOwnsAudit,
}))

vi.mock('@/lib/audit-report-pdf', () => ({
  auditRecordToPdfData: mocks.auditRecordToPdfData,
  generateAuditReportPDFBuffer: mocks.generateAuditReportPDFBuffer,
}))

vi.mock('@/lib/notifications', () => ({
  sendEmail: mocks.sendEmail,
}))

vi.mock('@/lib/business-email-config', () => ({
  getEmailFromName: mocks.getEmailFromName,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown> | string = { auditId: 'audit-1' }) {
  return new NextRequest('http://localhost/api/tools/audit/email-pdf', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/tools/audit/email-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mocks.isAuthError.mockReturnValue(false)
    mocks.userOwnsAudit.mockResolvedValue(true)
    mocks.getDiagnosticAudit.mockResolvedValue({
      data: { id: 'audit-1', status: 'completed' },
      error: null,
    })
    mocks.auditRecordToPdfData.mockReturnValue({ title: 'Audit' })
    mocks.generateAuditReportPDFBuffer.mockResolvedValue(Buffer.from('pdf-bytes'))
    mocks.sendEmail.mockResolvedValue(true)
    mocks.getEmailFromName.mockReturnValue('AmaduTown')
  })

  it('rejects unauthenticated requests before loading an audit', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.userOwnsAudit).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('requires an auditId', async () => {
    const response = await POST(makeRequest({ auditId: '   ' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'auditId is required' })
    expect(mocks.userOwnsAudit).not.toHaveBeenCalled()
  })

  it('rejects accounts with no email address', async () => {
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1', email: '  ' } })

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Your account has no email address',
    })
    expect(mocks.userOwnsAudit).not.toHaveBeenCalled()
  })

  it('hides unauthorized audits behind a generic 404', async () => {
    mocks.userOwnsAudit.mockResolvedValue(false)

    const response = await POST(makeRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Something went wrong. Please try again.',
    })
    expect(mocks.getDiagnosticAudit).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses to email an incomplete report', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({
      data: { id: 'audit-1', status: 'in_progress' },
      error: null,
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Report is not complete yet.' })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('returns a generic 500 when email delivery fails', async () => {
    mocks.sendEmail.mockResolvedValue(false)

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'We could not send the email. Please try again later.',
    })
  })

  it('emails a PDF only to the signed-in owner of a completed audit', async () => {
    const response = await POST(makeRequest({ auditId: ' audit-1 ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.userOwnsAudit).toHaveBeenCalledWith('audit-1', 'user-1', 'owner@example.com')
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        attachments: [
          expect.objectContaining({
            filename: 'ai-automation-audit-audit-1.pdf',
            contentType: 'application/pdf',
          }),
        ],
      }),
      expect.objectContaining({
        emailKind: 'audit_pdf',
        sourceSystem: 'tools_audit',
        sourceId: 'audit-1',
      }),
    )
  })
})
