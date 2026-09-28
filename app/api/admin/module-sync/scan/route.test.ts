import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  runModuleSyncScan: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/module-sync-scan', () => ({
  runModuleSyncScan: mocks.runModuleSyncScan,
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/module-sync/scan')
}

describe('GET /api/admin/module-sync/scan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before scanning', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(mocks.runModuleSyncScan).not.toHaveBeenCalled()
  })

  it('returns 429 and Retry-After when GitHub rate limits the scan', async () => {
    mocks.runModuleSyncScan.mockResolvedValue({
      error: 'GitHub API rate limit exceeded',
      candidates: [{ path: 'should-not-leak' }],
      rateLimitRetryAfter: 42,
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(await response.json()).toEqual({
      error: 'GitHub API rate limit exceeded',
      candidates: [],
      rateLimitRetryAfter: 42,
    })
  })

  it('returns other scan errors as 400 without a retry header', async () => {
    mocks.runModuleSyncScan.mockResolvedValue({
      error: 'GITHUB_REPO is not configured',
      candidates: [],
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(400)
    expect(response.headers.get('Retry-After')).toBeNull()
    expect(await response.json()).toEqual({
      error: 'GITHUB_REPO is not configured',
      candidates: [],
    })
  })

  it('returns candidates and includes a retry hint only when one is present', async () => {
    mocks.runModuleSyncScan.mockResolvedValueOnce({
      candidates: [{ path: 'lib/new-module' }],
    })
    const clean = await GET(makeRequest())
    expect(clean.status).toBe(200)
    expect(await clean.json()).toEqual({ candidates: [{ path: 'lib/new-module' }] })

    mocks.runModuleSyncScan.mockResolvedValueOnce({
      candidates: [],
      rateLimitRetryAfter: 7,
    })
    const hinted = await GET(makeRequest())
    expect(await hinted.json()).toEqual({ candidates: [], rateLimitRetryAfter: 7 })
  })
})
