import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  resolveLatestAudit: vi.fn(),
}))

vi.mock('@/lib/latest-audit', () => ({
  resolveLatestAudit: mocks.resolveLatestAudit,
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/audits/latest${query}`)
}

const resolved = {
  auditId: 'aud-1',
  auditStatus: 'completed',
  completedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  businessName: 'Acme LLC',
  contactEmail: 'owner@example.com',
  contactSubmissionId: 99,
  auditType: 'full',
  gammaReport: {
    id: 'gamma-1',
    gammaUrl: 'https://gamma.app/deck',
    status: 'completed',
    createdAt: '2026-09-03T00:00:00.000Z',
  },
}

describe('GET /api/audits/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveLatestAudit.mockResolvedValue(resolved)
  })

  it('returns found:false without looking up invalid or missing emails', async () => {
    const missing = await GET(request())
    expect(await missing.json()).toEqual({ found: false })

    const invalid = await GET(request('?email=not-an-email'))
    expect(await invalid.json()).toEqual({ found: false })

    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
  })

  it('normalizes email and omits contact identifiers from the public payload', async () => {
    const response = await GET(request('?email=%20Owner@Example.COM%20'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.resolveLatestAudit).toHaveBeenCalledWith({ email: 'owner@example.com' })
    expect(body).toEqual({
      found: true,
      auditId: 'aud-1',
      auditStatus: 'completed',
      completedAt: '2026-09-01T00:00:00.000Z',
      businessName: 'Acme LLC',
      auditType: 'full',
      gammaReportId: 'gamma-1',
      gammaUrl: 'https://gamma.app/deck',
      gammaStatus: 'completed',
      gammaCreatedAt: '2026-09-03T00:00:00.000Z',
    })
    expect(body).not.toHaveProperty('contactSubmissionId')
    expect(body).not.toHaveProperty('contactEmail')
    expect(body).not.toHaveProperty('adminReportUrl')
  })

  it('returns found:false when no audit exists for the email', async () => {
    mocks.resolveLatestAudit.mockResolvedValue(null)

    const response = await GET(request('?email=missing@example.com'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ found: false })
  })
})
