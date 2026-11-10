import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('lib/n8n sendToN8n and diagnostic fallbacks', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.useRealTimers()
    restoreEnv()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    restoreEnv()
  })

  it('returns smart fallback instead of throwing when chat webhook is missing', async () => {
    setEnv({
      MOCK_N8N: 'false',
      N8N_WEBHOOK_URL: undefined,
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    })

    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({
      message: 'Can you help with services?',
      sessionId: 's1',
    })

    expect(result.escalated).toBe(true)
    expect(result.metadata?.fallback).toBe(true)
    expect(result.metadata?.fallbackReason).toContain('not configured')
    expect(result.response).toContain('https://example.com/services')
  })

  it('retries once for a transient 503 and succeeds on next response', async () => {
    setEnv({
      MOCK_N8N: 'false',
      N8N_WEBHOOK_URL: 'https://example.com/webhook/chat',
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporary outage', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: 'Recovered response', escalated: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const { sendToN8n } = await import('./n8n')
    const pending = sendToN8n({
      message: 'hello',
      sessionId: 's2',
    })

    await vi.advanceTimersByTimeAsync(2_000)
    const result = await pending

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.response).toBe('Recovered response')
    expect(result.escalated).toBe(false)
  })

  it('classifies Cloudflare 1033 as a stale chat route without retrying or logging the route', async () => {
    const webhookUrl = 'private-fixture-path'
    setEnv({ MOCK_N8N: 'false', N8N_WEBHOOK_URL: webhookUrl, NEXT_PUBLIC_SITE_URL: 'https://example.com' })
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      '<html><title>Error 1033</title><p>private-fixture-path</p></html>',
      { status: 530 }
    ))
    vi.stubGlobal('fetch', fetchMock)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({ message: 'What chatbot services does AmaduTown offer?', sessionId: 's-1033' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.escalated).toBe(true)
    expect(result.metadata).toMatchObject({
      fallback: true,
      failureClass: 'stale_webhook_route',
      retriable: true,
    })
    expect(result.metadata?.fallbackReason).toContain('Cloudflare 1033')
    expect(result.response).toContain('AI Customer Support Chatbot')
    expect(result.response).toContain('AI Inbound Lead Chatbot')
    expect(result.response).toContain('/services/1313650b-1afb-44f7-8118-21f05b1ae8a0')
    expect(result.response).toContain('/services/a479ce70-4856-4d3f-917b-c37bfff1f0a2')
    expect(result.response).toContain('schedule a free discovery call')
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-fixture-path')
  })

  it('classifies an unrecognized 530 separately from Cloudflare 1033', async () => {
    setEnv({ MOCK_N8N: 'false', N8N_WEBHOOK_URL: 'fixture-530-route' })
    const fetchMock = vi.fn().mockResolvedValue(new Response('upstream unavailable', { status: 530 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({ message: 'Hello', sessionId: 's-530' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.metadata?.failureClass).toBe('provider_gateway_failure')
    expect(result.metadata?.fallbackReason).toBe('n8n gateway returned 530')
  })

  it('keeps thrown transport details out of logs and fallback receipts', async () => {
    const webhookUrl = 'private-fixture-path'
    setEnv({ MOCK_N8N: 'false', N8N_WEBHOOK_URL: webhookUrl, N8N_MAX_RETRIES: '0' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`fetch failed for ${webhookUrl}`)))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({ message: 'private fixture message', sessionId: 's-network' })

    expect(result.metadata?.fallbackReason).toBe('n8n chat transport failed')
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-fixture-path')
    expect(JSON.stringify(log.mock.calls)).not.toContain('private fixture message')
  })

  it.each([
    ['a generic question', 'Hello there', 'Our chat service isn’t responding right now', undefined],
    ['a general service question', 'What services do you offer?', 'training, speaking, consulting, coaching, and workshops', 'AI Inbound Lead Chatbot'],
    ['a project question', 'Tell me about your projects', '/projects', undefined],
    ['a publication question', 'Show me your publications', '/publications', undefined],
    ['a chatbot buying question', 'I need a chatbot to qualify leads', 'AI Inbound Lead Chatbot', 'AI Customer Support Chatbot'],
  ])('keeps a useful fallback for %s', async (_label, message, expected, otherExpected) => {
    setEnv({ MOCK_N8N: 'false', N8N_WEBHOOK_URL: undefined, NEXT_PUBLIC_SITE_URL: 'https://example.com' })
    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({ message, sessionId: 's-intent' })

    expect(result.response).toContain(expected)
    if (otherExpected) expect(result.response).toContain(otherExpected)
    expect(result.metadata).toMatchObject({ fallback: true, retriable: true })
    expect(result.escalated).toBe(true)
  })

  it('parses n8n results wrapper and merges top-level metadata', async () => {
    setEnv({
      MOCK_N8N: 'false',
      N8N_WEBHOOK_URL: 'https://example.com/webhook/chat',
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          escalated: true,
          metadata: { traceId: 'trace-1' },
          results: [{ result: 'Agent response', metadata: { node: 'ai-agent' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({
      message: 'Need advice',
      sessionId: 's3',
    })

    expect(result.response).toBe('Agent response')
    expect(result.escalated).toBe(true)
    expect(result.metadata).toMatchObject({
      traceId: 'trace-1',
      node: 'ai-agent',
    })
  })

  it('returns fallback for invalid JSON response bodies', async () => {
    setEnv({
      MOCK_N8N: 'false',
      N8N_WEBHOOK_URL: 'https://example.com/webhook/chat',
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('this is not json', { status: 200 }))
    )

    const { sendToN8n } = await import('./n8n')
    const result = await sendToN8n({
      message: 'hello',
      sessionId: 's4',
    })

    expect(result.escalated).toBe(true)
    expect(result.metadata?.fallback).toBe(true)
    expect(result.metadata?.fallbackReason).toContain('not valid JSON')
  })

  it('returns diagnostic fallback when diagnostic webhook is not configured', async () => {
    setEnv({
      MOCK_N8N: 'false',
      N8N_DIAGNOSTIC_WEBHOOK_URL: undefined,
      N8N_WEBHOOK_URL: undefined,
    })

    const { sendDiagnosticToN8n } = await import('./n8n')
    const request = {
      sessionId: 'diag-1',
      message: 'I need an assessment',
      currentCategory: 'business_challenges' as const,
      progress: {
        completedCategories: [],
        questionsAsked: ['q1'],
        responsesReceived: { q1: 'answer' },
      },
    }
    const result = await sendDiagnosticToN8n(request)

    expect(result.isComplete).toBe(false)
    expect(result.currentCategory).toBe('business_challenges')
    expect(result.progress).toEqual(request.progress)
    expect(result.metadata?.fallback).toBe(true)
  })
})
