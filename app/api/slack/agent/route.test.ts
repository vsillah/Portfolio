import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleAgentSlackCommand: vi.fn(),
}))

vi.mock('@/lib/agent-slack-command', () => ({
  handleAgentSlackCommand: mocks.handleAgentSlackCommand,
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
    process.env = { ...ORIGINAL_ENV, SLACK_SIGNING_SECRET: 'test-slack-secret' }
    mocks.handleAgentSlackCommand.mockResolvedValue({
      responseType: 'ephemeral',
      text: 'Agent Ops status',
    })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects invalid Slack signatures', async () => {
    const request = signedRequest(new URLSearchParams({ text: 'status' }), 'wrong-secret')

    const response = await POST(request as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid Slack signature' })
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
})
