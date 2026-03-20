import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TEST_WEBHOOK_URL = 'https://test.example.com/webhook/diag-completion'

describe('triggerDiagnosticCompletionWebhook', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL = TEST_WEBHOOK_URL
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.MOCK_N8N = 'false'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('sends diagnosticAuditId, diagnosticData, and contactInfo', async () => {
    const { triggerDiagnosticCompletionWebhook } = await import('../n8n')

    const diagnosticData = {
      business_challenges: { pain: 'manual processes' },
      tech_stack: { crm: 'Salesforce' },
      automation_needs: { priority: 'high' },
      ai_readiness: { score: 7 },
      budget_timeline: { range: '$10k-$25k' },
      decision_making: { authority: 'CTO' },
    }

    await triggerDiagnosticCompletionWebhook(
      'audit-abc-123',
      diagnosticData,
      { email: 'cto@corp.com', name: 'Jane Doe', company: 'Corp Inc' }
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(TEST_WEBHOOK_URL)

    const body = JSON.parse(init.body)
    expect(body.diagnosticAuditId).toBe('audit-abc-123')
    expect(body.diagnosticData).toMatchObject(diagnosticData)
    expect(body.contactInfo).toMatchObject({ email: 'cto@corp.com', name: 'Jane Doe' })
    expect(body.source).toBe('chat_diagnostic')
    expect(body.completedAt).toBeDefined()
  })

  it('skips when N8N_DISABLE_OUTBOUND=true', async () => {
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    const { triggerDiagnosticCompletionWebhook } = await import('../n8n')

    await triggerDiagnosticCompletionWebhook('audit-x', {
      business_challenges: {},
      tech_stack: {},
      automation_needs: {},
      ai_readiness: {},
      budget_timeline: {},
      decision_making: {},
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('falls back to N8N_LEAD_WEBHOOK_URL when completion URL is unset', async () => {
    delete process.env.N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL
    process.env.N8N_LEAD_WEBHOOK_URL = 'https://test.example.com/webhook/lead-fallback'
    const { triggerDiagnosticCompletionWebhook } = await import('../n8n')

    await triggerDiagnosticCompletionWebhook('audit-fb', {
      business_challenges: {},
      tech_stack: {},
      automation_needs: {},
      ai_readiness: {},
      budget_timeline: {},
      decision_making: {},
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.example.com/webhook/lead-fallback')
  })
})
