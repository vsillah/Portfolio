import { describe, expect, it, vi } from 'vitest'
import { runSocialCommentAttentionYouTubeRefresh } from '@/lib/social-comment-attention-refresh'
import type { YouTubeCommentRefreshInput, YouTubeCommentRefreshResult } from '@/lib/youtube-comment-ingestion'
import type { MetaCommentRefreshInput, MetaCommentRefreshResult } from '@/lib/meta-comment-ingestion'

type TableRows = Record<string, Array<Record<string, unknown>>>

class Query {
  private filters: Array<(row: Record<string, unknown>) => boolean> = []
  private orders: Array<{ column: string; ascending: boolean }> = []
  private maxRows: number | null = null

  constructor(private rows: Array<Record<string, unknown>>) {}

  select() {
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  in(column: string, values: unknown[]) {
    const accepted = new Set(values)
    this.filters.push((row) => accepted.has(row[column]))
    return this
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending !== false })
    return this
  }

  limit(value: number) {
    this.maxRows = value
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[]; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected)
  }

  private execute() {
    let data = [...this.rows]
    for (const filter of this.filters) data = data.filter(filter)
    for (const order of [...this.orders].reverse()) {
      data.sort((a, b) => {
        const left = String(a[order.column] ?? '')
        const right = String(b[order.column] ?? '')
        return order.ascending ? left.localeCompare(right) : right.localeCompare(left)
      })
    }
    if (this.maxRows !== null) data = data.slice(0, this.maxRows)
    const errorRow = data.find((row) => typeof row.__error === 'string')
    if (errorRow) {
      return {
        data: [],
        error: { message: String(errorRow.__error) },
      }
    }
    return { data, error: null }
  }
}

function createDb(rows: TableRows) {
  return {
    from: vi.fn((table: string) => new Query(rows[table] ?? [])),
  }
}

function publish(id: string, publishedAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    content_id: `content-${id}`,
    platform: 'youtube',
    status: 'published',
    platform_post_id: `video-${id}`.padEnd(11, 'x').slice(0, 11),
    platform_post_url: null,
    published_at: publishedAt,
    created_at: publishedAt,
    ...extra,
  }
}

function succeeded(input: YouTubeCommentRefreshInput): YouTubeCommentRefreshResult {
  return {
    platform: 'youtube',
    provider: 'youtube_data_api',
    status: 'succeeded',
    publishId: input.publishId ?? null,
    contentId: input.contentId ?? null,
    videoId: 'abc123DEF45',
    runId: `run-${input.publishId}`,
    fetched: 1,
    upserted: 1,
    skipped: 0,
    errors: [],
    cursor: {},
  }
}

function metaSucceeded(input: MetaCommentRefreshInput): MetaCommentRefreshResult {
  return {
    platform: input.platform,
    provider: 'meta_graph',
    status: 'succeeded',
    publishId: input.publishId ?? null,
    contentId: input.contentId ?? null,
    objectId: 'meta-object-1',
    runId: `run-${input.platform}-${input.publishId}`,
    fetched: 1,
    upserted: 1,
    skipped: 0,
    errors: [],
    cursor: {},
  }
}

function capability(platform: 'facebook' | 'instagram', verified = true) {
  return {
    platform,
    capability_status: verified ? 'verified' : 'manual',
    supports_comment_ingestion: verified,
    gate_notes: verified ? 'Read-only comment ingestion verified.' : 'Awaiting read-only smoke.',
  }
}

