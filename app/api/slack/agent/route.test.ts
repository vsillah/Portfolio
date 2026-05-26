import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleAgentSlackCommand: vi.fn(),
  waitUntil: vi.fn(),
}))

vi.mock('@/lib/agent-slack-command', () => ({
  handleAgentSlackCommand: mocks.handleAgentSlackCommand,
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: mocks.waitUntil,
}))

import { POST } from './route'

const ORIGINAL_ENV = process.env

function signedRequest(body: URLSearchParams, secret = 'test-slack-secret') {
  const rawBody = body.toString()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`

  return new Request('http://localhost/api/slack/agent', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
    body: rawBody,
  })
}

describe('POST /api/slack/agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    )
    process.env = { ...ORIGINAL_ENV, SLACK_SIGNING_SECRET: 'test-slack-secret' }
    mocks.handleAgentSlackCommand.mockResolvedValue({
      responseType: 'ephemeral',
      text: 'Agent Ops status',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    process.env = ORIGINAL_ENV
  })

  it('rejects invalid Slack signatures', async () => {
    const request = signedRequest(new URLSearchParams({ text: 'status' }), 'wrong-secret')

    const response = await POST(request as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid Slack signature' })
    expect(mocks.handleAgentSlackCommand).not.toHaveBeenCalled()
  })

  it('logs safe Slack app diagnostics for invalid signatures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const request = signedRequest(
      new URLSearchParams({
        api_app_id: 'A_TEST_APP',
        channel_id: 'C_TEST_CHANNEL',
        command: '/agent',
        response_url: 'https://hooks.slack.com/commands/test-response',
        team_domain: 'amadutown',
        team_id: 'T_TEST_TEAM',
        text: 'help',
        token: 'legacy-token',
        user_id: 'U_TEST_USER',
        user_name: 'vambah',
      }),
      'wrong-secret',
    )

    const response = await POST(request as never)

    expect(response.status).toBe(401)
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid Slack agent command signature',
      expect.objectContaining({
        api_app_id: 'A_TEST_APP',
        channel_id: 'C_TEST_CHANNEL',
        command: '/agent',
        team_domain: 'amadutown',
        team_id: 'T_TEST_TEAM',
        user_id: 'U_TEST_USER',
        has_signature: true,
        has_timestamp: true,
        body_length: expect.any(Number),
      }),
    )
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('legacy-token')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('test-response')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('help')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('vambah')
    expect(mocks.handleAgentSlackCommand).not.toHaveBeenCalled()
  })

  it('rejects unsigned production requests when the signing secret is missing', async () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production', VERCEL: '1', SLACK_SIGNING_SECRET: '' }

    const response = await POST(
      new Request('http://localhost/api/slack/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: 'status' }).toString(),
      }) as never,
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid Slack signature' })
    expect(mocks.handleAgentSlackCommand).not.toHaveBeenCalled()
  })

  it('dispatches form-encoded slash command text to the command handler', async () => {
    const request = signedRequest(
      new URLSearchParams({
        text: 'status',
        user_id: 'U123',
        user_name: 'vambah',
      }),
    )

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      response_type: 'ephemeral',
      text: 'Agent Ops status',
    })
    expect(mocks.handleAgentSlackCommand).toHaveBeenCalledWith({
      text: 'status',
      userId: 'U123',
      userName: 'vambah',
    })
  })

  it('returns Block Kit payloads when the command handler supplies mobile actions', async () => {
    mocks.handleAgentSlackCommand.mockResolvedValueOnce({
      responseType: 'ephemeral',
      text: 'Pending approvals',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Pending approvals*' } }],
    })
    const request = signedRequest(
      new URLSearchParams({
        text: 'approvals',
        user_id: 'U123',
        user_name: 'vambah',
      }),
    )

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      response_type: 'ephemeral',
      text: 'Pending approvals',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Pending approvals*' } }],
    })
  })

  it('returns detailed command output directly when it completes inside Slack response window', async () => {
    const request = signedRequest(
      new URLSearchParams({
        text: 'status',
        user_id: 'U123',
        user_name: 'vambah',
        response_url: 'https://hooks.slack.com/commands/test-response',
      }),
    )

    const response = await POST(request as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      response_type: 'ephemeral',
      text: 'Agent Ops status',
    })
    expect(mocks.handleAgentSlackCommand).toHaveBeenCalledWith({
      text: 'status',
      userId: 'U123',
      userName: 'vambah',
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.waitUntil).not.toHaveBeenCalled()
  })

  it('acknowledges Slack before the timeout and schedules delayed delivery when command work is slow', async () => {
    vi.useFakeTimers()
    mocks.handleAgentSlackCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ responseType: 'ephemeral', text: 'Slow status' }), 3000)
        }),
    )

    const request = signedRequest(
      new URLSearchParams({
        text: 'status',
        user_id: 'U123',
        user_name: 'vambah',
        response_url: 'https://hooks.slack.com/commands/test-response',
      }),
    )

    const responsePromise = POST(request as never)
    await vi.advanceTimersByTimeAsync(2500)
    const response = await responsePromise

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      response_type: 'ephemeral',
      text: 'Agent Ops received `/agent status`. I am preparing the result now.',
    })

    expect(mocks.waitUntil).toHaveBeenCalledTimes(1)
    const delayedPromise = mocks.waitUntil.mock.calls[0]?.[0] as Promise<unknown>

    await vi.advanceTimersByTimeAsync(500)
    await delayedPromise

    expect(fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/commands/test-response',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          response_type: 'ephemeral',
          replace_original: false,
          text: 'Slow status',
        }),
      }),
    )
  })
})
