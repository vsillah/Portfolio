import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewYouTubePublicationReconciliation } from './youtube-publication-reconciliation-preview'

const CONTENT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_CONTENT_ID = '22222222-2222-4222-8222-222222222222'
const VIDEO_ID = 'abc123DEF45'
const CHANNEL_ID = 'UC-amadutown'

const approvedRagContext = {
  source_packet_path: 'docs/youtube/source-packet.md',
  platform: 'youtube',
  approval_boundary: 'final submission gated',
  pass_to_human: true,
  production_assets: {
    video_redaction_manifest: { status: 'ready' },
  },
  section_gate_reviews: {
    visual_assets: { status: 'approved' },
    asset_packet: { status: 'approved' },
    privacy: { status: 'approved' },
  },
  platform_submission_gate: {
    status: 'approved',
    approved_at: '2026-08-12T11:00:00.000Z',
    approved_by: 'admin-user',
    platforms: ['youtube'],
  },
}

const contentRow = {
  id: CONTENT_ID,
  platform: 'youtube',
  status: 'approved',
  post_text: 'Draft body',
  image_url: 'https://cdn.example.com/thumb.jpg',
  video_url: 'https://cdn.example.com/final-video.mp4',
  carousel_slide_urls: [],
  youtube_title: 'Reviewed YouTube title',
  youtube_description: 'Reviewed YouTube description',
  target_platforms: ['youtube'],
  platform_post_id: null,
  published_at: null,
  rag_context: approvedRagContext,
  updated_at: '2026-08-12T10:00:00.000Z',
}

const draftPublishRow = {
  id: '33333333-3333-4333-8333-333333333333',
  content_id: CONTENT_ID,
  platform: 'youtube',
  status: 'pending',
  platform_post_id: null,
  platform_post_url: null,
  error_message: null,
  published_at: null,
  created_at: '2026-08-12T10:10:00.000Z',
  updated_at: '2026-08-12T10:10:00.000Z',
}

const configRow = {
  is_active: true,
  credentials: {
    access_token: 'youtube-access-token',
    expires_in: 3600,
    token_obtained_at: '2026-08-12T11:50:00.000Z',
    scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
  },
  settings: {
    channel_id: CHANNEL_ID,
    channel_title: 'AmaduTown Automation Solutions',
  },
}

const videoResponse = {
  items: [{
    id: VIDEO_ID,
    snippet: {
      channelId: CHANNEL_ID,
      channelTitle: 'AmaduTown Automation Solutions',
      title: 'Published YouTube video',
      description: 'Video description',
      publishedAt: '2026-08-12T12:00:00.000Z',
      thumbnails: { high: { url: 'https://i.ytimg.com/vi/abc123DEF45/hqdefault.jpg' } },
    },
    status: {
      privacyStatus: 'public',
      uploadStatus: 'processed',
      embeddable: true,
      madeForKids: false,
    },
  }],
}

type DbOptions = {
  content?: Record<string, unknown> | null
  existingPublish?: Record<string, unknown> | null
  conflictPublish?: Record<string, unknown> | null
  config?: Record<string, unknown> | null
}

function createDb(options: DbOptions = {}) {
  const mutations: Array<{ table: string; operation: string; payload: unknown }> = []
  const filters: Array<{ table: string; column: string; value: unknown }> = []

  function result(table: string) {
    if (table === 'social_content_queue') return { data: options.content === undefined ? contentRow : options.content, error: null }
    if (table === 'social_content_config') return { data: options.config === undefined ? configRow : options.config, error: null }
    if (table === 'social_content_publishes') {
      const hasPlatformPostIdFilter = filters.some((filter) => (
        filter.table === table && filter.column === 'platform_post_id'
      ))
      return {
        data: hasPlatformPostIdFilter
          ? (options.conflictPublish ?? null)
          : (options.existingPublish === undefined ? draftPublishRow : options.existingPublish),
        error: null,
      }
    }
    return { data: null, error: null }
  }

  function builder(table: string) {
    const api = {
      select: vi.fn(() => api),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value })
        return api
      }),
      limit: vi.fn(() => api),
      maybeSingle: vi.fn(() => Promise.resolve(result(table))),
      insert: vi.fn((payload: unknown) => {
        mutations.push({ table, operation: 'insert', payload })
        return api
      }),
      update: vi.fn((payload: unknown) => {
        mutations.push({ table, operation: 'update', payload })
        return api
      }),
      upsert: vi.fn((payload: unknown) => {
        mutations.push({ table, operation: 'upsert', payload })
        return api
      }),
    }
    return api
  }

  return {
    db: { from: vi.fn((table: string) => builder(table)) },
    filters,
    mutations,
  }
}

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function createFetchMock(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.fn(impl)
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch
}

