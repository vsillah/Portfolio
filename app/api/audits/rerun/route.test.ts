import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  resolveLatestAudit: vi.fn(),
  rerunAuditSummaryGamma: vi.fn(),
}))

vi.mock('@/lib/latest-audit', () => ({
  resolveLatestAudit: mocks.resolveLatestAudit,
}))

vi.mock('@/lib/rerun-audit-summary-gamma', () => ({
  rerunAuditSummaryGamma: mocks.rerunAuditSummaryGamma,
}))

import { POST } from './route'

function makeRequest(body: unknown | string, asRaw = false) {
  return new NextRequest('http://localhost/api/audits/rerun', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: asRaw ? (body as string) : JSON.stringify(body),
  })
}

describe('POST /api/audits/rerun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveLatestAudit.mockResolvedValue({
      auditId: 'aud-1',
      contactSubmissionId: 42,
    })
    mocks.rerunAuditSummaryGamma.mockResolvedValue({
      ok: true,
      auditId: 'aud-1',
      gammaReportId: 'gamma-2',
      supersededCount: 1,
    })
  })

  it('rejects invalid JSON', async () => {
    const response = await POST(makeRequest('{not-json', true))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
  })

  it('rejects missing or invalid emails before resolving an audit', async () => {
    const missing = await POST(makeRequest({}))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'A valid email is required' })

    const invalid = await POST(makeRequest({ email: 'nope' }))
    expect(invalid.status).toBe(400)

    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
    expect(mocks.rerunAuditSummaryGamma).not.toHaveBeenCalled()
  })

  it('returns 404 when no prior audit exists for the email', async () => {
    mocks.resolveLatestAudit.mockResolvedValue(null)

    const response = await POST(makeRequest({ email: 'Owner@Example.com' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'No prior audit found for that email',
    })
    expect(mocks.resolveLatestAudit).toHaveBeenCalledWith({ email: 'owner@example.com' })
    expect(mocks.rerunAuditSummaryGamma).not.toHaveBeenCalled()
  })

  it('returns 400 when the audit is not linked to a contact', async () => {
    mocks.resolveLatestAudit.mockResolvedValue({
      auditId: 'aud-1',
      contactSubmissionId: null,
    })

    const response = await POST(makeRequest({ email: 'owner@example.com' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot rerun — audit is not linked to a contact yet',
    })
    expect(mocks.rerunAuditSummaryGamma).not.toHaveBeenCalled()
  })

  it('reruns with createdBy null after a public email proof', async () => {
    const response = await POST(makeRequest({ email: '  owner@example.com ' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      auditId: 'aud-1',
      gammaReportId: 'gamma-2',
      supersededCount: 1,
    })
    expect(mocks.rerunAuditSummaryGamma).toHaveBeenCalledWith('aud-1', null)
  })
})
