import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getIndustryGicsCode } from '@/lib/constants/industry'

const mocks = vi.hoisted(() => ({
  getDiagnosticAudit: vi.fn(),
  saveDiagnosticAudit: vi.fn(),
  domainForLookup: vi.fn(),
  fetchTechStackByDomain: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/diagnostic', () => ({
  getDiagnosticAudit: mocks.getDiagnosticAudit,
  saveDiagnosticAudit: mocks.saveDiagnosticAudit,
}))

vi.mock('@/lib/tech-stack-lookup', () => ({
  domainForLookup: mocks.domainForLookup,
  fetchTechStackByDomain: mocks.fetchTechStackByDomain,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { PUT } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/tools/audit/context', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/tools/audit/context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.domainForLookup.mockReturnValue(null)
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: 'audit-1', error: null })
    mocks.getDiagnosticAudit.mockResolvedValue({
      data: {
        id: 'audit-1',
        session_id: 'audit_session_1',
        enriched_tech_stack: null,
      },
    })
  })

  it('requires auditId', async () => {
    const response = await PUT(makeRequest({ email: 'ada@example.com' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'auditId is required' })
    expect(mocks.getDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('returns 404 when the audit is missing', async () => {
    mocks.getDiagnosticAudit.mockResolvedValue({ data: null })

    const response = await PUT(makeRequest({ auditId: 'audit-1' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Audit not found' })
    expect(mocks.saveDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('normalizes email and ignores unknown industry slugs', async () => {
    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      email: '  Ops@Ada.Example ',
      websiteUrl: ' https://ada.example ',
      industry: 'not-an-industry',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith('audit_session_1', {
      diagnosticAuditId: 'audit-1',
      websiteUrl: 'https://ada.example',
      contactEmail: 'ops@ada.example',
      industrySlug: undefined,
      industryGicsCode: undefined,
    })
  })

  it('passes a known industry slug and GICS code', async () => {
    const response = await PUT(makeRequest({
      auditId: 'audit-1',
      industry: 'professional_services',
    }))

    expect(response.status).toBe(200)
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith('audit_session_1', {
      diagnosticAuditId: 'audit-1',
      websiteUrl: undefined,
      contactEmail: undefined,
      industrySlug: 'professional_services',
      industryGicsCode: getIndustryGicsCode('professional_services'),
    })
  })
})
