import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TEST_WEBHOOK_URL = 'https://test.example.com/webhook/lead-qual-uuid'

describe('triggerLeadQualificationWebhook', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.N8N_LEAD_WEBHOOK_URL = TEST_WEBHOOK_URL
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'false'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends correct payload shape to the configured webhook URL', async () => {
    const { triggerLeadQualificationWebhook } = await import('../n8n')

    const payload = {
      name: 'Test Lead',
      email: 'test@example.com',
      company: 'Test Corp',
      domain: 'testcorp.com',
      linkedinUrl: 'https://linkedin.com/in/test',
      message: 'Interested in AI services',
      submissionId: 'sub-123',
      submittedAt: '2026-03-20T00:00:00.000Z',
      source: 'portfolio_contact_form',
    }

    await triggerLeadQualificationWebhook(payload)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_WEBHOOK_URL)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      name: 'Test Lead',
      email: 'test@example.com',
      submissionId: 'sub-123',
      source: 'portfolio_contact_form',
    })
  })

  it('skips fetch when N8N_DISABLE_OUTBOUND=true', async () => {
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    const { triggerLeadQualificationWebhook } = await import('../n8n')

    await triggerLeadQualificationWebhook({
      name: 'Test',
      email: 'x@x.com',
      submissionId: 'sub-456',
      submittedAt: '2026-03-20T00:00:00.000Z',
      source: 'test',
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips fetch when URL is not configured', async () => {
    delete process.env.N8N_LEAD_WEBHOOK_URL
    const { triggerLeadQualificationWebhook } = await import('../n8n')

    await triggerLeadQualificationWebhook({
      name: 'Test',
      email: 'x@x.com',
      submissionId: 'sub-789',
      submittedAt: '2026-03-20T00:00:00.000Z',
      source: 'test',
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not throw on webhook failure (fire-and-forget)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })
    const { triggerLeadQualificationWebhook } = await import('../n8n')

    await expect(
      triggerLeadQualificationWebhook({
        name: 'Test',
        email: 'x@x.com',
        submissionId: 'sub-err',
        submittedAt: '2026-03-20T00:00:00.000Z',
        source: 'test',
      })
    ).resolves.toBeUndefined()
  })
})
