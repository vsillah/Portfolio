import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

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
    count: data.length,
    order: vi.fn(() => query),
    range: vi.fn(() => query),
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

  it('supports the bounded 500-row research lineage lookup', async () => {
    const query = listQuery()

    const response = await GET(request(
      'http://localhost/api/admin/social-content/calendar?limit=999',
    ) as never)

    expect(response.status).toBe(200)
    expect(query.range).toHaveBeenCalledWith(0, 499)
  })

  it('pages more than 100 persisted releases without gaps or duplicates', async () => {
    const rows = Array.from({ length: 125 }, (_, index) => ({
      id: `release-${String(index).padStart(3, '0')}`,
      scheduled_for: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      metadata: {},
    }))
    let start = 0
    let end = 0
    const query: Record<string, unknown> = {
      order: vi.fn(() => query),
      range: vi.fn((from: number, to: number) => { start = from; end = to; return query }),
      then: (resolve: (value: unknown) => void) => resolve({ data: rows.slice(start, end + 1), count: rows.length, error: null }),
    }
    mocks.from.mockReturnValue({ select: vi.fn(() => query) })

    const first = await (await GET(request('http://localhost/api/admin/social-content/calendar?limit=100&offset=0') as never)).json()
    const second = await (await GET(request('http://localhost/api/admin/social-content/calendar?limit=100&offset=100') as never)).json()

    expect(first.page).toEqual({ offset: 0, limit: 100, total: 125, next_offset: 100 })
    expect(second.page).toEqual({ offset: 100, limit: 100, total: 125, next_offset: null })
    expect([...first.items, ...second.items].map((item: { id: string }) => item.id)).toEqual(rows.map((row) => row.id))
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true })
  })

  it('projects ten inactive Agentified Drafts only for the calendar review request', async () => {
    listQuery()
    const response = await GET(request(
      'http://localhost/api/admin/social-content/calendar?include_agentified_drafts=1',
    ) as never)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(10)
    expect(new Set(body.items.map((item: { id: string }) => item.id)).size).toBe(10)
    expect(body.items.every((item: { authorization_status: string; autonomy_eligible: boolean; metadata: { external_execution_enabled: boolean } }) =>
      item.authorization_status === 'draft' && item.autonomy_eligible === false && item.metadata.external_execution_enabled === false)).toBe(true)
    const carousel = body.items.find((item: { metadata: { agentified_asset_id: string } }) => item.metadata.agentified_asset_id === 'AW-IG-CAR-01')
    expect(carousel.metadata.approved_source_copy).toContain('## AW-IG-CAR-01')
    expect(carousel.metadata.copy_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(carousel.metadata.preview_media).toHaveLength(7)
  })

  it('fails closed if database rows claim an Agentified asset identity', async () => {
    listQuery([{ id: 'db-row', metadata: { agentified_asset_id: 'AW-LI-01' } }])
    const response = await GET(request(
      'http://localhost/api/admin/social-content/calendar?include_agentified_drafts=1',
    ) as never)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('ownership conflict') })
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
