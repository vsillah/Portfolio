import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  fetchTechStackByDomain: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/tech-stack-lookup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tech-stack-lookup')>(
    '@/lib/tech-stack-lookup',
  )
  return {
    ...actual,
    fetchTechStackByDomain: mocks.fetchTechStackByDomain,
  }
})

import { GET } from './route'

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/tech-stack-lookup${query}`)
}

describe('GET /api/admin/tech-stack-lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('?domain=example.com'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.fetchTechStackByDomain).not.toHaveBeenCalled()
  })

  it('rejects a missing or blank domain before calling BuiltWith', async () => {
    const missing = await GET(makeRequest())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'Missing or empty query parameter: domain',
    })

    const blank = await GET(makeRequest('?domain=%20%20'))
    expect(blank.status).toBe(400)
    await expect(blank.json()).resolves.toEqual({
      error: 'Missing or empty query parameter: domain',
    })
    expect(mocks.fetchTechStackByDomain).not.toHaveBeenCalled()
  })

  it('rejects a domain that cannot be normalized', async () => {
    const response = await GET(makeRequest('?domain=x'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid domain. Use a hostname or URL (e.g. example.com or https://example.com).',
    })
    expect(mocks.fetchTechStackByDomain).not.toHaveBeenCalled()
  })

  it('returns 422 when BuiltWith lookup fails', async () => {
    mocks.fetchTechStackByDomain.mockResolvedValue({
      ok: false,
      domain: 'example.com',
      error: 'Tech stack lookup is not configured. Add BUILTWITH_API_KEY to enable.',
      creditsRemaining: 0,
    })

    const response = await GET(makeRequest('?domain=https://www.example.com/about'))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'Tech stack lookup is not configured. Add BUILTWITH_API_KEY to enable.',
      domain: 'example.com',
      creditsRemaining: 0,
    })
    expect(mocks.fetchTechStackByDomain).toHaveBeenCalledWith('example.com')
  })

  it('returns normalized technologies on success', async () => {
    mocks.fetchTechStackByDomain.mockResolvedValue({
      ok: true,
      domain: 'example.com',
      technologies: [{ name: 'React', tag: 'javascript' }],
      byTag: { javascript: ['React'] },
      creditsRemaining: 12,
    })

    const response = await GET(makeRequest('?domain=example.com'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      domain: 'example.com',
      technologies: [{ name: 'React', tag: 'javascript' }],
      byTag: { javascript: ['React'] },
      creditsRemaining: 12,
    })
  })
})