describe('previewYouTubePublicationReconciliation', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('requires an explicit selected Social Content row and exact video id before lookup', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'explicit_selection_required' }),
        expect.objectContaining({ code: 'malformed_provider_video_id' }),
      ]),
    })
    expect(db.from).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('does not query YouTube when the selected content id is malformed', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: 'not-a-uuid',
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'invalid_content_id' })],
    })
    expect(db.from).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('verifies only the explicit video id and returns a non-mutating proposal', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: true,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      selectedContent: expect.objectContaining({
        id: CONTENT_ID,
        status: 'approved',
        youtube_title: 'Reviewed YouTube title',
      }),
      existingPublishState: expect.objectContaining({ id: draftPublishRow.id }),
      providerVideo: expect.objectContaining({
        id: VIDEO_ID,
        title: 'Published YouTube video',
        channelId: CHANNEL_ID,
      }),
      channelMatch: {
        configuredChannelId: CHANNEL_ID,
        providerChannelId: CHANNEL_ID,
        matches: true,
      },
      proposedWrite: {
        table: 'social_content_publishes',
        operation: 'upsert_after_human_approval',
        immutableFields: {
          content_id: CONTENT_ID,
          platform: 'youtube',
          status: 'published',
          platform_post_id: VIDEO_ID,
          platform_post_url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
          published_at: '2026-08-12T12:00:00.000Z',
        },
      },
      blockers: [],
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetchImpl.mock.calls[0][0]))
    expect(url.pathname).toBe('/youtube/v3/videos')
    expect(url.searchParams.get('id')).toBe(VIDEO_ID)
    expect(url.searchParams.get('part')).toBe('snippet,status')
    expect(url.searchParams.has('mine')).toBe(false)
    expect(url.searchParams.has('channelId')).toBe(false)
    expect(url.searchParams.has('q')).toBe(false)
    expect(mutations).toHaveLength(0)
  })

  it('blocks draft or missing-gate rows even when the external video exists', async () => {
    const { db, mutations } = createDb({
      content: {
        ...contentRow,
        status: 'draft',
        rag_context: {
          ...approvedRagContext,
          platform_submission_gate: undefined,
        },
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'lifecycle_prerequisite_blocked' }),
        expect.objectContaining({ code: 'youtube_submission_gate_required' }),
      ]),
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('allows a fully approved YouTube row through to exact video verification', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(mutations).toHaveLength(0)
  })

  it('blocks malformed YouTube URL video ids before provider calls', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoUrl: 'https://www.youtube.com/watch?v=too-short',
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'malformed_provider_video_id' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('blocks videos from the wrong YouTube channel', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [{
        ...videoResponse.items[0],
        snippet: {
          ...videoResponse.items[0].snippet,
          channelId: 'UC-other-channel',
          channelTitle: 'Other Channel',
        },
      }],
    }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      channelMatch: {
        configuredChannelId: CHANNEL_ID,
        providerChannelId: 'UC-other-channel',
        matches: false,
      },
      blockers: [expect.objectContaining({ code: 'wrong_channel' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks when the selected content is already linked to a video', async () => {
    const { db, mutations } = createDb({
      existingPublish: {
        ...draftPublishRow,
        status: 'published',
        platform_post_id: VIDEO_ID,
        platform_post_url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        published_at: '2026-08-12T12:00:00.000Z',
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'already_linked_video' })],
      existingPublishState: expect.objectContaining({ platform_post_id: VIDEO_ID }),
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('treats an existing YouTube URL as linked even when platform_post_id is null', async () => {
    const { db, mutations } = createDb({
      existingPublish: {
        ...draftPublishRow,
        platform_post_id: null,
        platform_post_url: `https://youtu.be/${VIDEO_ID}`,
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'already_linked_video' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('blocks conflicting existing publish rows for the same video id', async () => {
    const { db, mutations } = createDb({
      conflictPublish: {
        id: '44444444-4444-4444-8444-444444444444',
        content_id: OTHER_CONTENT_ID,
        platform: 'youtube',
        status: 'published',
        platform_post_id: VIDEO_ID,
        platform_post_url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        error_message: null,
        published_at: '2026-08-12T12:00:00.000Z',
        created_at: '2026-08-12T12:00:00.000Z',
        updated_at: '2026-08-12T12:00:00.000Z',
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'conflicting_existing_publish_row' })],
      conflicts: [expect.objectContaining({
        publishId: '44444444-4444-4444-8444-444444444444',
        contentId: OTHER_CONTENT_ID,
      })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('blocks when channel identity is missing from config or provider metadata', async () => {
    const { db, mutations } = createDb({
      config: {
        ...configRow,
        settings: { channel_title: 'AmaduTown Automation Solutions' },
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      channelMatch: {
        configuredChannelId: null,
        providerChannelId: CHANNEL_ID,
        matches: null,
      },
      blockers: [expect.objectContaining({ code: 'channel_identity_unverified' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks expired tokens without refreshing or mutating credentials', async () => {
    const { db, mutations } = createDb({
      config: {
        ...configRow,
        credentials: {
          ...configRow.credentials,
          token_obtained_at: '2026-08-12T08:00:00.000Z',
          expires_in: 60,
        },
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
      now: () => new Date('2026-08-12T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'token_expired' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('blocks missing readonly or force-ssl scope before provider calls', async () => {
    const { db, mutations } = createDb({
      config: {
        ...configRow,
        credentials: {
          ...configRow.credentials,
          scope: 'https://www.googleapis.com/auth/youtube.upload',
        },
      },
    })
    const fetchImpl = createFetchMock(() => response(videoResponse))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'insufficient_scope' })],
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mutations).toHaveLength(0)
  })

  it('surfaces quota errors from videos.list without mutation', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      error: {
        code: 403,
        message: 'Quota exceeded.',
        errors: [{ reason: 'quotaExceeded' }],
      },
    }, 403))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'quota_or_rate_limited', reason: 'quotaExceeded' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks nonexistent or private videos returned as empty by videos.list', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({ items: [] }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'video_not_found' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks private videos even when videos.list returns metadata', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [{
        ...videoResponse.items[0],
        status: {
          ...videoResponse.items[0].status,
          privacyStatus: 'private',
        },
      }],
    }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      providerVideo: expect.objectContaining({ privacyStatus: 'private' }),
      blockers: [expect.objectContaining({ code: 'video_not_public' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks mismatched provider video ids before proposing published state', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [{
        ...videoResponse.items[0],
        id: 'ZZZ123DEF45',
      }],
    }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'provider_video_id_mismatch' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks unprocessed videos before proposing published state', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [{
        ...videoResponse.items[0],
        status: {
          ...videoResponse.items[0].status,
          uploadStatus: 'processing',
        },
      }],
    }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'video_not_processed' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks unlisted or missing privacy before proposing published state', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [{
        ...videoResponse.items[0],
        status: {
          ...videoResponse.items[0].status,
          privacyStatus: 'unlisted',
        },
      }],
    }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'video_not_public' })],
    })
    expect(mutations).toHaveLength(0)
  })

  it('blocks missing or invalid publishedAt before proposing published state', async () => {
    const { db, mutations } = createDb()
    const fetchImpl = createFetchMock(() => response({
      items: [{
        ...videoResponse.items[0],
        snippet: {
          ...videoResponse.items[0].snippet,
          publishedAt: 'not-a-date',
        },
      }],
    }))

    const result = await previewYouTubePublicationReconciliation({
      db,
      contentId: CONTENT_ID,
      videoId: VIDEO_ID,
      fetchImpl: asFetch(fetchImpl),
    })

    expect(result).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: 'published_at_unverified' })],
    })
    expect(mutations).toHaveLength(0)
  })
})
