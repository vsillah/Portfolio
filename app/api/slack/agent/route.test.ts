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
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test', APP_ENV: 'local', NEXT_PUBLIC_APP_ENV: 'local', VERCEL: '', VERCEL_ENV: '', SLACK_SIGNING_SECRET: 'test-slack-secret' }
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
        command: '/agent',
        team_id: 'T_TEST_TEAM',
        has_signature: true,
        has_timestamp: true,
        body_length: expect.any(Number),
      }),
    )
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('legacy-token')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('test-response')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('help')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('vambah')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('C_TEST_CHANNEL')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('U_TEST_USER')
    expect(mocks.handleAgentSlackCommand).not.toHaveBeenCalled()
  })

  it('rejects unsigned production requests when the signing secret is missing', async () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production', APP_ENV: 'production', NEXT_PUBLIC_APP_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', SLACK_SIGNING_SECRET: '' }

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
      teamId: null,
      channelId: null,
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
      teamId: null,
      channelId: null,
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
  it('rejects a signed command from an unlisted operator before dispatch', async () => {
    process.env.SLACK_AGENT_OPS_ALLOWED_USER_IDS = 'U_ALLOWED'
    const response = await POST(signedRequest(new URLSearchParams({ text: 'work assign 1 shaka', user_id: 'U_OTHER' })) as never)
    expect((await response.json()).text).toContain('not configured')
    expect(mocks.handleAgentSlackCommand).not.toHaveBeenCalled()
  })

  it.each(['COTHER', undefined])('rejects hosted channel %s before command dispatch', async (channel) => {
    process.env = { ...process.env, NODE_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'CREVIEW', SLACK_AGENT_OPS_TEAM_ID: 'T1', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123' }
    const fields = new URLSearchParams({ user_id: 'U123', team_id: 'T1', text: 'claim work-1', ...(channel ? { channel_id: channel } : {}) })
    expect((await POST(signedRequest(fields) as never)).status).toBe(403)
    expect(mocks.handleAgentSlackCommand).not.toHaveBeenCalled()
    expect(mocks.waitUntil).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('passes the authorized hosted channel to command dispatch', async () => {
    process.env = { ...process.env, NODE_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'CREVIEW', SLACK_AGENT_OPS_TEAM_ID: 'T1', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123' }
    const fields = new URLSearchParams({ user_id: 'U123', team_id: 'T1', channel_id: 'CREVIEW', text: 'status' })
    expect((await POST(signedRequest(fields) as never)).status).toBe(200)
    expect(mocks.handleAgentSlackCommand).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'CREVIEW' }))
  })

})
