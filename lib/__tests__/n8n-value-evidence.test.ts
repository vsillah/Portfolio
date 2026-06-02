import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('n8n value-evidence triggers', () => {
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
    process.env.N8N_CALLBACK_BASE_URL = 'https://portfolio.example.com'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('uses vep-002-social-prod fallback URL and includes run_id/maxResults', async () => {
    process.env.N8N_BASE_URL = 'https://test-n8n.example.com'
    delete process.env.N8N_VEP002_WEBHOOK_URL

    const { triggerSocialListening } = await import('../n8n')

    const result = await triggerSocialListening({
      runId: 'run-123',
      agentRunId: 'agent-run-1',
      maxResults: 10,
      isTestData: true,
    })
    expect(result.triggered).toBe(true)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]

    expect(url).toBe('https://test-n8n.example.com/webhook/vep-002-social-prod')
    expect(init.method).toBe('POST')

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      workflow: 'WF-VEP-002',
      action: 'social_listening_scrape',
      run_id: 'run-123',
      agent_run_id: 'agent-run-1',
      agent_event_callback_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
      maxResults: 10,
      is_test_data: true,
    })
    expect(body.agent_trace).toMatchObject({
      version: 1,
      runtime: 'n8n',
      workflow_id: 'WF-VEP-002',
      events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
    })
    expect(body.agent_callback_contract).toMatchObject({
      version: 1,
      runtime: 'n8n',
      events_url: 'https://portfolio.example.com/api/admin/agents/runs/agent-run-1/events',
      auth_header: 'Authorization: Bearer N8N_INGEST_SECRET',
      required_fields: ['workflow_id', 'stage', 'status'],
      final_completion_payload: {
        workflow_id: 'WF-VEP-002',
        status: 'completed',
        final: true,
      },
      failure_payload: {
        workflow_id: 'WF-VEP-002',
        status: 'failed',
      },
    })
    expect(body.agent_trace.callback_contract).toMatchObject(body.agent_callback_contract)
  })

  it('omits maxResults when not provided', async () => {
    process.env.N8N_BASE_URL = 'https://test-n8n.example.com'
    delete process.env.N8N_VEP002_WEBHOOK_URL

    const { triggerSocialListening } = await import('../n8n')

    await triggerSocialListening({ runId: 'run-456' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(String(init.body))
    expect(body.run_id).toBe('run-456')
    expect(Object.prototype.hasOwnProperty.call(body, 'maxResults')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(body, 'is_test_data')).toBe(false)
  })

  it('prefers explicit N8N_VEP002_WEBHOOK_URL over base URL fallback', async () => {
    process.env.N8N_BASE_URL = 'https://test-n8n.example.com'
    process.env.N8N_VEP002_WEBHOOK_URL = 'https://override.example.com/webhook/custom-vep-002'

    const { triggerSocialListening } = await import('../n8n')

    await triggerSocialListening({ maxResults: 20 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('https://override.example.com/webhook/custom-vep-002')
  })
})
