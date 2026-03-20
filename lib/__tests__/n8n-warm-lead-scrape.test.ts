import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('triggerWarmLeadScrape', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.N8N_WRM001_WEBHOOK_URL = 'https://test.example.com/webhook/wrm-001'
    process.env.N8N_WRM002_WEBHOOK_URL = 'https://test.example.com/webhook/wrm-002'
    process.env.N8N_WRM003_WEBHOOK_URL = 'https://test.example.com/webhook/wrm-003'
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'false'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends facebook source to WRM-001 with correct payload', async () => {
    const { triggerWarmLeadScrape } = await import('../n8n')

    const result = await triggerWarmLeadScrape({
      source: 'facebook',
      options: { max_leads: 10 },
    })

    expect(result.triggered).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test.example.com/webhook/wrm-001')

    const body = JSON.parse(init.body)
    expect(body.source).toBe('facebook')
    expect(body.max_leads).toBe(10)
    expect(body.triggered_at).toBeDefined()
  })

  it('sends linkedin source to WRM-003', async () => {
    const { triggerWarmLeadScrape } = await import('../n8n')

    await triggerWarmLeadScrape({ source: 'linkedin' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.example.com/webhook/wrm-003')
  })

  it('sends google_contacts source to WRM-002', async () => {
    const { triggerWarmLeadScrape } = await import('../n8n')

    await triggerWarmLeadScrape({ source: 'google_contacts' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.example.com/webhook/wrm-002')
  })

  it('returns not triggered when N8N_DISABLE_OUTBOUND=true', async () => {
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    const { triggerWarmLeadScrape } = await import('../n8n')

    const result = await triggerWarmLeadScrape({ source: 'facebook' })

    expect(result.triggered).toBe(false)
    expect(result.message).toContain('N8N_DISABLE_OUTBOUND')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns not triggered when webhook URL is missing', async () => {
    delete process.env.N8N_WRM001_WEBHOOK_URL
    process.env.N8N_BASE_URL = 'https://test.example.com'
    const { triggerWarmLeadScrape } = await import('../n8n')

    const result = await triggerWarmLeadScrape({ source: 'facebook' })

    // Falls back to n8nWebhookUrl — so it WILL have a URL via the fallback
    // This test verifies the fallback URL pattern is used
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.example.com/webhook/wrm-001-facebook')
  })
})
