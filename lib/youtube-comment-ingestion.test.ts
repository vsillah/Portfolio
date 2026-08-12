import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractYouTubeVideoId,
  refreshPublishedYouTubeComments,
} from './youtube-comment-ingestion'

const publish = {
  id: 'publish-youtube-1',
  content_id: 'content-youtube-1',
  platform: 'youtube',
  status: 'published',
  platform_post_id: 'abc123DEF45',
  platform_post_url: 'https://www.youtube.com/watch?v=abc123DEF45',
  published_at: '2026-08-12T10:00:00.000Z',
}

const config = {
  credentials: {
    access_token: 'youtube-access-token',
    refresh_token: 'youtube-refresh-token',
    expires_in: 3600,
    token_obtained_at: '2026-08-12T11:50:00.000Z',
    scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
  },
  settings: { channel_title: 'AmaduTown Automation Solutions' },
  is_active: true,
}

type DbOptions = {
  publishRow?: Record<string, unknown> | null
  configRow?: Record<string, unknown> | null
  insertedRunId?: string
  insertedComments?: unknown[]
}

function createDb(options: DbOptions = {}) {
  const calls = {
    publishFilters: [] as Array<[string, unknown]>,
    runInserts: [] as unknown[],
    runUpdates: [] as unknown[],
    commentUpserts: [] as unknown[],
    commentUpdates: [] as unknown[],
    configUpdates: [] as unknown[],
  }

  function tableResult(table: string, operation: 'select' | 'insert' | 'update' | 'upsert') {
    if (table === 'social_content_publishes') {
      return { data: options.publishRow === undefined ? publish : options.publishRow, error: null }
    }
    if (table === 'social_content_config') {
      return { data: options.configRow === undefined ? config : options.configRow, error: null }
    }
    if (table === 'social_comment_ingestion_runs' && operation === 'insert') {
      return { data: { id: options.insertedRunId ?? 'run-youtube-1' }, error: null }
    }
    if (table === 'social_comment_ingestion_runs' && operation === 'update') {
      return { data: [{ id: options.insertedRunId ?? 'run-youtube-1' }], error: null }
    }
    if (table === 'social_content_comments' && operation === 'upsert') {
      return { data: options.insertedComments ?? [], error: null }
    }
    if (table === 'social_content_comments' && operation === 'update') {
      return { data: [{ id: 'comment-row-1' }], error: null }
    }
    return { data: null, error: null }
  }

  function builder(table: string) {
    let operation: 'select' | 'insert' | 'update' | 'upsert' = 'select'
    const api = {
      select: vi.fn(() => {
        operation = operation === 'insert' || operation === 'update' || operation === 'upsert' ? operation : 'select'
        if (table === 'social_content_comments') return Promise.resolve(tableResult(table, operation))
        return api
      }),
      eq: vi.fn((column: string, value: unknown) => {
        if (table === 'social_content_publishes') calls.publishFilters.push([column, value])
        return api
      }),
      limit: vi.fn(() => api),
      maybeSingle: vi.fn(() => Promise.resolve(tableResult(table, operation))),
      single: vi.fn(() => Promise.resolve(tableResult(table, operation))),
      insert: vi.fn((payload: unknown) => {
        operation = 'insert'
        if (table === 'social_comment_ingestion_runs') calls.runInserts.push(payload)
        return api
      }),
      update: vi.fn((payload: unknown) => {
        operation = 'update'
        if (table === 'social_comment_ingestion_runs') calls.runUpdates.push(payload)
        if (table === 'social_content_comments') calls.commentUpdates.push(payload)
        if (table === 'social_content_config') calls.configUpdates.push(payload)
        return api
      }),
      upsert: vi.fn((payload: unknown) => {
        operation = 'upsert'
        if (table === 'social_content_comments') calls.commentUpserts.push(payload)
        return api
      }),
      then: (resolve: (value: unknown) => void) => resolve(tableResult(table, operation)),
    }
    return api
  }

  return {
    db: { from: vi.fn((table: string) => builder(table)) },
    calls,
  }
}

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch
}

function createFetchMock(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.fn(impl)
}

function thread(commentId: string, text = 'Top-level comment', totalReplyCount = 0) {
  return {
    id: `thread-${commentId}`,
    snippet: {
      videoId: publish.platform_post_id,
      canReply: true,
      totalReplyCount,
      isPublic: true,
      topLevelComment: {
        id: commentId,
        snippet: {
          authorDisplayName: 'Viewer One',
          authorChannelUrl: 'https://www.youtube.com/channel/viewer-1',
          authorChannelId: { value: 'viewer-channel-1' },
          textOriginal: text,
          publishedAt: '2026-08-12T11:00:00.000Z',
          updatedAt: '2026-08-12T11:01:00.000Z',
        },
      },
    },
  }
}

