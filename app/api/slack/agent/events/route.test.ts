import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleSlackAgentEvent: vi.fn(),
  waitUntil: vi.fn(),
}))

vi.mock('@/lib/agent-slack-events', () => ({
  handleSlackAgentEvent: mocks.handleSlackAgentEvent,
  shouldHandleSlackAgentEvent: (event?: {
    type?: string
    bot_id?: string
    subtype?: string
    user?: string
    channel?: string
    channel_type?: string
  }) => {
    if (!event) return false
    if (event.bot_id || event.subtype) return false
    if (!event.user || !event.channel) return false
    if (event.type === 'app_mention') return true
    return event.type === 'message' && event.channel_type === 'im'
  },
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: mocks.waitUntil,
}))

import { POST } from './route'

const ORIGINAL_ENV = process.env

function signedRequest(body: unknown, secret = 'test-slack-secret', extraHeaders: Record<string, string> = {}) {
  const rawBody = JSON.stringify(body)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`

  return new Request('http://localhost/api/slack/agent/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
      ...extraHeaders,
    },
    body: rawBody,
  })
}

describe('POST /api/slack/agent/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, SLACK_SIGNING_SECRET: 'test-slack-secret' }
    mocks.handleSlackAgentEvent.mockResolvedValue({ handled: true, runId: 'run-123' })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects invalid Slack signatures', async () => {
    const request = signedRequest({ type: 'event_callback' }, 'wrong-secret')

    const response = await POST(request as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid Slack signature' })
    expect(mocks.handleSlackAgentEvent).not.toHaveBeenCalled()
  })

  it('responds to Slack URL verification challenges', async () => {
    const request = signedRequest({ type: 'url_verification', challenge: 'challenge-token' })

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ challenge: 'challenge-token' })
    expect(mocks.waitUntil).not.toHaveBeenCalled()
  })

  it('acknowledges Slack event callbacks and schedules async handling', async () => {
    const payload = {
      type: 'event_callback',
      event_id: 'Ev123',
      event: {
        type: 'app_mention',
        user: 'U123',
        channel: 'C123',
        text: '<@UAGENT> status?',
      },
    }
    const request = signedRequest(payload)

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.handleSlackAgentEvent).toHaveBeenCalledWith(payload)
    expect(mocks.waitUntil).toHaveBeenCalledWith(expect.any(Promise))
  })

  it('acknowledges unsupported channel message events without scheduling work', async () => {
    const payload = {
      type: 'event_callback',
      event_id: 'EvChannelMessage',
      event: {
        type: 'message',
        channel_type: 'channel',
        user: 'U123',
        channel: 'C123',
        text: 'regular channel chatter',
      },
    }
    const request = signedRequest(payload)

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, skipped: 'unsupported_event' })
    expect(mocks.handleSlackAgentEvent).not.toHaveBeenCalled()
    expect(mocks.waitUntil).not.toHaveBeenCalled()
  })

  it('dedupes Slack retries before scheduling event work', async () => {
    const request = signedRequest(
      { type: 'event_callback', event_id: 'Ev123' },
      'test-slack-secret',
      { 'x-slack-retry-num': '1' },
    )

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, skipped: 'slack_retry' })
    expect(mocks.handleSlackAgentEvent).not.toHaveBeenCalled()
    expect(mocks.waitUntil).not.toHaveBeenCalled()
  })
})
