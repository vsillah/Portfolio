import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { GET } from './route'

function makeRequest(packetPath: string) {
  return new NextRequest(`http://localhost/api/admin/video-generation/evidence-packet?path=${encodeURIComponent(packetPath)}`)
}

describe('GET /api/admin/video-generation/evidence-packet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('docs/agentic-content-review-packets/p0-challenger-review-packets.md'))

    expect(response.status).toBe(401)
  })

  it('rejects non-whitelisted paths', async () => {
    const response = await GET(makeRequest('package.json'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid evidence packet path' })
  })

  it('loads whitelisted markdown evidence packets', async () => {
    const response = await GET(makeRequest('docs/agentic-content-review-packets/p0-challenger-review-packets.md'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.path).toBe('docs/agentic-content-review-packets/p0-challenger-review-packets.md')
    expect(body.content).toContain('Agentic Content')
  })
})
