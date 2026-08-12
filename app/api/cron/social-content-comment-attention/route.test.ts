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
    delete process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED
    mocks.runAgentSlackNotificationSweep.mockImplementation(async (input: { dryRun?: boolean }) => ({
      ok: true,
      dryRun: Boolean(input.dryRun),
      mode: 'scheduled',
      totalRules: 1,
      sentCount: input.dryRun ? 0 : 1,
      dedupedCount: 0,
      skippedCount: input.dryRun ? 1 : 0,
      errorCount: 0,
      itemCount: 1,
      results: [],
    }))
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

  it('defaults scheduled GET to activation-disabled dry run with no Slack delivery or external replies', async () => {
    const response = await GET(request('http://localhost/api/cron/social-content-comment-attention?limit=10') as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith({
      kinds: ['social_comment_attention_due'],
      mode: 'scheduled',
      dryRun: true,
      force: false,
      actorLabel: 'Vercel cron',
      triggerSource: 'vercel_cron_social_content_comment_attention',
    })
    expect(mocks.evaluateSocialCommentReplyHolds).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dry_run: true,
      activation: {
        enabled: false,
        disabled: true,
        reason: 'activation_disabled_default_off',
        force_applied: false,
      },
      side_effects: {
        slack_messages_sent: 0,
        reply_hold_state_updated: false,
        provider_generation: false,
        provider_refresh: false,
        external_reply_send: false,
        external_post: false,
      },
    })
  })

  it('runs activated Slack sweep and hold evaluation without enabling external replies', async () => {
    process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED = 'true'

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
      dry_run: false,
      activation: {
        enabled: true,
        disabled: false,
        reason: 'enabled',
      },
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

  it('does not let force bypass the default-off activation gate', async () => {
    const response = await POST(request('http://localhost/api/cron/social-content-comment-attention', 'POST', {
      force: true,
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      force: false,
      actorLabel: 'Manual cron trigger',
      triggerSource: 'manual_cron_social_content_comment_attention',
    }))
    expect(mocks.evaluateSocialCommentReplyHolds).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      dry_run: true,
      activation: {
        enabled: false,
        disabled: true,
        reason: 'activation_disabled_default_off',
        force_requested: true,
        force_applied: false,
      },
      side_effects: {
        slack_messages_sent: 0,
        reply_hold_state_updated: false,
        external_reply_send: false,
      },
    })
  })

  it('supports dry-run POST slices without evaluating hold mutations', async () => {
    process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED = 'true'

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
