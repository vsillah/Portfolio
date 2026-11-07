import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  resolveLatestAudit: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/latest-audit', () => ({
  resolveLatestAudit: mocks.resolveLatestAudit,
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/audits/latest${query}`)
}

describe('GET /api/admin/audits/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.resolveLatestAudit.mockResolvedValue({
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
    })
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('?email=owner@example.com'))

    expect(response.status).toBe(401)
    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
  })

  it('requires at least one lookup key', async () => {
    const response = await GET(request())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Provide at least one of email, contactSubmissionId, auditId',
    })
    expect(mocks.resolveLatestAudit).not.toHaveBeenCalled()
  })

  it('returns found:false when the lookup misses', async () => {
    mocks.resolveLatestAudit.mockResolvedValue(null)

    const response = await GET(request('?email=missing@example.com'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ found: false })
  })

  it('returns contact identifiers and an admin report URL', async () => {
    const response = await GET(request('?auditId=aud-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.resolveLatestAudit).toHaveBeenCalledWith({
      email: null,
      contactSubmissionId: null,
      auditId: 'aud-1',
    })
    expect(body).toMatchObject({
      found: true,
      auditId: 'aud-1',
      contactEmail: 'owner@example.com',
      contactSubmissionId: 99,
      adminReportUrl: '/admin/reports/gamma?auditId=aud-1',
    })
  })
})
