import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('triggerSocialContentExtraction', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    process.env = { ...originalEnv }
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'false'
    process.env.N8N_SOC001_WEBHOOK_URL = 'https://example.test/webhook/social-content-extract'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends meeting_record_id and prompts when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '',
    })

    const { triggerSocialContentExtraction } = await import('../n8n')
    const result = await triggerSocialContentExtraction({
      meetingRecordId: 'meeting-123',
      prompts: {
        topicExtraction: 'topic prompt',
        copywriting: 'copy prompt',
        imageGeneration: 'image prompt',
      },
    })

    expect(result).toEqual({
      triggered: true,
      message: 'Social content extraction triggered',
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.test/webhook/social-content-extract')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })

    const payload = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(payload.workflow).toBe('WF-SOC-001')
    expect(payload.action).toBe('extract_social_content')
    expect(payload.meeting_record_id).toBe('meeting-123')
    expect(payload.prompts).toEqual({
      topicExtraction: 'topic prompt',
      copywriting: 'copy prompt',
      imageGeneration: 'image prompt',
    })
    expect(typeof payload.triggered_at).toBe('string')
  })

  it('omits optional fields when no options are provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '',
    })

    const { triggerSocialContentExtraction } = await import('../n8n')
    await triggerSocialContentExtraction()

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>

    expect(payload.meeting_record_id).toBeUndefined()
    expect(payload.prompts).toBeUndefined()
    expect(payload.workflow).toBe('WF-SOC-001')
    expect(payload.action).toBe('extract_social_content')
  })

  it('returns a failed result when webhook responds with non-2xx', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    })

    const { triggerSocialContentExtraction } = await import('../n8n')
    const result = await triggerSocialContentExtraction()

    expect(result).toEqual({
      triggered: false,
      message: 'Webhook returned 502',
    })
  })

  it('returns a failed result when webhook fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    const { triggerSocialContentExtraction } = await import('../n8n')
    const result = await triggerSocialContentExtraction()

    expect(result).toEqual({
      triggered: false,
      message: 'Webhook call failed',
    })
  })

  it('does not call fetch when outbound is disabled', async () => {
    process.env.N8N_DISABLE_OUTBOUND = 'true'

    const { triggerSocialContentExtraction } = await import('../n8n')
    const result = await triggerSocialContentExtraction({ meetingRecordId: 'meeting-123' })

    expect(result).toEqual({
      triggered: false,
      message: 'N8N_DISABLE_OUTBOUND is true',
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
