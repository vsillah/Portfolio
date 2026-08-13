import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  publishSocialContentItem: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/social-content-publisher', () => ({
  publishSocialContentItem: mocks.publishSocialContentItem,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
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
  const queueQueries: Array<Record<string, unknown>> = []
  const queueSelect = vi.fn(() => {
    let lowerBound: string | null = null
    let upperBound: string | null = null
    let staleBefore: string | null = null
    let ascending = true
    const queueQuery: Record<string, unknown> = {
      eq: vi.fn(() => queueQuery),
      gte: vi.fn((_column: string, value: string) => {
        lowerBound = value
        return queueQuery
      }),
      lte: vi.fn((_column: string, value: string) => {
        upperBound = value
        return queueQuery
      }),
      lt: vi.fn((_column: string, value: string) => {
        staleBefore = value
        return queueQuery
      }),
      order: vi.fn((_column: string, options: { ascending: boolean }) => {
        ascending = options.ascending
        return queueQuery
      }),
      limit: vi.fn(async (limit: number) => {
        const rows = items
          .filter((item) => {
            const scheduledAt = new Date(String(item.scheduled_for)).getTime()
            return (!lowerBound || scheduledAt >= new Date(lowerBound).getTime())
              && (!upperBound || scheduledAt <= new Date(upperBound).getTime())
              && (!staleBefore || scheduledAt < new Date(staleBefore).getTime())
          })
          .sort((left, right) => {
            const difference = new Date(String(left.scheduled_for)).getTime()
              - new Date(String(right.scheduled_for)).getTime()
            return ascending ? difference : -difference
          })
          .slice(0, limit)
        return { data: rows, error: null }
      }),
    }
    queueQueries.push(queueQuery)
    return queueQuery
  })

  const publishEq = vi.fn(async (_column: string, id: string) => ({
    data: publishesByContentId[id] ?? [],
    error: null,
  }))
  const publishSelect = vi.fn(() => ({ eq: publishEq }))
  const publishPlatformIn = vi.fn(async () => ({ error: null }))
  const publishStatusIn = vi.fn(() => ({ in: publishPlatformIn }))
  const publishUpdateEq = vi.fn(() => ({ in: publishStatusIn }))
  const publishUpdate = vi.fn(() => ({ eq: publishUpdateEq }))

  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') {
      return { select: queueSelect }
    }
    if (table === 'social_content_publishes') {
      return { select: publishSelect, update: publishUpdate }
    }
    return {}
  })

  return { queueQueries, publishEq, publishUpdate, publishUpdateEq, publishStatusIn, publishPlatformIn }
}

