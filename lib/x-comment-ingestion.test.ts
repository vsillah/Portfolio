import { describe, expect, it, vi } from 'vitest'
import {
  extractXPostId,
  refreshPublishedXComments,
} from './x-comment-ingestion'

const publish = {
  id: '11111111-1111-4111-8111-111111111111',
  content_id: '22222222-2222-4222-8222-222222222222',
  platform: 'x',
  status: 'published',
  platform_post_id: '2085056671248765116',
  platform_post_url: 'https://x.com/amadutown/status/2085056671248765116',
  published_at: '2026-08-12T10:00:00.000Z',
}

const config = {
  credentials: {
    access_token: 'x-access-token',
    refresh_token: 'x-refresh-token',
    expires_in: 7200,
    token_obtained_at: '2099-01-01T00:00:00.000Z',
    scope: 'tweet.read tweet.write users.read offline.access',
    user_id: '999999',
  },
  settings: {
    profile_handle: 'amadutown',
  },
  is_active: true,
}

const verifiedCapability = {
  capability_status: 'verified',
  supports_comment_ingestion: true,
  supports_reply_draft: true,
  supports_reply_submission: false,
  supports_permalink: true,
  supports_author_profile: true,
  supports_threading: true,
  supports_cursor: true,
  external_submission_enabled: false,
  gate_notes: 'X comment ingestion verified by read-only scope smoke.',
}

const manualCapability = {
  ...verifiedCapability,
  capability_status: 'manual',
  supports_comment_ingestion: false,
  gate_notes: 'X comment ingestion is awaiting read-only scope smoke.',
}

