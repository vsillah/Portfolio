import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchEngagementMetrics: vi.fn(),
}))

vi.mock('./apify-engagement', () => ({
  fetchEngagementMetrics: mocks.fetchEngagementMetrics,
}))

import { refreshPublishedSocialEngagement } from './social-engagement-refresh'

type QueryResult = { data: unknown; error: { message: string } | null }

function thenableQuery(result: QueryResult, methods: string[] = []) {
  const query: Record<string, unknown> = {
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  }
  for (const method of methods) {
    query[method] = vi.fn(() => query)
  }
  return query
}

function createDb(overrides?: {
  publishes?: QueryResult
  content?: QueryResult
  update?: QueryResult
}) {
  const publishes = overrides?.publishes ?? {
    data: [
      {
        id: 'publish-1',
        content_id: 'content-1',
        platform: 'linkedin',
        status: 'published',
        platform_post_id: 'post-1',
        platform_post_url: 'https://www.linkedin.com/posts/demo',
        published_at: '2026-05-31T12:00:00.000Z',
      },
    ],
    error: null,
  }
  const content = overrides?.content ?? {
    data: [
      {
        id: 'content-1',
        platform: 'linkedin',
        status: 'published',
        post_text: 'AI operating system for community builders',
        topic_extracted: { topic: 'Agentic operating system' },
        rag_context: {},
        platform_post_id: 'post-1',
        published_at: '2026-05-31T12:00:00.000Z',
      },
    ],
    error: null,
  }
  const update = overrides?.update ?? { data: { id: 'content-1' }, error: null }

  const updateQuery = {
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(update),
        })),
      })),
    })),
  }

  return {
    updateQuery,
    db: {
      from: vi.fn((table: string) => {
        if (table === 'social_content_publishes') {
          return thenableQuery(publishes, ['select', 'eq', 'order', 'limit'])
        }
        if (table === 'social_content_queue') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue(content),
            })),
            update: updateQuery.update,
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    },
  }
}

describe('refreshPublishedSocialEngagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2026-06-01T10:00:00.000Z'))
    mocks.fetchEngagementMetrics.mockResolvedValue({
      actorId: 'harvestapi~linkedin-profile-posts',
      runId: 'run-1',
      datasetId: 'dataset-1',
      matchedItem: {},
      metrics: {
        platform: 'linkedin',
        contentUrl: 'https://www.linkedin.com/posts/demo',
        platformPostId: 'post-1',
        capturedAt: '2026-06-01T10:00:00.000Z',
        impressions: 1200,
        views: null,
        likes: 0,
        reactions: 24,
        comments: 6,
        shares: 2,
        reposts: 1,
        engagementRate: null,
        notableCommenters: ['Operator One'],
        source: {
          provider: 'apify',
          actorId: 'harvestapi~linkedin-profile-posts',
          runId: 'run-1',
          datasetId: 'dataset-1',
          confidence: 'exact',
        },
        raw: {},
      },
    })
  })

  it('refreshes published LinkedIn rows and stores normalized engagement metadata', async () => {
    const { db, updateQuery } = createDb()

    const result = await refreshPublishedSocialEngagement({ db, captureDate: new Date('2026-06-01T10:00:00.000Z') })

    expect(result).toMatchObject({
      refreshed: 1,
      skipped: 0,
      errors: [],
    })
    expect(result.insights[0]).toMatchObject({
      contentId: 'content-1',
      theme: 'Agentic Operating System',
      recommendation: 'promote',
    })
    expect(mocks.fetchEngagementMetrics).toHaveBeenCalledWith({
      platform: 'linkedin',
      contentUrl: 'https://www.linkedin.com/posts/demo',
      platformPostId: 'post-1',
    })
    expect(updateQuery.update).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        engagement: expect.objectContaining({
          manual_entry_required: false,
          latest: expect.objectContaining({
            comments: 6,
            shares: 2,
          }),
          latest_score: expect.any(Number),
          recommendation: 'promote',
          mapped_theme: 'Agentic Operating System',
        }),
      }),
    })
  })

  it('skips rows already refreshed on the same capture date unless forced', async () => {
    const { db, updateQuery } = createDb({
      content: {
        data: [
          {
            id: 'content-1',
            platform: 'linkedin',
            status: 'published',
            post_text: 'AI operating system',
            topic_extracted: {},
            rag_context: {
              engagement: {
                latest: { capturedAt: '2026-06-01T08:00:00.000Z' },
              },
            },
            platform_post_id: 'post-1',
            published_at: '2026-05-31T12:00:00.000Z',
          },
        ],
        error: null,
      },
    })

    const result = await refreshPublishedSocialEngagement({ db, captureDate: new Date('2026-06-01T10:00:00.000Z') })

    expect(result).toMatchObject({ refreshed: 0, skipped: 1, errors: [] })
    expect(mocks.fetchEngagementMetrics).not.toHaveBeenCalled()
    expect(updateQuery.update).not.toHaveBeenCalled()
  })

  it('records per-content errors without aborting the whole batch', async () => {
    const { db } = createDb()
    mocks.fetchEngagementMetrics.mockRejectedValue(new Error('Apify actor failed'))

    const result = await refreshPublishedSocialEngagement({ db })

    expect(result).toMatchObject({
      refreshed: 0,
      skipped: 0,
      errors: [{ contentId: 'content-1', message: 'Apify actor failed' }],
    })
  })
})
