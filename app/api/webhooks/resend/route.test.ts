import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifySignature: vi.fn(),
  updateEmailMessageFromResendWebhook: vi.fn(),
}))

vi.mock('svix', () => ({
  Webhook: class MockWebhook {
    private readonly secret: string

    constructor(secret: string) {
      this.secret = secret
    }

    verify(payload: string, headers: Record<string, string>) {
      return mocks.verifySignature(payload, headers, this.secret)
    }
  },
}))

vi.mock('@/lib/email-messages', () => ({
  updateEmailMessageFromResendWebhook: mocks.updateEmailMessageFromResendWebhook,
}))

import { POST } from './route'

function makeRequest({
  body = '{"ok":true}',
  headers = {},
}: {
  body?: string
  headers?: Record<string, string>
} = {}) {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/webhooks/resend', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, RESEND_WEBHOOK_SECRET: 'whsec_test' }
    vi.clearAllMocks()
    mocks.updateEmailMessageFromResendWebhook.mockResolvedValue({
      updated: true,
      ignored: false,
    })
  })

  it('returns 503 when webhook secret is missing', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET

    const response = await POST(makeRequest() as any)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Not configured' })
    expect(mocks.verifySignature).not.toHaveBeenCalled()
    expect(mocks.updateEmailMessageFromResendWebhook).not.toHaveBeenCalled()
  })

  it('returns 400 when signature headers are missing', async () => {
    const response = await POST(
      makeRequest({
        headers: {
          'content-type': 'application/json',
        },
      }) as any,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Missing signature headers' })
    expect(mocks.verifySignature).not.toHaveBeenCalled()
  })

  it('returns 400 when signature verification fails', async () => {
    mocks.verifySignature.mockImplementationOnce(() => {
      throw new Error('bad signature')
    })

    const response = await POST(
      makeRequest({
        body: '{"type":"email.delivered","data":{"email_id":"em_1"}}',
        headers: {
          'svix-id': 'msg_1',
          'svix-timestamp': '1710000000',
          'svix-signature': 'v1,test',
        },
      }) as any,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid signature' })
    expect(mocks.updateEmailMessageFromResendWebhook).not.toHaveBeenCalled()
  })

  it('acknowledges non-email events without touching Email Center rows', async () => {
    mocks.verifySignature.mockReturnValueOnce({
      type: 'domain.created',
      data: { email_id: 'em_1' },
      created_at: '2026-04-18T10:15:00.000Z',
    })

    const response = await POST(
      makeRequest({
        body: '{"type":"domain.created"}',
        headers: {
          'svix-id': 'msg_2',
          'svix-timestamp': '1710000001',
          'svix-signature': 'v1,test',
        },
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(mocks.updateEmailMessageFromResendWebhook).not.toHaveBeenCalled()
  })

  it('returns matched true when a resend event updates an existing email row', async () => {
    mocks.verifySignature.mockReturnValueOnce({
      type: 'email.delivered',
      data: { email_id: 'em_42' },
      created_at: '2026-04-18T10:20:00.000Z',
    })
    mocks.updateEmailMessageFromResendWebhook.mockResolvedValueOnce({
      updated: true,
      ignored: false,
    })

    const response = await POST(
      makeRequest({
        body: '{"type":"email.delivered"}',
        headers: {
          'svix-id': 'msg_3',
          'svix-timestamp': '1710000002',
          'svix-signature': 'v1,test',
        },
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, matched: true })
    expect(mocks.updateEmailMessageFromResendWebhook).toHaveBeenCalledWith({
      externalId: 'em_42',
      resendEventType: 'email.delivered',
      eventCreatedAt: '2026-04-18T10:20:00.000Z',
    })
  })

  it('returns matched false when no email row matches the provider id', async () => {
    mocks.verifySignature.mockReturnValueOnce({
      type: 'email.delivered',
      data: { email_id: 'missing_email' },
      created_at: '2026-04-18T10:25:00.000Z',
    })
    mocks.updateEmailMessageFromResendWebhook.mockResolvedValueOnce({
      updated: false,
      ignored: false,
    })

    const response = await POST(
      makeRequest({
        body: '{"type":"email.delivered"}',
        headers: {
          'svix-id': 'msg_4',
          'svix-timestamp': '1710000003',
          'svix-signature': 'v1,test',
        },
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true, matched: false })
  })
})
