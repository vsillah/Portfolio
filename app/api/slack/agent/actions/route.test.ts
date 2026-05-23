import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleSlackAgentAction: vi.fn(),
}))

vi.mock('@/lib/agent-slack-actions', () => ({
  handleSlackAgentAction: mocks.handleSlackAgentAction,
}))

import { POST } from './route'

const ORIGINAL_ENV = process.env

function signedRequest(payload: unknown, secret = 'test-slack-secret', extraHeaders: Record<string, string> = {}) {
  const rawBody = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`

  return new Request('http://localhost/api/slack/agent/actions', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
      ...extraHeaders,
    },
    body: rawBody,
  })
}

describe('POST /api/slack/agent/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, SLACK_SIGNING_SECRET: 'test-slack-secret' }
    mocks.handleSlackAgentAction.mockResolvedValue({
      responseType: 'ephemeral',
      text: 'Approved from Slack.',
    })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects invalid Slack signatures', async () => {
    const response = await POST(signedRequest({ type: 'block_actions' }, 'wrong-secret') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid Slack signature' })
    expect(mocks.handleSlackAgentAction).not.toHaveBeenCalled()
  })

  it('rejects malformed interactive payloads', async () => {
    const rawBody = new URLSearchParams({ payload: '{bad json' }).toString()
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = `v0=${createHmac('sha256', 'test-slack-secret').update(`v0:${timestamp}:${rawBody}`).digest('hex')}`

    const response = await POST(new Request('http://localhost/api/slack/agent/actions', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
      body: rawBody,
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid Slack payload' })
    expect(mocks.handleSlackAgentAction).not.toHaveBeenCalled()
  })

  it('acknowledges Slack retries without running the action again', async () => {
    const response = await POST(signedRequest(
      { type: 'block_actions' },
      'test-slack-secret',
      { 'x-slack-retry-num': '1' },
    ) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      response_type: 'ephemeral',
      text: 'Agent Ops already received this Slack action.',
    })
    expect(mocks.handleSlackAgentAction).not.toHaveBeenCalled()
  })

  it('passes block action payloads to the action service', async () => {
    const payload = {
      type: 'block_actions',
      user: { id: 'U123', username: 'vambah' },
      actions: [{ action_id: 'agent_approval_approve', value: '{"action":"approval.approve","approvalId":"approval-1"}' }],
    }

    const response = await POST(signedRequest(payload) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      response_type: 'ephemeral',
      text: 'Approved from Slack.',
      replace_original: false,
    })
    expect(mocks.handleSlackAgentAction).toHaveBeenCalledWith(payload)
  })
})
