import { describe, expect, it, vi } from 'vitest'
import { refreshPublishedMetaComments } from './meta-comment-ingestion'

const facebookPublish = {
  id: '11111111-1111-4111-8111-111111111111',
  content_id: '22222222-2222-4222-8222-222222222222',
  platform: 'facebook',
  status: 'published',
  platform_post_id: '123456789_987654321',
  platform_post_url: 'https://www.facebook.com/123456789/posts/987654321',
  published_at: '2026-08-12T10:00:00.000Z',
}

const instagramPublish = {
  ...facebookPublish,
  platform: 'instagram',
  platform_post_id: '17900000000000000',
  platform_post_url: 'https://www.instagram.com/p/example/',
}

const facebookConfig = {
  credentials: {
    access_token: 'facebook-user-token',
    page_access_token: 'facebook-page-token',
    expires_in: 3600,
    token_obtained_at: '2099-01-01T00:00:00.000Z',
    scope: 'pages_show_list pages_read_engagement pages_read_user_content',
  },
  settings: {
    graph_api_version: 'v20.0',
    page_id: '123456789',
  },
  is_active: true,
}

const instagramConfig = {
  credentials: {
    access_token: 'instagram-page-token',
    page_access_token: 'instagram-page-token',
    expires_in: 3600,
    token_obtained_at: '2099-01-01T00:00:00.000Z',
    scope: 'instagram_basic instagram_manage_comments pages_read_engagement',
  },
  settings: {
    graph_api_version: 'v20.0',
    instagram_basic_permission: true,
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
  gate_notes: 'Meta comment ingestion verified by read-only scope smoke.',
}

const manualCapability = {
  ...verifiedCapability,
  capability_status: 'manual',
  supports_comment_ingestion: false,
  gate_notes: 'Meta comment ingestion is awaiting read-only scope smoke.',
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
      return { data: options.publishRow === undefined ? facebookPublish : options.publishRow, error: null }
    }
    if (table === 'social_content_config') {
      return { data: options.configRow === undefined ? facebookConfig : options.configRow, error: null }
    }
    if (table === 'social_comment_provider_capabilities') {
      return {
        data: options.capabilityRow === undefined ? verifiedCapability : options.capabilityRow,
        error: options.capabilityError ?? null,
      }
    }
    if (table === 'social_comment_ingestion_runs' && operation === 'insert') {
      return { data: { id: options.insertedRunId ?? 'run-meta-1' }, error: null }
    }
    if (table === 'social_comment_ingestion_runs' && operation === 'update') {
      return { data: [{ id: options.insertedRunId ?? 'run-meta-1' }], error: null }
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

describe('meta comment ingestion', () => {
  it('blocks on canonical manual Meta capability without a provider call', async () => {
    const { db, calls } = createDb({ capabilityRow: manualCapability })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'manual_blocked',
      objectId: facebookPublish.platform_post_id,
      errors: [expect.objectContaining({ code: 'meta_comment_ingestion_capability_blocked' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(calls.commentUpserts).toEqual([])
    expect(calls.runInserts[0]).toEqual(expect.objectContaining({
      platform: 'facebook',
      provider: 'meta_graph',
      status: 'manual_blocked',
      metadata: expect.objectContaining({
        recovery: 'verify_meta_comment_ingestion_capability',
        supports_comment_ingestion: false,
        external_submission_enabled: false,
      }),
    }))
  })

  it('requires an explicit selected published row and records a manual blocker without provider reads', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result.status).toBe('manual_blocked')
    expect(result.errors[0]).toMatchObject({ code: 'no_selected_publish' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(calls.runInserts[0]).toEqual(expect.objectContaining({
      publish_id: null,
      content_id: null,
      metadata: expect.objectContaining({
        requested_publish_id: null,
        requested_content_id: null,
      }),
    }))
  })

  it('ingests paginated Facebook comments and nested replies into canonical comments', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [{
          id: 'comment-1',
          message: 'Can this work for us?',
          created_time: '2026-08-12T11:00:00+0000',
          permalink_url: 'https://www.facebook.com/123/posts/987?comment_id=comment-1',
          from: { id: 'viewer-1', name: 'Viewer One', link: 'https://facebook.com/viewer-1' },
          comments: {
            data: [{
              id: 'reply-1',
              message: 'Following this.',
              created_time: '2026-08-12T11:05:00+0000',
              from: { id: 'viewer-2', name: 'Viewer Two' },
              parent: { id: 'comment-1' },
            }],
          },
        }],
        paging: { cursors: { after: 'next-page' }, next: 'https://graph.facebook.com/v20.0/next' },
      }))
      .mockImplementationOnce(() => response({
        data: [{
          id: 'comment-2',
          message: 'Second page comment',
          created_time: '2026-08-12T11:10:00+0000',
          from: { id: 'viewer-3', name: 'Viewer Three' },
        }],
      }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
      pageSize: 1,
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      fetched: 3,
      upserted: 3,
      cursor: { pages: 2, nextAfter: null, limitReached: false },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/v20.0/123456789_987654321/comments')
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain('access_token')
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer facebook-page-token',
    }))
    expect(String(fetchImpl.mock.calls[1][0])).toContain('after=next-page')
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        provider: 'meta_graph',
        platform: 'facebook',
        provider_comment_id: 'comment-1',
        record_type: 'comment',
        body: 'Can this work for us?',
        comment_url: 'https://www.facebook.com/123/posts/987?comment_id=comment-1',
        author_public_handle: 'viewer-1',
        provider_capability: expect.objectContaining({
          capability_status: 'verified',
          supports_comment_ingestion: true,
          supports_reply_submission: false,
          external_submission_enabled: false,
        }),
      }),
      expect.objectContaining({
        provider_comment_id: 'reply-1',
        provider_parent_comment_id: 'comment-1',
        thread_id: 'comment-1',
        record_type: 'reply',
      }),
      expect.objectContaining({ provider_comment_id: 'comment-2' }),
    ])
  })

  it('deduplicates repeated provider comments before canonical upsert', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      data: [
        { id: 'comment-1', message: 'Original text', from: { id: 'viewer-1', name: 'Viewer One' } },
        { id: 'comment-1', message: 'Refreshed text', from: { id: 'viewer-1', name: 'Viewer One' } },
      ],
    }))

    await refreshPublishedMetaComments({ db, platform: 'facebook', publishId: facebookPublish.id, fetchImpl: asFetch(fetchImpl) })

    expect(calls.commentUpserts[0]).toHaveLength(1)
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({ provider_comment_id: 'comment-1', body: 'Refreshed text' }),
    ])
  })

  it('preserves local workflow-owned fields during duplicate refresh updates', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      data: [{ id: 'comment-1', message: 'Provider-owned refresh', from: { id: 'viewer-1', name: 'Viewer One' } }],
    }))

    await refreshPublishedMetaComments({ db, platform: 'facebook', publishId: facebookPublish.id, fetchImpl: asFetch(fetchImpl) })

    expect(calls.commentUpdates[0]).toEqual(expect.objectContaining({
      body: 'Provider-owned refresh',
      provider_capability: expect.objectContaining({ supports_comment_ingestion: true }),
    }))
    expect(calls.commentUpdates[0]).not.toHaveProperty('classification_status')
    expect(calls.commentUpdates[0]).not.toHaveProperty('response_approval_state')
    expect(calls.commentUpdates[0]).not.toHaveProperty('reply_submission_state')
    expect(calls.commentUpdates[0]).not.toHaveProperty('approved_reply_text')
    expect(calls.commentUpdates[0]).not.toHaveProperty('parent_comment_id')
    expect(calls.commentUpdates[0]).not.toHaveProperty('metadata')
  })

  it('records partial ingestion when a later Meta page returns insufficient permissions', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [{ id: 'comment-1', message: 'First page', from: { id: 'viewer-1', name: 'Viewer One' } }],
        paging: { cursors: { after: 'next-page' } },
      }))
      .mockImplementationOnce(() => response({ error: { code: 200, type: 'OAuthException' } }, 403))

    const result = await refreshPublishedMetaComments({ db, platform: 'facebook', publishId: facebookPublish.id, fetchImpl: asFetch(fetchImpl), pageSize: 1 })

    expect(result).toMatchObject({
      status: 'partial',
      fetched: 1,
      upserted: 1,
      errors: [expect.objectContaining({ code: 'insufficient_scope', status: 403, providerCode: 200 })],
    })
    expect(calls.runUpdates[0]).toEqual(expect.objectContaining({
      status: 'partial',
      fetched_count: 1,
      error_count: 1,
    }))
  })

  it('follows multi-page Facebook child reply cursors within the overall limit', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock((url, init) => {
      expect(init?.method).toBeUndefined()
      expect(init?.body).toBeUndefined()
      expect(String(url)).not.toContain('access_token')
      return response({ data: [] })
    })
      .mockImplementationOnce((url, init) => {
        expect(init?.method).toBeUndefined()
        expect(init?.body).toBeUndefined()
        expect(String(url)).toContain('/v20.0/123456789_987654321/comments')
        return response({
          data: [{
            id: 'comment-1',
            message: 'Parent comment',
            from: { id: 'viewer-1', name: 'Viewer One' },
            comments: {
              data: [{ id: 'reply-1', message: 'Inline reply', from: { id: 'viewer-2', name: 'Viewer Two' } }],
              paging: { cursors: { after: 'child-page-2' } },
            },
          }],
        })
      })
      .mockImplementationOnce((url, init) => {
        expect(init?.method).toBeUndefined()
        expect(init?.body).toBeUndefined()
        expect(String(url)).toContain('/v20.0/comment-1/comments')
        expect(String(url)).toContain('after=child-page-2')
        return response({
          data: [{ id: 'reply-2', message: 'Fetched child reply', from: { id: 'viewer-3', name: 'Viewer Three' } }],
          paging: { cursors: { after: 'child-page-3' } },
        })
      })
      .mockImplementationOnce((url, init) => {
        expect(init?.method).toBeUndefined()
        expect(init?.body).toBeUndefined()
        expect(String(url)).toContain('/v20.0/comment-1/comments')
        expect(String(url)).toContain('after=child-page-3')
        return response({
          data: [{ id: 'reply-3', message: 'Final child reply', from: { id: 'viewer-4', name: 'Viewer Four' } }],
        })
      })

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
      limit: 4,
      pageSize: 1,
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      fetched: 4,
      cursor: {
        'children:comment-1': {
          inlineCount: 1,
          pages: 2,
          nextAfter: null,
          limitReached: true,
        },
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({ provider_comment_id: 'comment-1', record_type: 'comment' }),
      expect.objectContaining({ provider_comment_id: 'reply-1', provider_parent_comment_id: 'comment-1', record_type: 'reply' }),
      expect.objectContaining({ provider_comment_id: 'reply-2', provider_parent_comment_id: 'comment-1', record_type: 'reply' }),
      expect.objectContaining({ provider_comment_id: 'reply-3', provider_parent_comment_id: 'comment-1', record_type: 'reply' }),
    ])
  })

  it('follows Instagram child reply cursors through the replies edge', async () => {
    const { db, calls } = createDb({ publishRow: instagramPublish, configRow: instagramConfig })
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce((url, init) => {
        expect(init?.method).toBeUndefined()
        expect(init?.body).toBeUndefined()
        expect(String(url)).toContain('/v20.0/17900000000000000/comments')
        return response({
          data: [{
            id: 'ig-comment-1',
            text: 'Parent',
            username: 'viewer_one',
            replies: {
              data: [],
              paging: { cursors: { after: 'ig-child-page-2' } },
            },
          }],
        })
      })
      .mockImplementationOnce((url, init) => {
        expect(init?.method).toBeUndefined()
        expect(init?.body).toBeUndefined()
        expect(String(url)).toContain('/v20.0/ig-comment-1/replies')
        expect(String(url)).toContain('after=ig-child-page-2')
        return response({
          data: [{ id: 'ig-reply-1', text: 'Fetched IG reply', username: 'viewer_two', parent_id: 'ig-comment-1' }],
        })
      })

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'instagram',
      publishId: instagramPublish.id,
      fetchImpl: asFetch(fetchImpl),
      limit: 2,
      pageSize: 1,
    })

    expect(result.status).toBe('succeeded')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({ provider_comment_id: 'ig-comment-1', record_type: 'comment' }),
      expect.objectContaining({ provider_comment_id: 'ig-reply-1', provider_parent_comment_id: 'ig-comment-1', record_type: 'reply' }),
    ])
  })

  it('records partial evidence when a child reply cursor cannot be fetched', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [{
          id: 'comment-1',
          message: 'Parent comment',
          from: { id: 'viewer-1', name: 'Viewer One' },
          comments: {
            data: [],
            paging: { cursors: { after: 'child-page-2' } },
          },
        }],
      }))
      .mockImplementationOnce(() => response({ error: { code: 200, type: 'OAuthException' } }, 403))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'partial',
      fetched: 1,
      errors: [expect.objectContaining({ code: 'insufficient_scope', status: 403 })],
      cursor: {
        'children:comment-1': expect.objectContaining({
          pages: 1,
          nextAfter: 'child-page-2',
        }),
      },
    })
    expect(calls.runUpdates[0]).toEqual(expect.objectContaining({
      status: 'partial',
      fetched_count: 1,
      error_count: 1,
    }))
  })

  it('stops top-level pagination on an unchanged cursor with partial evidence', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [{ id: 'comment-1', message: 'First page', from: { id: 'viewer-1', name: 'Viewer One' } }],
        paging: { cursors: { after: 'same-cursor' } },
      }))
      .mockImplementationOnce(() => response({
        data: [],
        paging: { cursors: { after: 'same-cursor' } },
      }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
      limit: 5,
      pageSize: 1,
    })

    expect(result).toMatchObject({
      status: 'partial',
      fetched: 1,
      errors: [expect.objectContaining({ code: 'pagination_stalled' })],
      cursor: expect.objectContaining({
        pages: 2,
        nextAfter: 'same-cursor',
        limitReached: false,
      }),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(calls.runUpdates[0]).toEqual(expect.objectContaining({
      status: 'partial',
      fetched_count: 1,
      error_count: 1,
    }))
  })

  it('stops child pagination on an unchanged empty-page cursor with partial evidence', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ data: [] }))
      .mockImplementationOnce(() => response({
        data: [{
          id: 'comment-1',
          message: 'Parent comment',
          from: { id: 'viewer-1', name: 'Viewer One' },
          comments: {
            data: [],
            paging: { cursors: { after: 'same-child-cursor' } },
          },
        }],
      }))
      .mockImplementationOnce(() => response({
        data: [],
        paging: { cursors: { after: 'same-child-cursor' } },
      }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
      limit: 5,
      pageSize: 1,
    })

    expect(result).toMatchObject({
      status: 'partial',
      fetched: 1,
      errors: [expect.objectContaining({ code: 'pagination_stalled' })],
      cursor: {
        'children:comment-1': expect.objectContaining({
          pages: 1,
          nextAfter: 'same-child-cursor',
          paginationGuarded: true,
        }),
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(calls.runUpdates[0]).toEqual(expect.objectContaining({
      status: 'partial',
      fetched_count: 1,
      error_count: 1,
    }))
  })

  it('returns manual_blocked for zero-data provider token or scope denials', async () => {
    for (const providerError of [
      { body: { error: { code: 190, type: 'OAuthException' } }, status: 401, expected: 'token_expired' },
      { body: { error: { code: 200, type: 'OAuthException' } }, status: 403, expected: 'insufficient_scope' },
    ]) {
      const { db, calls } = createDb()
      const fetchImpl = createFetchMock(() => response(providerError.body, providerError.status))

      const result = await refreshPublishedMetaComments({
        db,
        platform: 'facebook',
        publishId: facebookPublish.id,
        fetchImpl: asFetch(fetchImpl),
      })

      expect(result).toMatchObject({
        status: 'manual_blocked',
        fetched: 0,
        upserted: 0,
        blockedReason: expect.any(String),
        errors: [expect.objectContaining({ code: providerError.expected })],
      })
      expect(calls.commentUpserts).toEqual([])
      expect(calls.runUpdates[0]).toEqual(expect.objectContaining({
        status: 'manual_blocked',
        fetched_count: 0,
        error_count: 1,
      }))
    }
  })

  it('blocks expired Meta token metadata before any provider call', async () => {
    const { db } = createDb({
      configRow: {
        ...facebookConfig,
        credentials: {
          ...facebookConfig.credentials,
          token_obtained_at: '2026-08-12T10:00:00.000Z',
          expires_in: 60,
        },
      },
    })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result.status).toBe('manual_blocked')
    expect(result.errors[0]).toMatchObject({ code: 'token_expired' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('blocks Instagram when required comment-management scope evidence is missing', async () => {
    const { db } = createDb({
      publishRow: instagramPublish,
      configRow: {
        ...instagramConfig,
        credentials: {
          ...instagramConfig.credentials,
          scope: 'instagram_basic pages_read_engagement',
        },
      },
    })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'instagram',
      publishId: instagramPublish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result.status).toBe('manual_blocked')
    expect(result.errors[0]).toMatchObject({ code: 'insufficient_scope' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('blocks Facebook before provider access when user-content read scope is missing', async () => {
    const { db } = createDb({
      configRow: {
        ...facebookConfig,
        credentials: {
          ...facebookConfig.credentials,
          scope: 'pages_show_list pages_read_engagement',
        },
      },
    })
    const fetchImpl = createFetchMock(() => response({ data: [] }))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result.status).toBe('manual_blocked')
    expect(result.errors[0]).toMatchObject({ code: 'insufficient_scope' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps Instagram hidden comments and uses read-only Graph requests', async () => {
    const { db, calls } = createDb({ publishRow: instagramPublish, configRow: instagramConfig })
    const fetchImpl = createFetchMock((_url, init) => {
      expect(init?.method).toBeUndefined()
      expect(init?.body).toBeUndefined()
      return response({
        data: [{
          id: 'ig-comment-1',
          text: 'Needs review',
          timestamp: '2026-08-12T11:00:00+0000',
          username: 'viewer_one',
          hidden: true,
        }],
      })
    })

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'instagram',
      publishId: instagramPublish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result.status).toBe('succeeded')
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/v20.0/17900000000000000/comments')
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain('access_token')
    expect(calls.commentUpserts[0]).toEqual([
      expect.objectContaining({
        platform: 'instagram',
        provider_comment_id: 'ig-comment-1',
        author_public_handle: 'viewer_one',
        author_display_name: 'viewer_one',
        status: 'hidden',
      }),
    ])
  })

  it('records deleted or unavailable Meta objects without upserting comments', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ error: { code: 100, type: 'GraphMethodException' } }, 404))

    const result = await refreshPublishedMetaComments({
      db,
      platform: 'facebook',
      publishId: facebookPublish.id,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      status: 'failed',
      fetched: 0,
      upserted: 0,
      errors: [expect.objectContaining({ code: 'object_unavailable', status: 404 })],
    })
    expect(calls.commentUpserts).toEqual([])
    expect(calls.runUpdates[0]).toEqual(expect.objectContaining({
      status: 'failed',
      error_count: 1,
    }))
  })
})