describe('runSocialCommentAttentionYouTubeRefresh', () => {
  it('selects bounded recent and unresolved YouTube publishes with cooldown skips', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('recent-a', '2026-08-13T12:00:00.000Z'),
        publish('recent-b', '2026-08-13T11:00:00.000Z'),
        publish('recent-c', '2026-08-13T10:00:00.000Z'),
        publish('old-unresolved', '2026-08-01T12:00:00.000Z'),
        publish('old-resolved', '2026-08-01T11:00:00.000Z'),
      ],
      social_content_comments: [
        {
          publish_id: 'old-unresolved',
          platform: 'youtube',
          classification_status: 'needs_response',
          status: 'visible',
          updated_at: '2026-08-13T12:30:00.000Z',
        },
      ],
      social_comment_ingestion_runs: [
        {
          publish_id: 'recent-a',
          platform: 'youtube',
          status: 'succeeded',
          started_at: '2026-08-13T12:50:00.000Z',
        },
      ],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      publishLimit: 3,
      candidateLimit: 2,
      commentLimit: 25,
      refreshCooldownMinutes: 15,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      selectedCount: 3,
      attemptedCount: 2,
      skippedCooldownCount: 1,
      succeededCount: 2,
      commentLimit: 25,
    })
    expect(result.outcomes.map((outcome) => [outcome.publishId, outcome.selectedReason, outcome.status])).toEqual([
      ['old-unresolved', 'unresolved_activity', 'succeeded'],
      ['recent-a', 'recently_published', 'skipped'],
      ['recent-b', 'recently_published', 'succeeded'],
    ])
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({
      publishId: 'old-unresolved',
      contentId: 'content-old-unresolved',
      limit: 25,
    }))
  })

  it('includes old unresolved publishes outside the bounded recent candidate set', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('newest-a', '2026-08-13T12:00:00.000Z'),
        publish('newest-b', '2026-08-13T11:00:00.000Z'),
        publish('old-unresolved', '2026-07-01T12:00:00.000Z'),
      ],
      social_content_comments: [
        {
          publish_id: 'old-unresolved',
          platform: 'youtube',
          classification_status: 'needs_response',
          status: 'visible',
          updated_at: '2026-08-13T12:30:00.000Z',
        },
      ],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      publishLimit: 3,
      candidateLimit: 2,
      recentPublishedHours: 24,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result.outcomes.map((outcome) => [outcome.publishId, outcome.selectedReason])).toEqual([
      ['old-unresolved', 'unresolved_activity'],
      ['newest-a', 'recently_published'],
      ['newest-b', 'recently_published'],
    ])
    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({
      publishId: 'old-unresolved',
    }))
  })

  it('returns zero-row success without calling the provider adapter', async () => {
    const db = createDb({
      social_content_publishes: [],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result).toMatchObject({
      ok: true,
      status: 'succeeded',
      selectedCount: 0,
      attemptedCount: 0,
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('deduplicates unresolved comment activity by publish before refresh', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('publish-1', '2026-08-13T12:00:00.000Z'),
      ],
      social_content_comments: [
        { publish_id: 'publish-1', platform: 'youtube', classification_status: 'needs_response', status: 'visible', updated_at: '2026-08-13T12:00:00.000Z' },
        { publish_id: 'publish-1', platform: 'youtube', classification_status: 'blocked', status: 'visible', updated_at: '2026-08-13T12:01:00.000Z' },
      ],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result.selectedCount).toBe(1)
    expect(result.outcomes[0]).toMatchObject({
      publishId: 'publish-1',
      selectedReason: 'unresolved_activity',
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(expect.not.objectContaining({
      approvedReplyText: expect.anything(),
      replyText: expect.anything(),
    }))
  })

  it('selects an eight-day-old campaign publish under the default watch window', async () => {
    const verifiedPublishId = '16aebaf3-251f-42c4-8fcf-00d3899f8a5e'
    const db = createDb({
      social_content_publishes: [
        publish(verifiedPublishId, '2026-08-05T13:07:29.000Z', {
          content_id: '41ddfcdf-e4ad-4b4f-a9ef-6f5860c06b91',
          platform_post_id: 'abc123DEF45',
          platform_post_url: 'https://www.youtube.com/watch?v=abc123DEF45',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:07:29.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result).toMatchObject({
      selectedCount: 1,
      attemptedCount: 1,
      succeededCount: 1,
    })
    expect(result.outcomes[0]).toMatchObject({
      publishId: verifiedPublishId,
      contentId: '41ddfcdf-e4ad-4b4f-a9ef-6f5860c06b91',
      selectedReason: 'recently_published',
    })
  })

  it('keeps token and scope blockers manual without marking provider writes', async () => {
    const db = createDb({
      social_content_publishes: [publish('publish-1', '2026-08-13T12:00:00.000Z')],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput): Promise<YouTubeCommentRefreshResult> => ({
      platform: 'youtube',
      provider: 'youtube_data_api',
      status: 'manual_blocked',
      publishId: input.publishId ?? null,
      contentId: input.contentId ?? null,
      videoId: 'abc123DEF45',
      runId: 'run-blocked',
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [{ code: 'youtube_scope_missing', message: 'Reconnect YouTube with comment read scopes.' }],
      cursor: {},
      blockedReason: 'Reconnect YouTube with comment read scopes.',
    }))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result).toMatchObject({
      ok: true,
      status: 'manual_blocked',
      manualBlockedCount: 1,
      failedCount: 0,
    })
    expect(result.outcomes[0]).toMatchObject({
      status: 'manual_blocked',
      blockedReason: 'Reconnect YouTube with comment read scopes.',
    })
  })

  it('continues after provider failures and exposes partial failure counts', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('publish-1', '2026-08-13T12:00:00.000Z'),
        publish('publish-2', '2026-08-13T11:00:00.000Z'),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => {
      if (input.publishId === 'publish-1') throw new Error('YouTube quota temporarily unavailable')
      return succeeded(input)
    })

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      publishLimit: 2,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result).toMatchObject({
      ok: true,
      status: 'partial',
      attemptedCount: 2,
      succeededCount: 1,
      failedCount: 1,
    })
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['failed', 'succeeded'])
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('keeps manual dry runs selection-only without adapter calls', async () => {
    const db = createDb({
      social_content_publishes: [publish('publish-1', '2026-08-13T12:00:00.000Z')],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      dryRun: true,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result).toMatchObject({
      dryRun: true,
      selectedCount: 1,
      attemptedCount: 0,
    })
    expect(result.outcomes[0]).toMatchObject({
      status: 'skipped',
      skippedReason: 'dry_run',
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('selects verified Facebook publishes and delegates to the Meta adapter once', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('fb-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: '123_456',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [capability('facebook')],
    })
    const youtubeRefresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: youtubeRefresh,
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result.providerSummaries.facebook).toMatchObject({
      selectedCount: 1,
      attemptedCount: 1,
      succeededCount: 1,
    })
    expect(metaRefresh).toHaveBeenCalledTimes(1)
    expect(metaRefresh).toHaveBeenCalledWith({
      db,
      platform: 'facebook',
      publishId: 'fb-publish-1',
      contentId: 'content-fb-publish-1',
      limit: 50,
    })
    expect(youtubeRefresh).not.toHaveBeenCalled()
  })

  it('selects verified Instagram publishes and delegates independently', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('ig-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'instagram',
          platform_post_id: '17900000000000000',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [capability('instagram')],
    })
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input)),
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result.providerSummaries.instagram).toMatchObject({
      selectedCount: 1,
      attemptedCount: 1,
      succeededCount: 1,
    })
    expect(metaRefresh).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'instagram',
      publishId: 'ig-publish-1',
    }))
  })

  it('reports manual Meta capability as skipped blocked evidence without provider calls', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('fb-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: '123_456',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [capability('facebook', false)],
    })
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input)),
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result.providerSummaries.facebook).toMatchObject({
      status: 'manual_blocked',
      selectedCount: 1,
      attemptedCount: 0,
      capabilityBlockedCount: 1,
    })
    expect(result.providerSummaries.facebook.outcomes[0]).toMatchObject({
      platform: 'facebook',
      status: 'skipped',
      skippedReason: 'capability_blocked',
      errorCount: 1,
    })
    expect(metaRefresh).not.toHaveBeenCalled()
  })

  it('honors Meta cooldown dedupe before provider calls', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('fb-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: '123_456',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [{
        publish_id: 'fb-publish-1',
        platform: 'facebook',
        status: 'succeeded',
        started_at: '2026-08-13T12:55:00.000Z',
      }],
      social_comment_provider_capabilities: [capability('facebook')],
    })
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      refreshCooldownMinutes: 15,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input)),
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result.providerSummaries.facebook).toMatchObject({
      selectedCount: 1,
      attemptedCount: 0,
      skippedCooldownCount: 1,
    })
    expect(metaRefresh).not.toHaveBeenCalled()
  })

  it('keeps dry-run Meta selection free of provider calls', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('fb-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: '123_456',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [capability('facebook')],
    })
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      dryRun: true,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input)),
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result.providerSummaries.facebook).toMatchObject({
      dryRun: true,
      selectedCount: 1,
      attemptedCount: 0,
    })
    expect(result.providerSummaries.facebook.outcomes[0]).toMatchObject({
      skippedReason: 'dry_run',
    })
    expect(metaRefresh).not.toHaveBeenCalled()
  })

  it('keeps Facebook failure isolated from Instagram and YouTube refreshes', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('yt-publish-1', '2026-08-13T12:00:00.000Z'),
        publish('fb-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: '123_456',
        }),
        publish('ig-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'instagram',
          platform_post_id: '17900000000000000',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [capability('facebook'), capability('instagram')],
    })
    const youtubeRefresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => {
      if (input.platform === 'facebook') throw new Error('Facebook provider unavailable')
      return metaSucceeded(input)
    })

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      publishLimit: 1,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: youtubeRefresh,
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result).toMatchObject({
      status: 'partial',
      attemptedCount: 3,
      providerReadAttemptCount: 3,
      succeededCount: 2,
      failedCount: 1,
    })
    expect(result.providerSummaries.facebook.failedCount).toBe(1)
    expect(result.providerSummaries.instagram.succeededCount).toBe(1)
    expect(result.providerSummaries.youtube.succeededCount).toBe(1)
    expect(youtubeRefresh).toHaveBeenCalledTimes(1)
    expect(metaRefresh).toHaveBeenCalledTimes(2)
  })

  it('keeps Facebook setup read failures isolated from Instagram and YouTube refreshes', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('yt-publish-1', '2026-08-13T12:00:00.000Z'),
        publish('fb-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: '123_456',
        }),
        publish('ig-publish-1', '2026-08-13T12:00:00.000Z', {
          platform: 'instagram',
          platform_post_id: '17900000000000000',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [
        { ...capability('facebook'), __error: 'capability read failed' },
        capability('instagram'),
      ],
    })
    const youtubeRefresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      publishLimit: 1,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: youtubeRefresh,
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result).toMatchObject({
      status: 'partial',
      attemptedCount: 3,
      providerReadAttemptCount: 2,
      succeededCount: 2,
      failedCount: 1,
    })
    expect(result.providerSummaries.facebook).toMatchObject({
      status: 'failed',
      selectedCount: 1,
      attemptedCount: 1,
      providerReadAttemptCount: 0,
      failedCount: 1,
    })
    expect(result.providerSummaries.facebook.outcomes[0]).toMatchObject({
      platform: 'facebook',
      publishId: null,
      status: 'failed',
      errors: [{
        code: 'facebook_comment_refresh_setup_failed',
        message: 'facebook comment attention refresh setup failed.',
      }],
    })
    expect(result.providerSummaries.instagram.succeededCount).toBe(1)
    expect(result.providerSummaries.youtube.succeededCount).toBe(1)
    expect(youtubeRefresh).toHaveBeenCalledTimes(1)
    expect(metaRefresh).toHaveBeenCalledTimes(1)
    expect(metaRefresh).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'instagram',
      publishId: 'ig-publish-1',
    }))
  })

  it('skips malformed Meta provider identities before adapter invocation', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('fb-missing-id', '2026-08-13T12:00:00.000Z', {
          platform: 'facebook',
          platform_post_id: null,
        }),
        publish('ig-malformed-id', '2026-08-13T11:00:00.000Z', {
          platform: 'instagram',
          platform_post_id: 'not a canonical id',
        }),
      ],
      social_content_comments: [],
      social_comment_ingestion_runs: [],
      social_comment_provider_capabilities: [capability('facebook'), capability('instagram')],
    })
    const metaRefresh = vi.fn(async (input: MetaCommentRefreshInput) => metaSucceeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      publishLimit: 1,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input)),
      refreshPublishedMetaComments: metaRefresh,
    })

    expect(result.providerSummaries.facebook).toMatchObject({
      status: 'manual_blocked',
      selectedCount: 1,
      attemptedCount: 0,
      providerReadAttemptCount: 0,
      identityBlockedCount: 1,
    })
    expect(result.providerSummaries.facebook.outcomes[0]).toMatchObject({
      platform: 'facebook',
      publishId: 'fb-missing-id',
      status: 'skipped',
      skippedReason: 'provider_identity_blocked',
      errorCount: 1,
    })
    expect(result.providerSummaries.instagram).toMatchObject({
      status: 'manual_blocked',
      selectedCount: 1,
      attemptedCount: 0,
      providerReadAttemptCount: 0,
      identityBlockedCount: 1,
    })
    expect(result.providerSummaries.instagram.outcomes[0]).toMatchObject({
      platform: 'instagram',
      publishId: 'ig-malformed-id',
      status: 'skipped',
      skippedReason: 'provider_identity_blocked',
      errorCount: 1,
    })
    expect(metaRefresh).not.toHaveBeenCalled()
  })
})
