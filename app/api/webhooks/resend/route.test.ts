import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  webhookCtor: vi.fn(),
  updateFromWebhook: vi.fn(),
}))

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation((secret: string) => {
    mocks.webhookCtor(secret)
    return {
      verify: mocks.verify,
    }
  }),
}))

vi.mock('@/lib/email-messages', () => ({
  updateEmailMessageFromResendWebhook: mocks.updateFromWebhook,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body,
  })
}

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_123'
  })

  afterEach(() => {
    restoreEnv()
  })

  it('returns 503 when webhook secret is not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Not configured' })
    expect(mocks.webhookCtor).not.toHaveBeenCalled()
    expect(mocks.updateFromWebhook).not.toHaveBeenCalled()
  })

  it('returns 400 when required Svix headers are missing', async () => {
    const response = await POST(makeRequest('{}', { 'svix-id': 'msg_1' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing signature headers' })
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('returns 400 when signature verification fails', async () => {
    mocks.verify.mockImplementationOnce(() => {
      throw new Error('bad signature')
    })

    const response = await POST(
      makeRequest('{"type":"email.delivered"}', {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,invalid',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid signature' })
    expect(mocks.updateFromWebhook).not.toHaveBeenCalled()
  })

  it('acknowledges non-email events without attempting updates', async () => {
    mocks.verify.mockReturnValueOnce({ type: 'domain.created', data: { email_id: 're_1' } })

    const response = await POST(
      makeRequest('{"type":"domain.created"}', {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,ok',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.updateFromWebhook).not.toHaveBeenCalled()
  })

  it('acknowledges email events without email_id as no-ops', async () => {
    mocks.verify.mockReturnValueOnce({ type: 'email.delivered', data: {} })

    const response = await POST(
      makeRequest('{"type":"email.delivered"}', {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,ok',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.updateFromWebhook).not.toHaveBeenCalled()
  })

  it('returns matched=true when update succeeds', async () => {
    mocks.verify.mockReturnValueOnce({
      type: 'email.delivered',
      created_at: '2026-04-19T10:00:00.000Z',
      data: { email_id: 're_123' },
    })
    mocks.updateFromWebhook.mockResolvedValueOnce({ updated: true, ignored: false })

    const response = await POST(
      makeRequest('{"type":"email.delivered"}', {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,ok',
      }),
    )

    expect(mocks.webhookCtor).toHaveBeenCalledWith('whsec_test_123')
    expect(mocks.updateFromWebhook).toHaveBeenCalledWith({
      externalId: 're_123',
      resendEventType: 'email.delivered',
      eventCreatedAt: '2026-04-19T10:00:00.000Z',
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true, matched: true })
  })

  it('returns received=true for ignored stale events', async () => {
    mocks.verify.mockReturnValueOnce({
      type: 'email.delivered',
      data: { email_id: 're_123' },
    })
    mocks.updateFromWebhook.mockResolvedValueOnce({ updated: false, ignored: true })

    const response = await POST(
      makeRequest('{"type":"email.delivered"}', {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,ok',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
  })

  it('returns matched=false when event has no corresponding message row', async () => {
    mocks.verify.mockReturnValueOnce({
      type: 'email.delivered',
      data: { email_id: 're_missing' },
    })
    mocks.updateFromWebhook.mockResolvedValueOnce({ updated: false, ignored: false })

    const response = await POST(
      makeRequest('{"type":"email.delivered"}', {
        'svix-id': 'msg_1',
        'svix-timestamp': '1710000000',
        'svix-signature': 'v1,ok',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true, matched: false })
  })
})
