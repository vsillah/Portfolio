import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runAgentSlackNotificationSweep: vi.fn(),
  evaluateSocialCommentReplyHolds: vi.fn(),
}))

vi.mock('@/lib/agent-slack-notification-sweep', () => ({
  runAgentSlackNotificationSweep: mocks.runAgentSlackNotificationSweep,
}))

vi.mock('@/lib/social-comment-attention', () => ({
  evaluateSocialCommentReplyHolds: mocks.evaluateSocialCommentReplyHolds,
}))

import { GET, POST } from './route'

function request(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: {
      authorization: 'Bearer cron-secret',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/cron/social-content-comment-attention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = ''
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({
      ok: true,
      dryRun: false,
      mode: 'scheduled',
      totalRules: 1,
      sentCount: 1,
      dedupedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      itemCount: 1,
      results: [],
    })
    mocks.evaluateSocialCommentReplyHolds.mockResolvedValue({
      ok: true,
      checkedCount: 2,
      readyForProviderSendCount: 1,
      manualRequiredCount: 1,
      blockedCount: 0,
      waitingHoldCount: 0,
      dataSurfaceReady: true,
      evaluations: [],
    })
  })

  it('rejects unauthenticated requests', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/social-content-comment-attention') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.runAgentSlackNotificationSweep).not.toHaveBeenCalled()
    expect(mocks.evaluateSocialCommentReplyHolds).not.toHaveBeenCalled()
  })

  it('runs comment attention Slack sweep and hold evaluation without external replies', async () => {
    const response = await GET(request('http://localhost/api/cron/social-content-comment-attention?limit=10') as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith({
      kinds: ['social_comment_attention_due'],
      mode: 'scheduled',
      dryRun: false,
      force: false,
      actorLabel: 'Vercel cron',
      triggerSource: 'vercel_cron_social_content_comment_attention',
    })
    expect(mocks.evaluateSocialCommentReplyHolds).toHaveBeenCalledWith(10)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      side_effects: {
        slack_messages_sent: 1,
        reply_hold_state_updated: true,
        provider_generation: false,
        provider_refresh: false,
        external_reply_send: false,
        external_post: false,
      },
    })
  })

  it('supports dry-run POST slices without evaluating hold mutations', async () => {
    const response = await POST(request('http://localhost/api/cron/social-content-comment-attention', 'POST', {
      dry_run: true,
      force: true,
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      force: true,
      actorLabel: 'Manual cron trigger',
      triggerSource: 'manual_cron_social_content_comment_attention',
    }))
    expect(mocks.evaluateSocialCommentReplyHolds).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      dry_run: true,
      side_effects: {
        reply_hold_state_updated: false,
        external_reply_send: false,
      },
    })
  })
})
