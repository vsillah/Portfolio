import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runAgentOpsMorningReview: vi.fn(),
}))

vi.mock('@/lib/agent-ops-morning-review', () => ({
  runAgentOpsMorningReview: mocks.runAgentOpsMorningReview,
}))

import { POST } from './route'

function makeRequest(token?: string) {
  return new Request('http://localhost/api/cron/agent-ops-morning-review', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe('POST /api/cron/agent-ops-morning-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'secret'
    mocks.runAgentOpsMorningReview.mockResolvedValue({
      runId: 'review-run-1',
      generatedAt: '2026-05-01T09:00:00.000Z',
      overall: 'warning',
      staleSweep: { checked: 2, marked: 1, runIds: ['stale-1'] },
      slackNotified: false,
      summaryMarkdown: '# Agent Ops Morning Review',
      health: {
        warnings: ['1 agent run(s) failed in the last 24 hours'],
      },
    })
  })

  it('requires the n8n ingest secret', async () => {
    const response = await POST(makeRequest('wrong') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runAgentOpsMorningReview).not.toHaveBeenCalled()
  })

  it('runs the morning review and returns the trace summary', async () => {
    const response = await POST(makeRequest('secret') as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'review-run-1',
      overall: 'warning',
      stale_sweep: { checked: 2, marked: 1, runIds: ['stale-1'] },
      slack_notified: false,
      warnings: ['1 agent run(s) failed in the last 24 hours'],
      summary_markdown: '# Agent Ops Morning Review',
    })
    expect(mocks.runAgentOpsMorningReview).toHaveBeenCalledWith('cron_agent_ops_morning_review')
  })
})
