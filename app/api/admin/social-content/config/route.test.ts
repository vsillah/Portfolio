import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

const configs = [{
  id: 'config-youtube',
  platform: 'youtube',
  credentials: {
    access_token: 'secret-token',
    refresh_token: 'secret-refresh-token',
  },
  settings: {
    channel_title: 'Vambah Sillah',
    default_privacy: 'private',
  },
  is_active: true,
  created_at: '2026-08-03T00:00:00.000Z',
  updated_at: '2026-08-03T00:00:00.000Z',
}, {
  id: 'config-instagram',
  platform: 'instagram',
  credentials: {
    access_token: 'secret-instagram-token',
    ig_user_id: 'secret-ig-user',
  },
  settings: {
    instagram_account_type: 'business',
    meta_page_linked: true,
    app_review_permissions_confirmed: true,
  },
  is_active: true,
  created_at: '2026-08-04T00:00:00.000Z',
  updated_at: '2026-08-04T00:00:00.000Z',
}]

function request(url = 'https://amadutown.com/api/admin/social-content/config') {
  return new NextRequest(url)
}

function installConfigQuery() {
  mocks.eq.mockImplementation((_key: string, value: string) => Promise.resolve({
    data: configs.filter((config) => config.platform === value),
    error: null,
  }))
  mocks.order.mockReturnValue({ eq: mocks.eq })
  mocks.select.mockReturnValue({ order: mocks.order })
  mocks.from.mockReturnValue({ select: mocks.select })
}

describe('GET /api/admin/social-content/config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    installConfigQuery()
  })

  it('returns a credential-redacted platform status view when safe mode is requested', async () => {
    const response = await GET(request('https://amadutown.com/api/admin/social-content/config?safe=true&platform=youtube'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      configs: [
        {
          id: 'config-youtube',
          platform: 'youtube',
          settings: {
            channel_title: 'Vambah Sillah',
            default_privacy: 'private',
          },
          is_active: true,
          credentials_configured: true,
          provider_setup: null,
          created_at: '2026-08-03T00:00:00.000Z',
          updated_at: '2026-08-03T00:00:00.000Z',
        },
      ],
    })
    expect(mocks.eq).toHaveBeenCalledWith('platform', 'youtube')
  })

  it('returns Instagram setup requirements without exposing credential values', async () => {
    const response = await GET(request('https://amadutown.com/api/admin/social-content/config?safe=true&platform=instagram'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.configs).toEqual([{
      id: 'config-instagram',
      platform: 'instagram',
      settings: {
        instagram_account_type: 'business',
        meta_page_linked: true,
        app_review_permissions_confirmed: true,
      },
      is_active: true,
      credentials_configured: true,
      provider_setup: {
        provider: 'meta_instagram_graph',
        ready: true,
        requirements: {
          professional_account: true,
          meta_page_linked: true,
          access_token: true,
          ig_user_business_id: true,
          app_review_permissions: true,
        },
        human_gate: 'Store credentials through the approved secret/config path only. Final Instagram publish remains separately human-submitted.',
      },
      created_at: '2026-08-04T00:00:00.000Z',
      updated_at: '2026-08-04T00:00:00.000Z',
    }])
    expect(JSON.stringify(body)).not.toContain('secret-instagram-token')
    expect(JSON.stringify(body)).not.toContain('secret-ig-user')
  })

  it('keeps the legacy full config response for existing detail-page orchestration', async () => {
    mocks.order.mockResolvedValueOnce({ data: configs, error: null })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ configs })
  })
})
