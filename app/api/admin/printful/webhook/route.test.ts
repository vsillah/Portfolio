import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getWebhookConfig: vi.fn(),
  setWebhookConfig: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/printful', () => ({
  printful: {
    getWebhookConfig: mocks.getWebhookConfig,
    setWebhookConfig: mocks.setWebhookConfig,
  },
}))

import { GET, POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function getRequest() {
  return new NextRequest('http://localhost/api/admin/printful/webhook')
}

function postRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/printful/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('/api/admin/printful/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getWebhookConfig.mockResolvedValue({
      url: 'https://amadutown.com/api/webhooks/printful',
      types: ['package_shipped'],
    })
    mocks.setWebhookConfig.mockResolvedValue({
      url: 'https://amadutown.com/api/webhooks/printful',
      types: ['package_shipped'],
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('rejects non-admin callers', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(getRequest())

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
      expect(mocks.getWebhookConfig).not.toHaveBeenCalled()
    })

    it('returns the live Printful webhook config', async () => {
      const response = await GET(getRequest())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        url: 'https://amadutown.com/api/webhooks/printful',
        types: ['package_shipped'],
      })
    })

    it('returns a null url payload when Printful has no webhook configured', async () => {
      mocks.getWebhookConfig.mockResolvedValue(null)

      const response = await GET(getRequest())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ url: null, types: [] })
    })

    it('returns a generic 500 when Printful lookup throws', async () => {
      mocks.getWebhookConfig.mockRejectedValue(new Error('Printful outage'))

      const response = await GET(getRequest())

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({
        error: 'Failed to fetch webhook config',
      })
    })
  })

  describe('POST', () => {
    it('rejects non-admin callers before writing webhook config', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await POST(postRequest({ url: 'https://evil.example/hook' }))

      expect(response.status).toBe(401)
      expect(mocks.setWebhookConfig).not.toHaveBeenCalled()
    })

    it('defaults the webhook URL from NEXT_PUBLIC_SITE_URL and only subscribes to package_shipped', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://amadutown.com/'
      delete process.env.VERCEL_URL

      const response = await POST(postRequest({}))

      expect(response.status).toBe(200)
      expect(mocks.setWebhookConfig).toHaveBeenCalledWith({
        url: 'https://amadutown.com/api/webhooks/printful',
        types: ['package_shipped'],
      })
    })

    it('falls back to VERCEL_URL when the site URL is unset', async () => {
      delete process.env.NEXT_PUBLIC_SITE_URL
      process.env.VERCEL_URL = 'preview.vercel.app'

      const response = await POST(postRequest({ url: '   ' }))

      expect(response.status).toBe(200)
      expect(mocks.setWebhookConfig).toHaveBeenCalledWith({
        url: 'https://preview.vercel.app/api/webhooks/printful',
        types: ['package_shipped'],
      })
    })

    it('accepts an explicit webhook URL from the request body', async () => {
      const configured = {
        url: 'https://custom.example/api/webhooks/printful',
        types: ['package_shipped'],
      }
      mocks.setWebhookConfig.mockResolvedValue(configured)

      const response = await POST(
        postRequest({ url: 'https://custom.example/api/webhooks/printful' }),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(configured)
      expect(mocks.setWebhookConfig).toHaveBeenCalledWith({
        url: 'https://custom.example/api/webhooks/printful',
        types: ['package_shipped'],
      })
    })

    it('returns a generic 500 when Printful config write throws', async () => {
      mocks.setWebhookConfig.mockRejectedValue(new Error('invalid url'))

      const response = await POST(postRequest({ url: 'https://amadutown.com/api/webhooks/printful' }))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({
        error: 'Failed to set webhook config',
      })
    })
  })
})
