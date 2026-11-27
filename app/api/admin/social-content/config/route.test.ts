import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
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

import { GET, PUT } from './route'

const secrets = [
  'secret-token', 'secret-refresh-token', 'secret-instagram-token',
  'secret-ig-user', 'secret-facebook-token', 'secret-page-id',
  'secret-client-secret', 'secret-provider-id', 'secret-nested-token',
]

async function expectNoSecrets(response: Response) {
  const serialized = await response.text()
  for (const secret of secrets) expect(serialized).not.toContain(secret)
  return JSON.parse(serialized)
}

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
    client_secret: 'secret-client-secret',
    nested: [{ providerId: 'secret-provider-id', access_token: 'secret-nested-token', keep: 'visible' }],
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
}, {
  id: 'config-facebook',
  platform: 'facebook',
  credentials: {
    page_access_token: 'secret-facebook-token',
    page_id: 'secret-page-id',
  },
  settings: {
    connected_page_name: 'AmaduTown',
  },
  is_active: true,
  created_at: '2026-08-05T00:00:00.000Z',
  updated_at: '2026-08-05T00:00:00.000Z',
}]

function request(url = 'https://amadutown.com/api/admin/social-content/config') {
  return new NextRequest(url)
}

function putRequest(body: unknown) {
  return new NextRequest('https://amadutown.com/api/admin/social-content/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
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

function installUpdate(result: { data: unknown; error: unknown }) {
  mocks.single.mockResolvedValue(result)
  mocks.eq.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ single: mocks.single })
  mocks.update.mockReturnValue({ eq: mocks.eq })
  mocks.from.mockReturnValue({ update: mocks.update })
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
    await expect(expectNoSecrets(response)).resolves.toEqual({
      configs: [
        {
          id: 'config-youtube',
          platform: 'youtube',
          settings: {
            channel_title: 'Vambah Sillah',
            default_privacy: 'private',
            nested: [{ keep: 'visible' }],
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
    const body = await expectNoSecrets(response)
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
  })

  it('redacts every config by default without safe=true', async () => {
    mocks.order.mockResolvedValueOnce({ data: configs, error: null })

    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await expectNoSecrets(response)
    expect(body.configs).toHaveLength(3)
    expect(body.configs[0].credentials).toBeUndefined()
    expect(body.configs[0].settings).toEqual({
      channel_title: 'Vambah Sillah',
      default_privacy: 'private',
      nested: [{ keep: 'visible' }],
    })
  })

  it('returns Facebook setup requirements without exposing Page token values', async () => {
    const response = await GET(request('https://amadutown.com/api/admin/social-content/config?safe=true&platform=facebook'))

    expect(response.status).toBe(200)
    const body = await expectNoSecrets(response)
    expect(body.configs).toEqual([{
      id: 'config-facebook',
      platform: 'facebook',
      settings: {
        connected_page_name: 'AmaduTown',
      },
      is_active: true,
      credentials_configured: true,
      provider_setup: {
        provider: 'meta_facebook_graph',
        ready: true,
        requirements: {
          page_access_token: true,
          page_id: true,
        },
        human_gate: 'Store credentials through the approved secret/config path only. Final Facebook publish remains separately human-submitted.',
      },
      created_at: '2026-08-05T00:00:00.000Z',
      updated_at: '2026-08-05T00:00:00.000Z',
    }])
  })

  it('keeps authentication and authorization failures intact', async () => {
    for (const status of [401, 403]) {
      mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Access denied', status })
      mocks.isAuthError.mockReturnValueOnce(true)
      const response = await GET(request())
      expect(response.status).toBe(status)
      expect(await expectNoSecrets(response)).toEqual({ error: 'Access denied' })
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns fixed errors without credential values on read failure and exception', async () => {
    mocks.order.mockResolvedValueOnce({ data: null, error: new Error('secret-token') })
    const failed = await GET(request())
    expect(failed.status).toBe(500)
    expect(await expectNoSecrets(failed)).toEqual({ error: 'Failed to fetch config' })

    mocks.verifyAdmin.mockRejectedValueOnce(new Error('secret-refresh-token'))
    const thrown = await GET(request())
    expect(thrown.status).toBe(500)
    expect(await expectNoSecrets(thrown)).toEqual({ error: 'Internal server error' })
  })
})

describe('PUT /api/admin/social-content/config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('preserves the authorized update and redacts its success response', async () => {
    installUpdate({ data: configs[0], error: null })
    const credentials = { access_token: 'secret-token', refresh_token: 'secret-refresh-token' }
    const response = await PUT(putRequest({ platform: 'youtube', credentials, is_active: true }))

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ credentials, is_active: true })
    expect(mocks.eq).toHaveBeenCalledWith('platform', 'youtube')
    const body = await expectNoSecrets(response)
    expect(body.config.credentials).toBeUndefined()
    expect(body.config.credentials_configured).toBe(true)
    expect(body.config.settings.default_privacy).toBe('private')
  })

  it('redacts errors for validation, database failure, and exceptions', async () => {
    const missing = await PUT(putRequest({ credentials: { access_token: 'secret-token' } }))
    expect(missing.status).toBe(400)
    expect(await expectNoSecrets(missing)).toEqual({ error: 'platform is required' })

    const empty = await PUT(putRequest({ platform: 'youtube' }))
    expect(empty.status).toBe(400)
    expect(await expectNoSecrets(empty)).toEqual({ error: 'No valid fields to update' })

    installUpdate({ data: null, error: new Error('secret-token') })
    const failed = await PUT(putRequest({ platform: 'youtube', credentials: { access_token: 'secret-token' } }))
    expect(failed.status).toBe(500)
    expect(await expectNoSecrets(failed)).toEqual({ error: 'Failed to update config' })

    mocks.verifyAdmin.mockRejectedValueOnce(new Error('secret-token'))
    const thrown = await PUT(putRequest({ platform: 'youtube', credentials: { access_token: 'secret-token' } }))
    expect(thrown.status).toBe(500)
    expect(await expectNoSecrets(thrown)).toEqual({ error: 'Internal server error' })
  })

  it('keeps authentication and authorization failures intact', async () => {
    for (const status of [401, 403]) {
      mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Access denied', status })
      mocks.isAuthError.mockReturnValueOnce(true)
      const response = await PUT(putRequest({ platform: 'youtube', credentials: { access_token: 'secret-token' } }))
      expect(response.status).toBe(status)
      expect(await expectNoSecrets(response)).toEqual({ error: 'Access denied' })
    }
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
