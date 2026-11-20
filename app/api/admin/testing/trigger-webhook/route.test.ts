import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/testing/trigger-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/testing/trigger-webhook', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
      text: async () => '',
    }))
  })

  it('requires admin auth before calling n8n', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(request({ scriptId: 'inbound_lead_trigger' }))

    expect(response.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires a scriptId', async () => {
    const response = await POST(request({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'scriptId is required' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown script', async () => {
    const response = await POST(request({ scriptId: 'not_a_script' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Unknown script ID' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects non-webhook scripts without fetching', async () => {
    const response = await POST(request({ scriptId: 'stripe_test_checkout' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'This script type (stripe_checkout) is not a webhook trigger.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts the catalog payload to the default n8n webhook path', async () => {
    const response = await POST(request({ scriptId: 'inbound_lead_trigger' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({
      success: true,
      httpStatus: 200,
      scriptId: 'inbound_lead_trigger',
      webhookUrl: 'https://amadutown.app.n8n.cloud/webhook/inbound-lead',
    }))
    expect(fetch).toHaveBeenCalledWith(
      'https://amadutown.app.n8n.cloud/webhook/inbound-lead',
      expect.objectContaining({ method: 'POST' }),
    )
    const sent = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string) as Record<string, unknown>
    expect(sent).toEqual(expect.any(Object))
    expect(Object.keys(sent).length).toBeGreaterThan(0)
  })

  it('prefers the script env-var webhook URL when it is set', async () => {
    vi.stubEnv('N8N_LEAD_WEBHOOK_URL', 'https://n8n.example/webhook/lead-qual')

    const response = await POST(request({ scriptId: 'lead_qualification_trigger' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.webhookUrl).toBe('https://n8n.example/webhook/lead-qual')
    expect(fetch).toHaveBeenCalledWith(
      'https://n8n.example/webhook/lead-qual',
      expect.any(Object),
    )
  })
})
