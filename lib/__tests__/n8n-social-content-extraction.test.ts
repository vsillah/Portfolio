import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('triggerSocialContentExtraction', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'false'
    process.env.N8N_SOC001_WEBHOOK_URL = 'https://test.example.com/webhook/social-content-extract'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('includes callbackBaseUrl from N8N_CALLBACK_BASE_URL and preserves optional payload fields', async () => {
    process.env.N8N_CALLBACK_BASE_URL = 'https://dev-tunnel.example.com'
    process.env.PORTFOLIO_BASE_URL = 'https://portfolio.example.com'

    const { triggerSocialContentExtraction } = await import('../n8n')
    await triggerSocialContentExtraction({
      runId: 'run-123',
      meetingRecordId: 'meeting-456',
      prompts: {
        topicExtraction: 'topic',
        copywriting: 'copy',
        imageGeneration: 'image',
      },
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test.example.com/webhook/social-content-extract')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      workflow: 'WF-SOC-001',
      action: 'extract_social_content',
      callbackBaseUrl: 'https://dev-tunnel.example.com',
      run_id: 'run-123',
      meeting_record_id: 'meeting-456',
      prompts: {
        topicExtraction: 'topic',
        copywriting: 'copy',
        imageGeneration: 'image',
      },
    })
    expect(typeof body.triggered_at).toBe('string')
  })

  it('falls back callbackBaseUrl to PORTFOLIO_BASE_URL when N8N_CALLBACK_BASE_URL is unset', async () => {
    delete process.env.N8N_CALLBACK_BASE_URL
    process.env.PORTFOLIO_BASE_URL = 'https://portfolio.example.com'

    const { triggerSocialContentExtraction } = await import('../n8n')
    await triggerSocialContentExtraction()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.callbackBaseUrl).toBe('https://portfolio.example.com')
  })

  it('falls back callbackBaseUrl to production URL when env vars are unset', async () => {
    delete process.env.N8N_CALLBACK_BASE_URL
    delete process.env.PORTFOLIO_BASE_URL

    const { triggerSocialContentExtraction } = await import('../n8n')
    await triggerSocialContentExtraction()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.callbackBaseUrl).toBe('https://amadutown.com')
  })
})
