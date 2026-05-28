import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runAgentSlackNotificationSweep: vi.fn(),
}))

vi.mock('@/lib/agent-slack-notification-sweep', () => ({
  PROACTIVE_SLACK_NOTIFICATION_RULES: [
    { kind: 'pending_approvals', triggerModes: ['immediate', 'scheduled'] },
    { kind: 'blockers', triggerModes: ['scheduled'] },
    { kind: 'stale_runs', triggerModes: ['scheduled'] },
    { kind: 'review_ready', triggerModes: ['scheduled'] },
    { kind: 'goal_decisions', triggerModes: ['immediate', 'scheduled'] },
  ],
  runAgentSlackNotificationSweep: mocks.runAgentSlackNotificationSweep,
}))

import { GET, POST } from './route'

const ORIGINAL_ENV = process.env

function request(method: 'GET' | 'POST', token?: string, body?: Record<string, unknown>, url = 'http://localhost/api/cron/agent-ops-slack-notifications') {
  return new NextRequest(url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/cron/agent-ops-slack-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: 'cron-secret',
      N8N_INGEST_SECRET: 'n8n-secret',
    }
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({
      ok: true,
      dryRun: false,
      mode: 'scheduled',
      totalRules: 5,
      sentCount: 1,
      dedupedCount: 1,
      skippedCount: 3,
      errorCount: 0,
      itemCount: 2,
      results: [],
    })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects unauthenticated cron requests', async () => {
    const response = await GET(request('GET') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runAgentSlackNotificationSweep).not.toHaveBeenCalled()
  })

  it('runs the proactive sweep from Vercel cron', async () => {
    const response = await GET(request('GET', 'cron-secret') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      sentCount: 1,
      side_effects: {
        slack_messages_sent: 1,
        production_mutation_allowed: false,
      },
    })
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'scheduled',
      actorLabel: 'Vercel cron',
      triggerSource: 'vercel_cron_agent_ops_slack_notifications',
    }))
  })

  it('supports manual dry-run slices with selected rule kinds', async () => {
    const response = await POST(request('POST', 'n8n-secret', {
      dry_run: true,
      force: true,
      mode: 'immediate',
      kinds: ['stale_runs', 'blockers', 'publish_everything'],
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      force: true,
      mode: 'immediate',
      kinds: ['stale_runs', 'blockers'],
      actorLabel: 'Manual cron trigger',
      triggerSource: 'manual_cron_agent_ops_slack_notifications',
    }))
  })

  it('returns a failing status when one or more rules fail', async () => {
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({
      ok: false,
      dryRun: false,
      totalRules: 1,
      sentCount: 0,
      dedupedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      itemCount: 0,
      results: [{ kind: 'blockers', error: 'database unavailable' }],
    })

    const response = await GET(request('GET', 'cron-secret') as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, errorCount: 1 })
  })
})
