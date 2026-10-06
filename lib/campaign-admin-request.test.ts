import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { getCurrentSession } from '@/lib/auth'
import { campaignAdminRequest, CampaignAdminRequestError } from './campaign-admin-request'

vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentSession).mockResolvedValue({
    access_token: 'campaign-admin-token',
    expires_at: Date.now() / 1000 + 300,
  } as Awaited<ReturnType<typeof getCurrentSession>>)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"data":[]}')))
})

afterEach(() => vi.unstubAllGlobals())

describe('campaignAdminRequest', () => {
  it('keeps campaign list and enrollment requests on the authenticated transport', () => {
    const sources = [
      'app/admin/campaigns/page.tsx',
      'app/admin/campaigns/[id]/enrollments/[enrollmentId]/page.tsx',
    ].map(path => readFileSync(path, 'utf8'))

    expect(sources.join('\n')).not.toMatch(/fetch\([`'"]\/api\/admin\/campaigns/)
    expect(sources.every(source => source.includes('campaignAdminRequest('))).toBe(true)
  })

  it.each([
    ['/api/admin/campaigns', 'GET'],
    ['/api/admin/campaigns?status=draft', 'GET'],
    ['/api/admin/campaigns/campaign-1', 'PUT'],
    ['/api/admin/campaigns/campaign-1/enrollments', 'POST'],
  ])('sends a current session to %s', async (path, method) => {
    await campaignAdminRequest(path, {
      method,
      headers: { Authorization: 'Bearer stale' },
      ...(method === 'GET' ? {} : { body: '{}' }),
    })

    const [destination, options] = vi.mocked(fetch).mock.calls[0]
    expect(destination).toBe(path)
    expect(options?.method).toBe(method)
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer campaign-admin-token')
    if (method !== 'GET') {
      expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
    }
    expect(options?.redirect).toBe('error')
  })

  it.each(['missing', 'expired'])('blocks a %s session before sending', async mode => {
    vi.mocked(getCurrentSession).mockResolvedValue(
      mode === 'missing'
        ? null
        : ({ access_token: 'expired', expires_at: 1 } as Awaited<ReturnType<typeof getCurrentSession>>),
    )

    await expect(campaignAdminRequest('/api/admin/campaigns')).rejects.toMatchObject({
      message: 'Sign in again to manage campaigns.',
      status: 401,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    'https://external.invalid/api/admin/campaigns',
    '//external.invalid/api/admin/campaigns',
    '/api/admin/campaigns-archive',
    '/api/admin/outreach',
  ])('rejects an unsafe destination %s', async path => {
    await expect(campaignAdminRequest(path)).rejects.toBeInstanceOf(CampaignAdminRequestError)
    expect(getCurrentSession).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'Sign in again to manage campaigns.'],
    [403, 'Admin access is required to manage campaigns.'],
    [500, 'Campaign request failed. Try again.'],
  ])('maps HTTP %i to an actionable message', async (status, message) => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status }))
    await expect(campaignAdminRequest('/api/admin/campaigns')).rejects.toMatchObject({ status, message })
  })

  it('preserves a bounded validation message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'Campaign slug already exists.',
      private_details: 'do not render',
    }), { status: 409 }))

    await expect(campaignAdminRequest('/api/admin/campaigns')).rejects.toMatchObject({
      message: 'Campaign slug already exists.',
      status: 409,
    })
  })
})
