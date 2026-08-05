import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runAgentSlackNotificationSweep: vi.fn(),
}))

vi.mock('@/lib/agent-slack-notification-sweep', () => ({
  runAgentSlackNotificationSweep: mocks.runAgentSlackNotificationSweep,
}))

import { GET, POST } from './route'

function request(url: string, method = 'GET') {
  return new NextRequest(url, {
    method,
    headers: { authorization: 'Bearer cron-secret' },
  })
}

describe('/api/cron/social-content-human-gate-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = ''
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({
      ok: true,
      dryRun: true,
      mode: 'scheduled',
      totalRules: 1,
      sentCount: 0,
      dedupedCount: 0,
      skippedCount: 1,
      errorCount: 0,
      itemCount: 1,
      results: [],
    })
  })

  it('rejects unauthenticated requests', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/social-content-human-gate-reminders') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runAgentSlackNotificationSweep).not.toHaveBeenCalled()
  })

  it('runs only the Social Content gate reminder rule', async () => {
    const response = await GET(request('http://localhost/api/cron/social-content-human-gate-reminders?dry_run=1') as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith({
      kinds: ['social_publish_gate_due'],
      mode: 'scheduled',
      dryRun: true,
      force: false,
      actorLabel: 'Vercel cron',
      triggerSource: 'vercel_cron_social_content_human_gate_reminders',
    })
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      side_effects: {
        slack_messages_sent: 0,
        approval_recorded: false,
        provider_generation: false,
        external_schedule: false,
        publish: false,
        external_post: false,
      },
    })
  })

  it('supports forced manual POST runs without changing the action boundary', async () => {
    const response = await POST(new NextRequest('http://localhost/api/cron/social-content-human-gate-reminders', {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret' },
      body: JSON.stringify({ force: true }),
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      force: true,
      actorLabel: 'Manual cron trigger',
      triggerSource: 'manual_cron_social_content_human_gate_reminders',
    }))
  })
})