describe('/api/cron/social-content-scheduled-publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = ''
    delete process.env.SOCIAL_CONTENT_SCHEDULED_PUBLISH_STALE_HOURS
    mocks.createAgentWorkItem.mockImplementation(async (input) => ({
      id: `work-${String(input.idempotencyKey)}`,
    }))
  })

  it('rejects unauthenticated requests', async () => {
    const response = await GET(new Request('http://localhost/api/cron/social-content-scheduled-publish') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
  })

  it('dry-runs due approved scheduled rows without publishing', async () => {
    const scheduledFor = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { queueQueries } = installSupabase({
      items: [{
        id: 'social-x-3',
        status: 'scheduled',
        scheduled_for: scheduledFor,
        rag_context: approvedGate(['x']),
      }],
      publishesByContentId: {
        'social-x-3': [{ platform: 'x', status: 'pending' }],
      },
    })

    const response = await GET(request('http://localhost/api/cron/social-content-scheduled-publish?dry_run=1&limit=5') as never)

    expect(response.status).toBe(200)
    expect(queueQueries).toHaveLength(2)
    expect(queueQueries[0].eq).toHaveBeenCalledWith('status', 'scheduled')
    expect(queueQueries[0].gte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(queueQueries[0].lte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(queueQueries[0].limit).toHaveBeenCalledWith(5)
    expect(queueQueries[1].lt).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(queueQueries[1].limit).toHaveBeenCalledWith(5)
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dry_run: true,
      stale_threshold_hours: 24,
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
    const scheduledFor = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { publishUpdate, publishStatusIn, publishPlatformIn } = installSupabase({
      items: [
        {
          id: 'approved-social',
          status: 'scheduled',
          scheduled_for: scheduledFor,
          rag_context: approvedGate(['x']),
        },
        {
          id: 'blocked-social',
          status: 'scheduled',
          scheduled_for: scheduledFor,
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
    expect(publishUpdate).toHaveBeenCalledWith({
      error_message: expect.stringContaining('final platform submission approval is incomplete'),
    })
    expect(publishStatusIn).toHaveBeenCalledWith('status', ['pending', 'failed'])
    expect(publishPlatformIn).toHaveBeenCalledWith('platform', ['x'])
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'social-content-scheduled-publish-recovery:publish_blocked:blocked-social',
      metadata: expect.objectContaining({
        recovery_action: 'resolve_blocker_and_reconfirm',
        social_content_path: '/admin/social-content/blocked-social',
      }),
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

  it('never publishes stale rows and creates one idempotent reschedule-or-cancel recovery item', async () => {
    const scheduledFor = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const { publishUpdate } = installSupabase({
      items: [{
        id: 'stale-social-x',
        status: 'scheduled',
        scheduled_for: scheduledFor,
        rag_context: approvedGate(['x']),
      }],
      publishesByContentId: {
        'stale-social-x': [{ platform: 'x', status: 'pending' }],
      },
    })

    const response = await POST(request('http://localhost/api/cron/social-content-scheduled-publish?stale_hours=999', 'POST') as never)

    expect(response.status).toBe(200)
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
    expect(publishUpdate).toHaveBeenCalledWith({
      error_message: expect.stringContaining('outside the automatic publish safety window'),
    })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(1)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'urgent',
      idempotencyKey: 'social-content-scheduled-publish-recovery:stale_schedule:stale-social-x',
      metadata: expect.objectContaining({
        recovery_action: 'reschedule_reconfirm_or_cancel',
        external_execution_enabled: false,
        side_effects: expect.objectContaining({ publish: false, external_post: false }),
      }),
    }))
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      stale_threshold_hours: 168,
      published_count: 0,
      blocked_count: 1,
      evaluated: [{
        id: 'stale-social-x',
        status: 'stale',
        blocker_persisted: true,
      }],
      side_effects: { publish: false, external_post: false },
    })
  })

  it('persists sanitized attempt blockers and continues to later rows', async () => {
    const scheduledFor = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { publishUpdate } = installSupabase({
      items: [
        {
          id: 'provider-blocked',
          status: 'scheduled',
          scheduled_for: scheduledFor,
          rag_context: approvedGate(['x']),
        },
        {
          id: 'later-success',
          status: 'scheduled',
          scheduled_for: scheduledFor,
          rag_context: approvedGate(['x']),
        },
      ],
      publishesByContentId: {
        'provider-blocked': [{ platform: 'x', status: 'pending' }],
        'later-success': [{ platform: 'x', status: 'pending' }],
      },
    })
    mocks.publishSocialContentItem
      .mockResolvedValueOnce({ status: 409, body: { error: 'secret provider detail' } })
      .mockResolvedValueOnce({ status: 200, body: { published: true } })

    const response = await POST(request('http://localhost/api/cron/social-content-scheduled-publish', 'POST') as never)
    const body = await response.json()

    expect(mocks.publishSocialContentItem).toHaveBeenCalledTimes(2)
    expect(publishUpdate).toHaveBeenCalledWith({
      error_message: 'Scheduled publish did not complete. Review the publish blocker in Social Content before retrying.',
    })
    expect(JSON.stringify(body)).not.toContain('secret provider detail')
    expect(body).toMatchObject({
      published_count: 1,
      blocked_count: 1,
      evaluated: [
        expect.objectContaining({ id: 'provider-blocked', status: 'blocked', blocker_persisted: true }),
        expect.objectContaining({ id: 'later-success', status: 'published' }),
      ],
    })
  })

  it('does not let a full stale partition starve an in-window row during dry-run', async () => {
    const inWindowAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const staleAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    installSupabase({
      items: [
        { id: 'stale-1', status: 'scheduled', scheduled_for: staleAt, rag_context: approvedGate(['x']) },
        { id: 'stale-2', status: 'scheduled', scheduled_for: staleAt, rag_context: approvedGate(['x']) },
        { id: 'stale-3', status: 'scheduled', scheduled_for: staleAt, rag_context: approvedGate(['x']) },
        { id: 'in-window', status: 'scheduled', scheduled_for: inWindowAt, rag_context: approvedGate(['x']) },
      ],
      publishesByContentId: {
        'stale-1': [{ platform: 'x', status: 'pending' }],
        'stale-2': [{ platform: 'x', status: 'pending' }],
        'stale-3': [{ platform: 'x', status: 'pending' }],
        'in-window': [{ platform: 'x', status: 'pending' }],
      },
    })

    const response = await GET(request(
      'http://localhost/api/cron/social-content-scheduled-publish?dry_run=1&limit=2',
    ) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      checked_count: 3,
      in_window_checked_count: 1,
      stale_checked_count: 2,
      evaluated: [
        expect.objectContaining({ id: 'in-window', status: 'eligible' }),
        expect.objectContaining({ status: 'stale', dry_run: true }),
        expect.objectContaining({ status: 'stale', dry_run: true }),
      ],
      side_effects: { publish: false, external_post: false },
    })
  })

  it('blocks zero publish rows with readiness recovery but skips terminal-only records', async () => {
    const scheduledFor = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    installSupabase({
      items: [
        { id: 'missing-publishes', status: 'scheduled', scheduled_for: scheduledFor, rag_context: approvedGate(['instagram']) },
        { id: 'terminal-publishes', status: 'scheduled', scheduled_for: scheduledFor, rag_context: approvedGate(['x']) },
      ],
      publishesByContentId: {
        'missing-publishes': [],
        'terminal-publishes': [{ platform: 'x', status: 'published' }],
      },
    })

    const response = await POST(request('http://localhost/api/cron/social-content-scheduled-publish', 'POST') as never)

    expect(response.status).toBe(200)
    expect(mocks.publishSocialContentItem).not.toHaveBeenCalled()
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(1)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'social-content-scheduled-publish-recovery:publish_blocked:missing-publishes',
      metadata: expect.objectContaining({
        social_content_id: 'missing-publishes',
        target_platforms: [],
        blocker: expect.stringContaining('publish readiness could not be verified'),
      }),
    }))
    await expect(response.json()).resolves.toMatchObject({
      blocked_count: 1,
      evaluated: [
        expect.objectContaining({
          id: 'missing-publishes',
          status: 'blocked',
          readiness: 'unverified',
          blocker_persisted: false,
        }),
        expect.objectContaining({
          id: 'terminal-publishes',
          status: 'skipped',
          reason: 'No pending or failed publish rows remain.',
        }),
      ],
    })
  })
})
