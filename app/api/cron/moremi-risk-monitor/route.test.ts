import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runMoremiRiskSignalMonitor: vi.fn(),
}))

vi.mock('@/lib/moremi-risk-signal-monitor', () => ({
  runMoremiRiskSignalMonitor: mocks.runMoremiRiskSignalMonitor,
}))

import { GET, POST } from './route'

function request(method: 'GET' | 'POST', token?: string) {
  return new Request('http://localhost/api/cron/moremi-risk-monitor', {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe('/api/cron/moremi-risk-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = 'n8n-secret'
    mocks.runMoremiRiskSignalMonitor.mockResolvedValue({
      runId: 'moremi-run-1',
      generatedAt: '2026-05-12T12:00:00.000Z',
      overall: 'warning',
      enabledSourceFeedCount: 5,
      disabledSourceFeedCount: 1,
      warnings: ['No enabled source feed currently covers vendor_incident.'],
      summaryMarkdown: '# Moremi AI Risk Signal Monitor',
    })
  })

  it('rejects unauthenticated cron requests', async () => {
    const response = await POST(request('POST', 'wrong') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runMoremiRiskSignalMonitor).not.toHaveBeenCalled()
  })

  it('runs from Vercel cron GET with CRON_SECRET', async () => {
    const response = await GET(request('GET', 'cron-secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'moremi-run-1',
      overall: 'warning',
      enabled_source_feed_count: 5,
      disabled_source_feed_count: 1,
      warnings: ['No enabled source feed currently covers vendor_incident.'],
      summary_markdown: '# Moremi AI Risk Signal Monitor',
      side_effects: {
        work_items_created: false,
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
      },
    })
    expect(mocks.runMoremiRiskSignalMonitor).toHaveBeenCalledWith('vercel_cron_moremi_risk_monitor')
  })

  it('keeps an n8n/manual POST trigger path available', async () => {
    const response = await POST(request('POST', 'n8n-secret') as never)

    expect(response.status).toBe(200)
    expect(mocks.runMoremiRiskSignalMonitor).toHaveBeenCalledWith('manual_cron_moremi_risk_monitor')
  })
})
