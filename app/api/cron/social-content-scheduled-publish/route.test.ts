import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  publishSocialContentItem: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/social-content-publisher', () => ({
  publishSocialContentItem: mocks.publishSocialContentItem,
}))

import { GET, POST } from './route'

function request(url: string, method = 'GET') {
  return new Request(url, {
    method,
    headers: { authorization: 'Bearer cron-secret' },
  })
}

function approvedGate(platforms: string[]) {
  return {
    platform_submission_gate: {
      status: 'approved',
      approved_at: '2026-08-05T12:00:00.000Z',
      approved_by: 'admin-1',
      platforms,
    },
  }
}

function installSupabase({
  items,
  publishesByContentId,
}: {
  items: Array<Record<string, unknown>>
  publishesByContentId: Record<string, Array<Record<string, unknown>>>
}) {
  const queueQuery: Record<string, unknown> = {
    data: items,
    error: null,
    eq: vi.fn(() => queueQuery),
    lte: vi.fn(() => queueQuery),
    order: vi.fn(() => queueQuery),
    limit: vi.fn(() => queueQuery),
  }

  const publishEq = vi.fn(async (_column: string, id: string) => ({
    data: publishesByContentId[id] ?? [],
    error: null,
  }))
  const publishSelect = vi.fn(() => ({ eq: publishEq }))

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') {
      return { select: vi.fn(() => queueQuery) }
    }
    if (table === 'social_content_publishes') {
      return { select: publishSelect }
    }
    return {}
  })

  return { queueQuery, publishEq }
}

describe('/api/cron/social-content-scheduled-publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = ''
  })

  it('rejects unauthenticated requests', async () => {
    const response = await GET(new Request('http://localhost/api/cron/social-content-scheduled-publish') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
  })

  it('dry-runs due approved scheduled rows without publishing', async () => {
    const { queueQuery } = installSupabase({
      items: [{
        id: 'social-x-3',
        status: 'scheduled',
        scheduled_for: '2026-08-05T20:00:00.000Z',
        rag_context: approvedGate(['x']),
      }],
      publishesByContentId: {
        'social-x-3': [{ platform: 'x', status: 'pending' }],
      },
    })

    const response = await GET(request('http://localhost/api/cron/social-content-scheduled-publish?dry_run=1&limit=5') as never)

    expect(response.status).toBe(200)
    expect(queueQuery.eq).toHaveBeenCalledWith('status', 'scheduled')
    expect(queueQuery.lte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(queueQuery.limit).toHaveBeenCalledWith(5)
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dry_run: true,
      checked_count: 1,
      published_count: 0,
      evaluated: [{
        id: 'social-x-3',
        status: 'eligible',
        platforms: ['x'],
      }],
      side_effects: {
        publish: false,
        external_post: false,
      },
    })
  })

  it('publishes due scheduled rows only when the final submission gate is approved', async () => {
    installSupabase({
      items: [
        {
          id: 'approved-social',
          status: 'scheduled',
          scheduled_for: '2026-08-05T20:00:00.000Z',
          rag_context: approvedGate(['x']),
        },
        {
          id: 'blocked-social',
          status: 'scheduled',
          scheduled_for: '2026-08-05T20:00:00.000Z',
          rag_context: null,
        },
      ],
      publishesByContentId: {
        'approved-social': [{ platform: 'x', status: 'failed' }],
        'blocked-social': [{ platform: 'x', status: 'pending' }],
      },
    })
    mocks.publishSocialContentItem.mockResolvedValue({
      status: 200,
      body: { published: true, results: [{ platform: 'x', result: { success: true } }] },
    })

    const response = await POST(request('http://localhost/api/cron/social-content-scheduled-publish', 'POST') as never)

    expect(response.status).toBe(200)
    expect(mocks.publishSocialContentItem).toHaveBeenCalledTimes(1)
    expect(mocks.publishSocialContentItem).toHaveBeenCalledWith(expect.objectContaining({
      id: 'approved-social',
      targetPlatforms: ['x'],
    }))
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dry_run: false,
      checked_count: 2,
      published_count: 1,
      blocked_count: 1,
      evaluated: [
        expect.objectContaining({ id: 'approved-social', status: 'published' }),
        expect.objectContaining({ id: 'blocked-social', status: 'blocked' }),
      ],
      side_effects: {
        publish: true,
        external_post: true,
      },
    })
  })
})
