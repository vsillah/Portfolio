import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  runAgentOpsMorningReview: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-ops-morning-review', () => ({
  runAgentOpsMorningReview: mocks.runAgentOpsMorningReview,
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/morning-review', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
  })
}

describe('POST /api/admin/agents/morning-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
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

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runAgentOpsMorningReview).not.toHaveBeenCalled()
  })

  it('runs the morning review through the admin engagement path', async () => {
    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'review-run-1',
      overall: 'warning',
      stale_sweep: { checked: 2, marked: 1, runIds: ['stale-1'] },
      slack_notified: false,
      warnings: ['1 agent run(s) failed in the last 24 hours'],
      summary_markdown: '# Agent Ops Morning Review',
      triggered_by_user_id: 'admin-user',
    })
    expect(mocks.runAgentOpsMorningReview).toHaveBeenCalledWith('admin_agent_ops_morning_review')
  })
})
