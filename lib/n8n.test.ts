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
