import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runAgentSlackNotificationSweep: vi.fn(),
  runSocialCommentAttentionYouTubeRefresh: vi.fn(),
  evaluateSocialCommentReplyHolds: vi.fn(),
}))

vi.mock('@/lib/agent-slack-notification-sweep', () => ({
  runAgentSlackNotificationSweep: mocks.runAgentSlackNotificationSweep,
}))

vi.mock('@/lib/social-comment-attention', () => ({
  evaluateSocialCommentReplyHolds: mocks.evaluateSocialCommentReplyHolds,
}))

vi.mock('@/lib/social-comment-attention-refresh', () => ({
  runSocialCommentAttentionYouTubeRefresh: mocks.runSocialCommentAttentionYouTubeRefresh,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/youtube-comment-ingestion', () => ({
  refreshPublishedYouTubeComments: vi.fn(),
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
    mocks.runSocialCommentAttentionYouTubeRefresh.mockResolvedValue({
      ok: true,
      status: 'succeeded',
      dryRun: false,
      selectedCount: 1,
      attemptedCount: 1,
      skippedCooldownCount: 0,
      succeededCount: 1,
      partialCount: 0,
      manualBlockedCount: 0,
      failedCount: 0,
      commentLimit: 50,
      publishLimit: 3,
      refreshCooldownMinutes: 15,
      outcomes: [{
        publishId: 'publish-1',
        contentId: 'content-1',
        selectedReason: 'recently_published',
        status: 'succeeded',
        dryRun: false,
        fetched: 1,
        upserted: 1,
        skipped: 0,
        errorCount: 0,
        runId: 'run-1',
        errors: [],
      }],
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
    expect(mocks.runSocialCommentAttentionYouTubeRefresh).not.toHaveBeenCalled()
    expect(mocks.evaluateSocialCommentReplyHolds).not.toHaveBeenCalled()
  })

  it('defaults scheduled GET to disabled Slack delivery while keeping YouTube comment refresh read-only', async () => {
    const response = await GET(request('http://localhost/api/cron/social-content-comment-attention?limit=10&publish_limit=2&comment_limit=25') as never)

    expect(response.status).toBe(200)
    expect(mocks.runSocialCommentAttentionYouTubeRefresh).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      publishLimit: 2,
      commentLimit: 25,
      refreshCooldownMinutes: 15,
      recentPublishedHours: 72,
      force: false,
      dryRun: false,
      refreshPublishedYouTubeComments: expect.any(Function),
    }))
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith({
      kinds: ['social_comment_attention_due'],
      mode: 'scheduled',
      dryRun: true,
      force: false,
      actorLabel: 'Vercel cron',
      triggerSource: 'vercel_cron_social_content_comment_attention',
    })
    expect(mocks.evaluateSocialCommentReplyHolds).toHaveBeenCalledWith(10)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dry_run: false,
      slack_delivery_dry_run: true,
      activation: {
        enabled: false,
        disabled: true,
        reason: 'activation_disabled_default_off',
        force_applied: false,
      },
      youtube_refresh: {
        status: 'succeeded',
        attemptedCount: 1,
      },
      side_effects: {
        slack_messages_sent: 0,
        reply_hold_state_updated: true,
        provider_comment_read: true,
        provider_generation: false,
        provider_refresh: true,
        provider_reply_write: false,
        external_reply_send: false,
        external_post: false,
      },
    })
  })

  it('runs activated Slack sweep and hold evaluation without enabling external replies', async () => {
    process.env.SOCIAL_COMMENT_SLACK_ATTENTION_ENABLED = 'true'

    const response = await GET(request('http://localhost/api/cron/social-content-comment-attention?limit=10') as never)

    expect(response.status).toBe(200)
    expect(mocks.runSocialCommentAttentionYouTubeRefresh).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      dryRun: false,
      force: false,
    }))
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
      slack_delivery_dry_run: false,
      activation: {
        enabled: true,
        disabled: false,
        reason: 'enabled',
      },
      side_effects: {
        slack_messages_sent: 1,
        reply_hold_state_updated: true,
        provider_comment_read: true,
        provider_generation: false,
        provider_refresh: true,
        provider_reply_write: false,
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
    expect(mocks.runSocialCommentAttentionYouTubeRefresh).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      dryRun: false,
      force: true,
    }))
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      force: false,
      actorLabel: 'Manual cron trigger',
      triggerSource: 'manual_cron_social_content_comment_attention',
    }))
    expect(mocks.evaluateSocialCommentReplyHolds).toHaveBeenCalledWith(25)
    await expect(response.json()).resolves.toMatchObject({
      dry_run: false,
      slack_delivery_dry_run: true,
      activation: {
        enabled: false,
        disabled: true,
        reason: 'activation_disabled_default_off',
        force_requested: true,
        force_applied: false,
      },
      side_effects: {
        slack_messages_sent: 0,
        reply_hold_state_updated: true,
        provider_comment_read: true,
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
    expect(mocks.runSocialCommentAttentionYouTubeRefresh).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      dryRun: true,
      force: true,
    }))
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      force: true,
      actorLabel: 'Manual cron trigger',
      triggerSource: 'manual_cron_social_content_comment_attention',
    }))
    expect(mocks.evaluateSocialCommentReplyHolds).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      dry_run: true,
      slack_delivery_dry_run: true,
      side_effects: {
        provider_comment_read: false,
        reply_hold_state_updated: false,
        external_reply_send: false,
      },
    })
  })
})
