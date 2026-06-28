import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { verifySlackSignature } from './slack-signature'

const ORIGINAL_ENV = process.env
const FIXED_NOW_SECONDS = 1_800_000_000
const SIGNING_SECRET = 'test-slack-signing-secret'

function buildRequest({
  body = 'token=legacy&text=status',
  secret = SIGNING_SECRET,
  timestamp = FIXED_NOW_SECONDS.toString(),
  signature,
}: {
  body?: string
  secret?: string
  timestamp?: string
  signature?: string | null
} = {}) {
  const resolvedSignature =
    signature === undefined
      ? `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`
      : signature

  const headers = new Headers()
  if (timestamp !== '') headers.set('x-slack-request-timestamp', timestamp)
  if (resolvedSignature) headers.set('x-slack-signature', resolvedSignature)

  return new Request('http://localhost/api/slack/agent', {
    method: 'POST',
    headers,
    body,
  })
}

describe('verifySlackSignature', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_NOW_SECONDS * 1000))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      VERCEL: '1',
      NEXT_PUBLIC_APP_ENV: 'production',
      SLACK_SIGNING_SECRET: SIGNING_SECRET,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    process.env = ORIGINAL_ENV
  })

  it('accepts a valid Slack signature for a fresh request body', () => {
    const body = new URLSearchParams({ command: '/agent', text: 'status' }).toString()

    expect(verifySlackSignature(buildRequest({ body }) as never, body)).toBe(true)
  })

  it('rejects a tampered body even when the signature was valid for the original body', () => {
    const signedBody = 'text=status'
    const receivedBody = 'text=approvals'

    expect(verifySlackSignature(buildRequest({ body: signedBody }) as never, receivedBody)).toBe(false)
  })

  it('rejects missing signature headers', () => {
    expect(verifySlackSignature(buildRequest({ signature: null }) as never, 'token=legacy&text=status')).toBe(false)
    expect(verifySlackSignature(buildRequest({ timestamp: '' }) as never, 'token=legacy&text=status')).toBe(false)
  })

  it('rejects non-numeric and replay-window timestamps', () => {
    expect(verifySlackSignature(buildRequest({ timestamp: 'not-a-number' }) as never, 'token=legacy&text=status')).toBe(
      false,
    )
    expect(
      verifySlackSignature(
        buildRequest({ timestamp: (FIXED_NOW_SECONDS - 301).toString() }) as never,
        'token=legacy&text=status',
      ),
    ).toBe(false)
  })

  it('rejects production-like requests when the signing secret is missing', () => {
    process.env = {
      ...process.env,
      SLACK_SIGNING_SECRET: '',
      NODE_ENV: 'production',
      VERCEL: '1',
      NEXT_PUBLIC_APP_ENV: 'production',
    }

    expect(verifySlackSignature(buildRequest() as never, 'token=legacy&text=status')).toBe(false)
  })

  it('allows unsigned local development requests when the signing secret is missing', () => {
    process.env = {
      ...process.env,
      SLACK_SIGNING_SECRET: '',
      NODE_ENV: 'test',
      VERCEL: '',
      NEXT_PUBLIC_APP_ENV: 'development',
    }

    expect(verifySlackSignature(buildRequest({ signature: null, timestamp: '' }) as never, 'token=legacy')).toBe(true)
  })
})
