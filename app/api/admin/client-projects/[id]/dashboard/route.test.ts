import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  generateClientDashboard: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: string }) => Boolean(value?.error),
}))

vi.mock('@/lib/client-dashboard', () => ({
  generateClientDashboard: mocks.generateClientDashboard,
}))

import { POST } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/client-projects/proj-1/dashboard', {
    method: 'POST',
  })
}

const params = { params: Promise.resolve({ id: 'proj-1' }) }

describe('POST /api/admin/client-projects/[id]/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
  })

  it('rejects non-admin callers before generating a token', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(makeRequest(), params)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.generateClientDashboard).not.toHaveBeenCalled()
  })

  it('returns 400 when dashboard generation fails', async () => {
    mocks.generateClientDashboard.mockResolvedValue({
      accessToken: null,
      snapshotId: null,
      error: 'Client project not found',
    })

    const response = await POST(makeRequest(), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Client project not found' })
    expect(mocks.generateClientDashboard).toHaveBeenCalledWith('proj-1')
  })

  it('returns the access token and dashboard URL', async () => {
    mocks.generateClientDashboard.mockResolvedValue({
      accessToken: 'tok_abc',
      snapshotId: 'snap-1',
      error: null,
    })

    const response = await POST(makeRequest(), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      accessToken: 'tok_abc',
      snapshotId: 'snap-1',
      dashboardUrl: '/client/dashboard/tok_abc',
    })
  })
})
