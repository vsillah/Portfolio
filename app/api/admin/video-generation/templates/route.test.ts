import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listTemplates: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/heygen', () => ({
  listTemplates: mocks.listTemplates,
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/video-generation/templates')
}

describe('GET /api/admin/video-generation/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before calling HeyGen', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.listTemplates).not.toHaveBeenCalled()
  })

  it('returns the template catalog', async () => {
    mocks.listTemplates.mockResolvedValue({
      templates: [{ templateId: 'tpl-1', name: 'Talking head', aspectRatio: 'landscape' }],
      error: null,
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      templates: [{ templateId: 'tpl-1', name: 'Talking head', aspectRatio: 'landscape' }],
    })
  })

  it('returns an empty catalog with the provider error', async () => {
    mocks.listTemplates.mockResolvedValue({
      templates: [],
      error: 'HTTP 403',
    })

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ templates: [], error: 'HTTP 403' })
  })

  it('returns the thrown message when the catalog call rejects', async () => {
    mocks.listTemplates.mockRejectedValue('boom')

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ templates: [], error: 'boom' })
  })
})
