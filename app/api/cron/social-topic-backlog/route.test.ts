import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class SocialTopicCoverageError extends Error {
    coverageReport: { status: string; blockers: string[] }

    constructor(coverageReport: { status: string; blockers: string[] }) {
      super('relation secret_catalog is missing')
      this.name = 'SocialTopicCoverageError'
      this.coverageReport = coverageReport
    }
  }

  return {
    runSocialTopicBacklogDiscovery: vi.fn(),
    SocialTopicCoverageError,
  }
})

vi.mock('@/lib/social-topic-backlog', () => ({
  runSocialTopicBacklogDiscovery: mocks.runSocialTopicBacklogDiscovery,
  SocialTopicCoverageError: mocks.SocialTopicCoverageError,
}))

import { GET, POST } from './route'

describe('/api/cron/social-topic-backlog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = 'n8n-secret'
    mocks.runSocialTopicBacklogDiscovery.mockResolvedValue({
      backlogItems: [{ id: 'topic-1' }],
      sourceCounts: { meeting: 1 },
      packet: { candidates: [{ id: 'topic-1' }] },
    })
  })

  it('rejects unauthenticated cron refreshes', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/social-topic-backlog'))

    expect(response.status).toBe(401)
    expect(mocks.runSocialTopicBacklogDiscovery).not.toHaveBeenCalled()
  })

  it('runs the scheduled Shaka backlog refresh', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/social-topic-backlog', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(response.status).toBe(200)
    expect(mocks.runSocialTopicBacklogDiscovery).toHaveBeenCalledWith({
      actorId: null,
      triggerSource: 'vercel_cron_social_topic_backlog',
    })
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      candidate_count: 1,
      backlog_item_count: 1,
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  })

  it('allows n8n/manual cron triggering with the ingest secret', async () => {
    const response = await POST(new NextRequest('http://localhost/api/cron/social-topic-backlog', {
      method: 'POST',
      headers: { authorization: 'Bearer n8n-secret' },
    }))

    expect(response.status).toBe(200)
    expect(mocks.runSocialTopicBacklogDiscovery).toHaveBeenCalledWith({
      actorId: null,
      triggerSource: 'manual_cron_social_topic_backlog',
    })
  })

  it('rejects a bearer token that matches neither cron secret', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/social-topic-backlog', {
      headers: { authorization: 'Bearer wrong-secret' },
    }))

    expect(response.status).toBe(401)
    expect(mocks.runSocialTopicBacklogDiscovery).not.toHaveBeenCalled()
  })

  it('returns the closed coverage gate without the collector failure text', async () => {
    mocks.runSocialTopicBacklogDiscovery.mockRejectedValueOnce(new mocks.SocialTopicCoverageError({
      status: 'blocked',
      blockers: ['[product_coverage_receipt_missing:agentified] Approve an Agentified summary.'],
    }))

    const response = await GET(new NextRequest('http://localhost/api/cron/social-topic-backlog', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBe('Topic backlog refresh is blocked until the required approved source receipts are available.')
    expect(body.blockers).toEqual([
      '[product_coverage_receipt_missing:agentified] Approve an Agentified summary.',
    ])
    expect(body.coverage_report.status).toBe('blocked')
    expect(JSON.stringify(body)).not.toContain('secret_catalog')
  })

  it('does not echo a non-error refresh failure', async () => {
    mocks.runSocialTopicBacklogDiscovery.mockRejectedValueOnce('relation secret_catalog is missing')

    const response = await POST(new NextRequest('http://localhost/api/cron/social-topic-backlog', {
      method: 'POST',
      headers: { authorization: 'Bearer n8n-secret' },
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Social topic backlog refresh failed' })
  })
})