type DbOptions = {
  publishRow?: Record<string, unknown> | null
  configRow?: Record<string, unknown> | null
  capabilityRow?: Record<string, unknown> | null
  capabilityError?: Record<string, unknown> | null
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
  }

  function tableResult(table: string, operation: 'select' | 'insert' | 'update' | 'upsert') {
    if (table === 'social_content_publishes') {
      return { data: options.publishRow === undefined ? publish : options.publishRow, error: null }
    }
    if (table === 'social_content_config') {
      return { data: options.configRow === undefined ? config : options.configRow, error: null }
    }
    if (table === 'social_comment_provider_capabilities') {
      return {
        data: options.capabilityRow === undefined ? verifiedCapability : options.capabilityRow,
        error: options.capabilityError ?? null,
      }
    }
    if (table === 'social_comment_ingestion_runs' && operation === 'insert') {
      return { data: { id: options.insertedRunId ?? 'run-x-1' }, error: null }
    }
    if (table === 'social_comment_ingestion_runs' && operation === 'update') {
      return { data: [{ id: options.insertedRunId ?? 'run-x-1' }], error: null }
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

function tweet(id: string, text = 'Can you share more?', parentId = publish.platform_post_id, authorId = `author-${id}`) {
  return {
    id,
    text,
    author_id: authorId,
    conversation_id: publish.platform_post_id,
    created_at: '2026-08-12T11:00:00.000Z',
    in_reply_to_user_id: '999999',
    referenced_tweets: [{ type: 'replied_to', id: parentId }],
    public_metrics: {
      like_count: 2,
      reply_count: 0,
      repost_count: 0,
      quote_count: 0,
    },
  }
}

function user(id: string, username = `viewer${id}`, name = `Viewer ${id}`) {
  return {
    id: `author-${id}`,
    username,
    name,
    verified: false,
  }
}

function expandedUser(id: string, username: string, name = username) {
  return {
    id,
    username,
    name,
    verified: false,
  }
}

describe('x comment ingestion', () => {
  it('extracts canonical X post ids from publish linkage', () => {
    expect(extractXPostId({ platformPostId: publish.platform_post_id })).toBe(publish.platform_post_id)
    expect(extractXPostId({ platformPostUrl: publish.platform_post_url })).toBe(publish.platform_post_id)
    expect(extractXPostId({ platformPostUrl: 'https://twitter.com/amadutown/status/2085056671248765116' })).toBe(publish.platform_post_id)
    expect(extractXPostId({ platformPostId: 'not-a-post-id' })).toBeNull()
    expect(extractXPostId({ platformPostUrl: 'https://x.com/amadutown/status/not-a-post-id' })).toBeNull()
  })

  it('blocks on canonical manual X capability without a provider call', async () => {
    const { db, calls } = createDb({ capabilityRow: manualCapability })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      postId: publish.platform_post_id,
      errors: [expect.objectContaining({ code: 'x_comment_ingestion_capability_blocked' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(calls.commentUpserts).toEqual([])
    expect(calls.runInserts[0]).toEqual(expect.objectContaining({
      platform: 'x',
      provider: 'x_api',
      status: 'manual_blocked',
      metadata: expect.objectContaining({
        recovery: 'verify_x_comment_ingestion_capability',
        external_submission_enabled: false,
      }),
    }))
  })

  it('uses recent-search conversation_id with GET only while excluding root and owner-authored thread posts', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      data: [
        tweet(publish.platform_post_id, 'Root should be ignored', publish.platform_post_id, '999999'),
        tweet('2085056671248765119', 'Owner thread continuation should be ignored', publish.platform_post_id, '999999'),
        tweet('2085056671248765117', 'Can you share more?', publish.platform_post_id, 'author-top'),
        tweet('2085056671248765118', 'Nested reply here', '2085056671248765117', 'author-nested'),
      ],
      includes: {
        users: [
          expandedUser('999999', 'amadutown', 'AmaduTown Automation Solutions'),
          expandedUser('author-top', 'viewer_one', 'Viewer One'),
          expandedUser('author-nested', 'viewer_two', 'Viewer Two'),
        ],
      },
      meta: { result_count: 4 },
    }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      fetched: 2,
      upserted: 2,
      skipped: 2,
      cursor: {
        rootExcludedCount: 1,
        ownerExcludedCount: 1,
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toContain('/2/tweets/search/recent')
    expect(String(url)).toContain(`query=conversation_id%3A${publish.platform_post_id}`)
    expect(String(url)).toContain('tweet.fields=')
    expect(init).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer x-access-token',
      }),
    })
    expect(init).not.toHaveProperty('body')
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        publish_id: publish.id,
        provider: 'x_api',
        provider_comment_id: '2085056671248765117',
        provider_parent_comment_id: publish.platform_post_id,
        thread_id: publish.platform_post_id,
        record_type: 'comment',
        author_public_handle: 'viewer_one',
        author_display_name: 'Viewer One',
        author_profile_url: 'https://x.com/viewer_one',
        comment_url: 'https://x.com/viewer_one/status/2085056671248765117',
        body: 'Can you share more?',
        reply_submission_state: 'not_applicable',
        provider_capability: expect.objectContaining({
          supports_comment_ingestion: true,
          external_submission_enabled: false,
        }),
      }),
      expect.objectContaining({
        provider_comment_id: '2085056671248765118',
        provider_parent_comment_id: '2085056671248765117',
        thread_id: publish.platform_post_id,
        record_type: 'reply',
        author_public_handle: 'viewer_two',
        body: 'Nested reply here',
      }),
    ])
  })

  it('uses connected profile handle as a case-insensitive owner fallback when author id does not match', async () => {
    const { db, calls } = createDb({
      configRow: {
        ...config,
        credentials: {
          ...config.credentials,
          user_id: 'owner-id-not-in-response',
        },
        settings: {
          profile_handle: '@AmaduTown',
        },
      },
    })
    const fetchImpl = createFetchMock(() => response({
      data: [
        tweet('2085056671248770001', 'Owner post by handle should be ignored', publish.platform_post_id, 'unexpected-owner-id'),
        tweet('2085056671248770002', 'Third party should import', publish.platform_post_id, 'third-party-id'),
      ],
      includes: {
        users: [
          expandedUser('unexpected-owner-id', 'AMADUTOWN', 'AmaduTown Automation Solutions'),
          expandedUser('third-party-id', 'community_member', 'Community Member'),
        ],
      },
      meta: { result_count: 2 },
    }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      fetched: 1,
      skipped: 1,
      cursor: {
        ownerExcludedCount: 1,
      },
    })
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        provider_comment_id: '2085056671248770002',
        author_public_handle: 'community_member',
        body: 'Third party should import',
      }),
    ])
  })

  it('follows pagination and deduplicates repeated provider tweets before canonical upsert', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [tweet('2085056671248765117', 'First copy')],
        includes: { users: [user('2085056671248765117', 'viewer_one')] },
        meta: { next_token: 'next-page', result_count: 1 },
      }))
      .mockImplementationOnce(() => response({
        data: [
          tweet('2085056671248765117', 'Refreshed copy'),
          tweet('2085056671248765118', 'Nested reply', '2085056671248765117'),
        ],
        includes: {
          users: [
            user('2085056671248765117', 'viewer_one'),
            user('2085056671248765118', 'viewer_two'),
          ],
        },
        meta: { result_count: 2 },
      }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result.status).toBe('succeeded')
    expect(result.fetched).toBe(3)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[1][0])).toContain('next_token=next-page')
    expect(calls.commentUpserts[0]).toHaveLength(2)
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        provider_comment_id: '2085056671248765117',
        body: 'Refreshed copy',
        record_type: 'comment',
      }),
      expect.objectContaining({
        provider_comment_id: '2085056671248765118',
        provider_parent_comment_id: '2085056671248765117',
        record_type: 'reply',
      }),
    ])
  })

  it('preserves local workflow fields during repeated provider refresh updates', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      data: [tweet('2085056671248765117', 'Provider-updated body')],
      includes: { users: [user('2085056671248765117', 'viewer_one')] },
    }))

    await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    const update = calls.commentUpdates[0] as Record<string, unknown>
    expect(update).toMatchObject({
      platform: 'x',
      provider_parent_comment_id: publish.platform_post_id,
      thread_id: publish.platform_post_id,
      body: 'Provider-updated body',
      provider_capability: expect.objectContaining({ capability_status: 'verified' }),
    })
    expect(update).not.toHaveProperty('classification_status')
    expect(update).not.toHaveProperty('classification_reason')
    expect(update).not.toHaveProperty('response_approval_state')
    expect(update).not.toHaveProperty('reply_submission_state')
    expect(update).not.toHaveProperty('proposed_reply_text')
    expect(update).not.toHaveProperty('approved_reply_text')
    expect(update).not.toHaveProperty('reply_provider_comment_id')
    expect(update).not.toHaveProperty('reply_submitted_at')
    expect(update).not.toHaveProperty('parent_comment_id')
    expect(update).not.toHaveProperty('metadata')
  })

  it('blocks stale or unverifiable X tokens before provider calls', async () => {
    const { db } = createDb({
      configRow: {
        ...config,
        credentials: {
          ...config.credentials,
          token_obtained_at: '2026-08-12T10:00:00.000Z',
          expires_in: 60,
        },
      },
    })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      errors: [expect.objectContaining({ code: 'token_expired' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('blocks insufficient X OAuth scope evidence before provider calls', async () => {
    const { db } = createDb({
      configRow: {
        ...config,
        credentials: {
          ...config.credentials,
          scope: 'tweet.write offline.access',
        },
      },
    })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      errors: [expect.objectContaining({ code: 'insufficient_scope' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('records rate-limit denial as recoverable manual evidence when no comments were imported', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      title: 'Too Many Requests',
      detail: 'Rate limit exceeded.',
    }, 429))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      fetched: 0,
      errors: [expect.objectContaining({ code: 'rate_limited', status: 429 })],
    })
    expect(calls.runUpdates[0]).toMatchObject({
      status: 'manual_blocked',
      error_count: 1,
    })
  })

  it('records deleted or unavailable posts as manual evidence without upserting comments', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      title: 'Not Found Error',
      detail: 'Post unavailable.',
    }, 404))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      errors: [expect.objectContaining({ code: 'post_unavailable' })],
    })
    expect(calls.commentUpserts).toEqual([])
  })

  it('returns partial when later pages fail after importing comments', async () => {
    const { db } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [tweet('2085056671248765117', 'First page')],
        includes: { users: [user('2085056671248765117', 'viewer_one')] },
        meta: { next_token: 'next-page', result_count: 1 },
      }))
      .mockImplementationOnce(() => response({
        title: 'Forbidden',
        detail: 'Client Forbidden.',
      }, 403))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'partial',
      fetched: 1,
      upserted: 1,
      errors: [expect.objectContaining({ code: 'x_access_tier_blocked' })],
    })
  })

  it('blocks malformed provider identity before provider calls', async () => {
    const { db, calls } = createDb({
      publishRow: {
        ...publish,
        platform_post_id: 'not-a-post-id',
        platform_post_url: 'https://x.com/amadutown/status/not-a-post-id',
      },
    })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedXComments({
      db,
      publishId: publish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      postId: null,
      errors: [expect.objectContaining({ code: 'malformed_provider_post_id' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(calls.commentUpserts).toEqual([])
  })
})
