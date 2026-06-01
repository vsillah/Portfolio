import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  refreshPublishedSocialEngagement: vi.fn(),
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-engagement-refresh', () => ({
  refreshPublishedSocialEngagement: mocks.refreshPublishedSocialEngagement,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}))

import { POST } from './route'

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/social-content/engagement/refresh', {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/social-content/engagement/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.refreshPublishedSocialEngagement.mockResolvedValue({
      refreshed: 1,
      skipped: 0,
      errors: [],
      insights: [{ contentId: 'content-1', theme: 'Agentic operating system', score: 88 }],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.refreshPublishedSocialEngagement).not.toHaveBeenCalled()
  })

  it('refreshes LinkedIn engagement through the guarded service', async () => {
    const response = await POST(request({
      platform: 'linkedin',
      content_id: 'content-1',
      limit: 5,
      force: true,
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      platform: 'linkedin',
      content_id: 'content-1',
      refreshed: 1,
      insights: [{ contentId: 'content-1', theme: 'Agentic operating system', score: 88 }],
    })
    expect(mocks.refreshPublishedSocialEngagement).toHaveBeenCalledWith({
      db: mocks.supabaseAdmin,
      platform: 'linkedin',
      contentId: 'content-1',
      limit: 5,
      force: true,
    })
  })

  it('defaults unsupported platform input to LinkedIn for V1', async () => {
    const response = await POST(request({ platform: 'youtube' }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.platform).toBe('linkedin')
    expect(mocks.refreshPublishedSocialEngagement).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'linkedin',
      contentId: null,
      limit: 20,
      force: false,
    }))
  })

  it('returns service unavailable when Apify credentials are missing', async () => {
    mocks.refreshPublishedSocialEngagement.mockRejectedValue(new Error('APIFY_API_TOKEN is not configured'))

    const response = await POST(request() as never)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'APIFY_API_TOKEN is not configured' })
  })
})
