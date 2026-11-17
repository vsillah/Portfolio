import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const mocks = vi.hoisted(() => ({ admin: true }))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: vi.fn(async () => mocks.admin ? { user: { id: 'admin' }, isAdmin: true } : { error: 'Authentication required', status: 401 }),
  isAuthError: (result: { error?: string }) => Boolean(result.error),
}))

const request = new NextRequest('http://localhost/api/admin/social-content/accelerated-review-assets/slide-01.png')

describe('private Accelerated review assets', () => {
  it('requires admin authentication', async () => {
    mocks.admin = false
    const response = await GET(request, { params: { slide: 'slide-01.png' } })
    expect(response.status).toBe(401)
    mocks.admin = true
  })

  it('rejects paths outside the eight approved frames', async () => {
    const response = await GET(request, { params: { slide: '../secret.png' } })
    expect(response.status).toBe(404)
  })

  it('serves a private raster with no-store headers', async () => {
    const response = await GET(request, { params: { slide: 'slide-01.png' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
