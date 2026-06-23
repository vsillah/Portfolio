import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, POST } from './route'

function request(url: string, body?: Record<string, unknown>) {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function listQuery(data: unknown[] = []) {
  const query: Record<string, unknown> = {
    data,
    error: null,
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    lt: vi.fn(() => query),
  }
  mocks.from.mockReturnValue({ select: vi.fn(() => query) })
  return query
}

describe('/api/admin/social-content/calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth when listing calendar items', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('http://localhost/api/admin/social-content/calendar') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('filters by campaign, channel, phase, due window, and authorization state', async () => {
    const query = listQuery([{ id: 'calendar-1', title: 'Tease item' }])

    const response = await GET(request(
      'http://localhost/api/admin/social-content/calendar?campaign_id=campaign-1&channel=youtube_shorts&campaign_phase=teach&authorization_status=pending&due_window=24h',
    ) as never)

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('social_content_calendar_items')
    expect(query.eq).toHaveBeenCalledWith('campaign_id', 'campaign-1')
    expect(query.eq).toHaveBeenCalledWith('channel', 'youtube_shorts')
    expect(query.eq).toHaveBeenCalledWith('campaign_phase', 'teach')
    expect(query.eq).toHaveBeenCalledWith('authorization_status', 'pending')
    expect(query.gte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(query.lte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(await response.json()).toMatchObject({
      items: [{ id: 'calendar-1' }],
      side_effects: { publish: false, external_post: false },
    })
  })

  it('creates a pending calendar item without external side effects', async () => {
    const single = vi.fn(async () => ({
      data: { id: 'calendar-new', title: 'Teach item', authorization_status: 'pending' },
      error: null,
    }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    mocks.from.mockReturnValue({ insert })

    const response = await POST(request('http://localhost/api/admin/social-content/calendar', {
      campaign_id: 'campaign-1',
      title: 'Teach item',
      channel: 'linkedin',
      campaign_phase: 'teach',
      scheduled_for: '2026-06-25T14:00:00.000Z',
      planned_angle: 'Teach the campaign framework.',
    }) as never)

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      campaign_id: 'campaign-1',
      title: 'Teach item',
      channel: 'linkedin',
      campaign_phase: 'teach',
      authorization_status: 'pending',
      autonomy_eligible: false,
      created_by: 'admin-user',
      metadata: expect.objectContaining({
        external_execution_enabled: false,
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      item: { id: 'calendar-new' },
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        external_post: false,
      },
    })
  })
})
