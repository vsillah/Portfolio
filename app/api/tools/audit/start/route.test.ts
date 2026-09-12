import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getIndustryGicsCode } from '@/lib/constants/industry'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  saveDiagnosticAudit: vi.fn(),
  tryVerifyAuth: vi.fn(),
  domainForLookup: vi.fn(),
  fetchTechStackByDomain: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/diagnostic', () => ({
  saveDiagnosticAudit: mocks.saveDiagnosticAudit,
}))

vi.mock('@/lib/auth-server', () => ({
  tryVerifyAuth: mocks.tryVerifyAuth,
}))

vi.mock('@/lib/tech-stack-lookup', () => ({
  domainForLookup: mocks.domainForLookup,
  fetchTechStackByDomain: mocks.fetchTechStackByDomain,
}))

import { POST } from './route'

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/tools/audit/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('POST /api/tools/audit/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.tryVerifyAuth.mockResolvedValue(null)
    mocks.domainForLookup.mockReturnValue(null)
    mocks.fetchTechStackByDomain.mockResolvedValue({ ok: false })
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: 'audit-1', error: null })
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  it('creates a standalone audit session when the body is empty', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sessionId).toMatch(/^audit_/)
    expect(body.auditId).toBe('audit-1')
    expect(insert).toHaveBeenCalledWith({
      session_id: body.sessionId,
      visitor_email: null,
      visitor_name: null,
    })
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith(body.sessionId, {
      status: 'in_progress',
      auditType: 'standalone',
      businessName: undefined,
      websiteUrl: undefined,
      contactEmail: undefined,
      industrySlug: undefined,
      industryGicsCode: undefined,
    })
  })

  it('normalizes context fields and ignores unknown industry slugs', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(makeRequest({
      businessName: '  North Star Labs  ',
      websiteUrl: ' https://northstar.example ',
      email: '  Ops@NorthStar.Example ',
      industry: 'not-an-industry',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith({
      session_id: body.sessionId,
      visitor_email: 'ops@northstar.example',
      visitor_name: 'North Star Labs',
    })
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith(body.sessionId, expect.objectContaining({
      businessName: 'North Star Labs',
      websiteUrl: 'https://northstar.example',
      contactEmail: 'ops@northstar.example',
      industrySlug: undefined,
      industryGicsCode: undefined,
    }))
  })

  it('passes a known industry slug, GICS code, and authenticated user id', async () => {
    mocks.tryVerifyAuth.mockResolvedValue({ user: { id: 'user-9' } })
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(makeRequest({
      businessName: 'Ada Co',
      industry: 'saas',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.saveDiagnosticAudit).toHaveBeenCalledWith(body.sessionId, {
      status: 'in_progress',
      auditType: 'standalone',
      businessName: 'Ada Co',
      websiteUrl: undefined,
      contactEmail: undefined,
      industrySlug: 'saas',
      industryGicsCode: getIndustryGicsCode('saas'),
      userId: 'user-9',
    })
  })

  it('returns a generic 500 when the chat session cannot be created', async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: {} }),
    })

    const response = await POST(makeRequest({ email: 'ada@example.com' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Could not start audit session',
    })
    expect(mocks.saveDiagnosticAudit).not.toHaveBeenCalled()
  })

  it('returns a generic 500 when the diagnostic audit cannot be saved', async () => {
    mocks.saveDiagnosticAudit.mockResolvedValue({ id: null, error: {} })

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Could not create audit',
    })
  })
})
