import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchEngagementMetrics, findBestEngagementMatch } from './apify-engagement'

const originalEnv = { ...process.env }

describe('Apify engagement adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv, APIFY_API_TOKEN: 'test-token' }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('matches LinkedIn rows by normalized URL before falling back', () => {
    const match = findBestEngagementMatch({
      contentUrl: 'https://www.linkedin.com/posts/demo?utm_source=test',
      platformPostId: null,
      items: [
        { url: 'https://www.linkedin.com/posts/other', reactions: 2 },
        { postUrl: 'https://www.linkedin.com/posts/demo', reactions: 10 },
      ],
    })

    expect(match).toMatchObject({
      confidence: 'exact',
      item: { reactions: 10 },
    })
  })

  it('runs the configured profile actor and normalizes a matching LinkedIn post', async () => {
    process.env.APIFY_LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/vambah'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'x-apify-run-id': 'run-profile',
        'x-apify-default-dataset-id': 'dataset-profile',
      }),
      json: async () => [
        {
          postUrl: 'https://www.linkedin.com/posts/demo',
          text: 'Portfolio AI insight',
          reactions: 12,
          commentsCount: 4,
          reposts: 2,
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchEngagementMetrics({
      platform: 'linkedin',
      contentUrl: 'https://www.linkedin.com/posts/demo',
      platformPostId: null,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toMatchObject({
      actorId: 'harvestapi~linkedin-profile-posts',
      runId: 'run-profile',
      datasetId: 'dataset-profile',
      metrics: {
        platform: 'linkedin',
        contentUrl: 'https://www.linkedin.com/posts/demo',
        reactions: 12,
        comments: 4,
        reposts: 2,
      },
    })
  })

  it('falls back to direct post metrics when no profile URL is configured', async () => {
    delete process.env.APIFY_LINKEDIN_PROFILE_URL
    delete process.env.LINKEDIN_PROFILE_URL
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'x-apify-run-id': 'run-direct' }),
      json: async () => [
        {
          url: 'https://www.linkedin.com/posts/direct',
          likes: 8,
          comments: 1,
          shares: 1,
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchEngagementMetrics({
      platform: 'linkedin',
      contentUrl: 'https://www.linkedin.com/posts/direct',
      platformPostId: null,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v2/acts/iron-crawler~linkedin-post-metrics-scraper/run-sync-get-dataset-items'),
      expect.any(Object),
    )
    expect(result.metrics).toMatchObject({
      likes: 8,
      comments: 1,
      shares: 1,
    })
  })

  it('fails closed when Apify credentials are missing', async () => {
    delete process.env.APIFY_API_TOKEN
    delete process.env.APIFY_TOKEN

    await expect(fetchEngagementMetrics({
      platform: 'linkedin',
      contentUrl: 'https://www.linkedin.com/posts/demo',
      platformPostId: null,
    })).rejects.toThrow('APIFY_API_TOKEN')
  })

  it('rejects unsupported platforms for V1', async () => {
    await expect(fetchEngagementMetrics({
      platform: 'youtube',
      contentUrl: 'https://youtube.com/watch?v=demo',
      platformPostId: null,
    })).rejects.toThrow('LinkedIn only')
  })
})
