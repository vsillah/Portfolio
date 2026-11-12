import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  generateValueReport: vi.fn(),
  saveValueReport: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/value-report-generator', () => ({
  generateValueReport: mocks.generateValueReport,
  saveValueReport: mocks.saveValueReport,
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/reports/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/reports/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.generateValueReport.mockResolvedValue({ title: 'Value report' })
    mocks.saveValueReport.mockResolvedValue('report-1')
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ industry: 'logistics' }))

    expect(response.status).toBe(401)
    expect(mocks.generateValueReport).not.toHaveBeenCalled()
  })

  it('requires a contact id or industry', async () => {
    const response = await POST(request({ company_name: 'Ada Co' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Either contact_submission_id or industry is required',
    })
    expect(mocks.generateValueReport).not.toHaveBeenCalled()
  })

  it('returns 422 when generation has no evidence', async () => {
    mocks.generateValueReport.mockResolvedValue(null)

    const response = await POST(request({ industry: 'logistics' }))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'Could not generate report - no pain points or benchmarks available',
    })
    expect(mocks.saveValueReport).not.toHaveBeenCalled()
  })

  it('defaults report_type to client_facing and returns the saved id', async () => {
    const response = await POST(request({
      contact_submission_id: 44,
      company_name: 'Ada Co',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.generateValueReport).toHaveBeenCalledWith(
      {
        contactSubmissionId: 44,
        industry: undefined,
        companySize: undefined,
        companyName: 'Ada Co',
        contactName: undefined,
      },
      'client_facing',
    )
    expect(mocks.saveValueReport).toHaveBeenCalledWith({ title: 'Value report' })
    expect(body.report).toEqual({ title: 'Value report', id: 'report-1' })
  })
})
