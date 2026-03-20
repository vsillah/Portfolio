import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TEST_WEBHOOK_URL = 'https://test.example.com/webhook/clg-outreach-gen'

describe('triggerOutreachGeneration', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.N8N_CLG002_WEBHOOK_URL = TEST_WEBHOOK_URL
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'false'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends contact_id, score_tier, and lead_score to CLG-002 webhook', async () => {
    const { triggerOutreachGeneration } = await import('../n8n')

    await triggerOutreachGeneration({
      contact_id: 42,
      score_tier: 'hot',
      lead_score: 85,
      sequence_step: 1,
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_WEBHOOK_URL)
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      contact_id: 42,
      score_tier: 'hot',
      lead_score: 85,
      sequence_step: 1,
    })
  })

  it('skips when N8N_DISABLE_OUTBOUND=true', async () => {
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    const { triggerOutreachGeneration } = await import('../n8n')

    await triggerOutreachGeneration({
      contact_id: 1,
      score_tier: 'warm',
      lead_score: 55,
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('falls back to N8N_BASE_URL-derived URL when CLG002 is not set', async () => {
    delete process.env.N8N_CLG002_WEBHOOK_URL
    process.env.N8N_BASE_URL = 'https://test-n8n.example.com'
    const { triggerOutreachGeneration } = await import('../n8n')

    await triggerOutreachGeneration({
      contact_id: 1,
      score_tier: 'warm',
      lead_score: 55,
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('https://test-n8n.example.com/webhook/clg-outreach-gen')
  })
})