describe('youtube comment ingestion', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts canonical YouTube video ids from publish linkage', () => {
    expect(extractYouTubeVideoId({ platformPostId: 'abc123DEF45' })).toBe('abc123DEF45')
    expect(extractYouTubeVideoId({ platformPostUrl: 'https://youtu.be/abc123DEF45' })).toBe('abc123DEF45')
    expect(extractYouTubeVideoId({ platformPostUrl: 'https://youtube.com/shorts/abc123DEF45' })).toBe('abc123DEF45')
    expect(extractYouTubeVideoId({ platformPostUrl: 'not-a-url' })).toBeNull()
  })

  it('ingests the first commentThreads.list page into canonical comments', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [thread('comment-1', 'Useful question')],
      pageInfo: { totalResults: 1, resultsPerPage: 100 },
    }))

    const result = await refreshPublishedYouTubeComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      publishId: publish.id,
      contentId: publish.content_id,
      videoId: publish.platform_post_id,
      fetched: 1,
      upserted: 1,
    })
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/youtube/v3/commentThreads')
    expect(String(fetchImpl.mock.calls[0][0])).toContain('videoId=abc123DEF45')
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        publish_id: publish.id,
        provider: 'youtube_data_api',
        provider_comment_id: 'comment-1',
        body: 'Useful question',
        reply_submission_state: 'not_applicable',
        provider_capability: expect.objectContaining({
          supports_comment_ingestion: true,
          external_submission_enabled: false,
        }),
      }),
    ])
  })

  it('follows commentThreads.list pagination cursors', async () => {
    const { db } = createDb()
    const fetchImpl = createFetchMock(() => response({ items: [] }))
      .mockImplementationOnce(() => response({ nextPageToken: 'next-page', items: [thread('comment-1')] }))
      .mockImplementationOnce(() => response({ items: [thread('comment-2')] }))

    const result = await refreshPublishedYouTubeComments({ db, contentId: publish.content_id, fetchImpl: asFetch(fetchImpl) })

    expect(result.status).toBe('succeeded')
    expect(result.fetched).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[1][0])).toContain('pageToken=next-page')
    expect(result.cursor).toMatchObject({ threadPages: 2, threadNextPageToken: null })
  })

  it('deduplicates repeated provider comments before canonical upsert', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [
        thread('comment-1', 'First copy'),
        thread('comment-1', 'Refreshed copy'),
      ],
    }))

    await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(calls.commentUpserts[0]).toHaveLength(1)
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({ provider_comment_id: 'comment-1', body: 'Refreshed copy' }),
    ])
  })

  it('loads replies with comments.list and maps provider parent ids without local parent mutation', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ items: [] }))
      .mockImplementationOnce(() => response({ items: [thread('comment-1', 'Parent', 1)] }))
      .mockImplementationOnce(() => response({
        items: [{
          id: 'reply-1',
          snippet: {
            parentId: 'comment-1',
            authorDisplayName: 'Responder',
            authorChannelId: { value: 'responder-channel' },
            textOriginal: 'Reply body',
            publishedAt: '2026-08-12T11:05:00.000Z',
            updatedAt: '2026-08-12T11:06:00.000Z',
          },
        }],
      }))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result.fetched).toBe(2)
    expect(String(fetchImpl.mock.calls[1][0])).toContain('/youtube/v3/comments')
    expect(String(fetchImpl.mock.calls[1][0])).toContain('parentId=comment-1')
    expect(calls.commentUpserts[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider_comment_id: 'reply-1', provider_parent_comment_id: 'comment-1', record_type: 'reply' }),
    ]))
    expect(calls.commentUpdates).toEqual(expect.arrayContaining([
      expect.not.objectContaining({ parent_comment_id: expect.anything() }),
    ]))
  })

  it('records zero-comment success without writing comment rows', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ items: [], pageInfo: { totalResults: 0 } }))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({ status: 'succeeded', fetched: 0, upserted: 0 })
    expect(calls.commentUpserts).toHaveLength(0)
    expect(calls.runUpdates[0]).toMatchObject({
      status: 'succeeded',
      fetched_count: 0,
      inserted_count: 0,
      completed_at: expect.any(String),
    })
  })

  it('captures hidden and deleted-like unavailable threads without enabling replies', async () => {
    const { db, calls } = createDb()
    const hiddenThread = thread('comment-hidden', 'Held privately')
    hiddenThread.snippet.isPublic = false
    const fetchImpl = createFetchMock(() => response({
      items: [
        hiddenThread,
        { id: 'thread-deleted', snippet: { videoId: publish.platform_post_id, totalReplyCount: 0 } },
      ],
    }))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({ status: 'succeeded', fetched: 1, skipped: 1 })
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        provider_comment_id: 'comment-hidden',
        status: 'hidden',
        reply_submission_state: 'not_applicable',
        provider_capability: expect.objectContaining({ external_submission_enabled: false }),
      }),
    ])
  })

  it('blocks without provider calls when no eligible published YouTube row exists', async () => {
    const { db, calls } = createDb({ publishRow: null })
    const fetchImpl = createFetchMock(() => response({ items: [] }))

    const result = await refreshPublishedYouTubeComments({ db, contentId: 'draft-youtube-1', fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      blockedReason: 'No eligible published YouTube row with a canonical provider video ID was selected; reconcile publication first.',
      errors: [expect.objectContaining({ code: 'no_eligible_published_youtube_row' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(calls.runInserts[0]).toMatchObject({
      status: 'manual_blocked',
      content_id: 'draft-youtube-1',
      metadata: expect.objectContaining({ recovery: 'reconcile_youtube_publication' }),
    })
  })

  it('blocks malformed provider video linkage before calling YouTube', async () => {
    const { db } = createDb({
      publishRow: {
        ...publish,
        platform_post_id: null,
        platform_post_url: 'https://example.com/not-youtube',
      },
    })
    const fetchImpl = createFetchMock(() => response({ items: [] }))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      errors: [expect.objectContaining({ code: 'malformed_provider_video_id' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('blocks expired credentials when token refresh cannot recover', async () => {
    vi.stubEnv('YOUTUBE_CLIENT_ID', 'client-id')
    vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'client-secret')
    const expiredConfig = {
      ...config,
      credentials: {
        ...config.credentials,
        token_obtained_at: '2026-08-12T08:00:00.000Z',
        expires_in: 60,
      },
    }
    const { db } = createDb({ configRow: expiredConfig })
    const fetchImpl = createFetchMock(() => response({ error_description: 'invalid_grant' }, 400))

    const result = await refreshPublishedYouTubeComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      errors: [expect.objectContaining({ code: 'token_expired', message: 'invalid_grant' })],
    })
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://oauth2.googleapis.com/token')
  })

  it('surfaces insufficient scope from YouTube Data API', async () => {
    const { db } = createDb()
    const fetchImpl = createFetchMock(() => response({
      error: {
        code: 403,
        message: 'Request had insufficient authentication scopes.',
        errors: [{ reason: 'insufficientPermissions' }],
      },
    }, 403))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({
      status: 'failed',
      errors: [expect.objectContaining({ code: 'insufficient_scope', status: 403 })],
    })
  })

  it('surfaces quota and rate limit errors from YouTube Data API', async () => {
    const { db } = createDb()
    const fetchImpl = createFetchMock(() => response({
      error: {
        code: 403,
        message: 'Quota exceeded.',
        errors: [{ reason: 'quotaExceeded' }],
      },
    }, 403))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({
      status: 'failed',
      errors: [expect.objectContaining({ code: 'quota_or_rate_limited', reason: 'quotaExceeded' })],
    })
  })

  it('surfaces unavailable comment threads from YouTube Data API', async () => {
    const { db } = createDb()
    const fetchImpl = createFetchMock(() => response({
      error: {
        code: 403,
        message: 'The video has comments disabled.',
        errors: [{ reason: 'commentsDisabled' }],
      },
    }, 403))

    const result = await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(result).toMatchObject({
      status: 'failed',
      errors: [expect.objectContaining({ code: 'comments_disabled', reason: 'commentsDisabled' })],
    })
  })

  it('preserves workflow-owned fields on repeated refresh through canonical helper patch semantics', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ items: [thread('comment-1', 'Provider refresh body')] }))

    await refreshPublishedYouTubeComments({ db, publishId: publish.id, fetchImpl: asFetch(fetchImpl) })

    expect(calls.commentUpdates[0]).toMatchObject({
      body: 'Provider refresh body',
      raw_payload: expect.objectContaining({ source: 'youtube_data_api' }),
    })
    expect(calls.commentUpdates[0]).not.toHaveProperty('classification_status')
    expect(calls.commentUpdates[0]).not.toHaveProperty('response_approval_state')
    expect(calls.commentUpdates[0]).not.toHaveProperty('reply_submission_state')
    expect(calls.commentUpdates[0]).not.toHaveProperty('proposed_reply_text')
    expect(calls.commentUpdates[0]).not.toHaveProperty('approved_reply_text')
    expect(calls.commentUpdates[0]).not.toHaveProperty('metadata')
    expect(calls.commentUpdates[0]).not.toHaveProperty('parent_comment_id')
    expect(calls.commentUpdates[0]).not.toHaveProperty('status')
  })
})
