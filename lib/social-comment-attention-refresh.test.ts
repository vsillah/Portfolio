import { describe, expect, it, vi } from 'vitest'
import { runSocialCommentAttentionYouTubeRefresh } from '@/lib/social-comment-attention-refresh'
import type { YouTubeCommentRefreshInput, YouTubeCommentRefreshResult } from '@/lib/youtube-comment-ingestion'

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
    onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
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

describe('runSocialCommentAttentionYouTubeRefresh', () => {
  it('selects bounded recent and unresolved YouTube publishes with cooldown skips', async () => {
    const db = createDb({
      social_content_publishes: [
        publish('recent-a', '2026-08-13T12:00:00.000Z'),
        publish('recent-b', '2026-08-13T11:00:00.000Z'),
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
        publish('publish-1', '2026-08-01T12:00:00.000Z'),
      ],
      social_content_comments: [
        { publish_id: 'publish-1', platform: 'youtube', classification_status: 'needs_response', status: 'visible', updated_at: '2026-08-13T12:00:00.000Z' },
        { publish_id: 'publish-1', platform: 'youtube', classification_status: 'blocked', status: 'visible', updated_at: '2026-08-13T12:01:00.000Z' },
      ],
      social_comment_ingestion_runs: [],
    })
    const refresh = vi.fn(async (input: YouTubeCommentRefreshInput) => succeeded(input))

    const result = await runSocialCommentAttentionYouTubeRefresh(db, {
      recentPublishedHours: 1,
      now: () => new Date('2026-08-13T13:00:00.000Z'),
      refreshPublishedYouTubeComments: refresh,
    })

    expect(result.selectedCount).toBe(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith(expect.not.objectContaining({
      approvedReplyText: expect.anything(),
      replyText: expect.anything(),
    }))
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
})
