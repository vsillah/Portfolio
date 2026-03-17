import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}))

import { GET, POST } from './route'

function makeAuthorizedRequest(url: string, method: 'GET' | 'POST', body?: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      authorization: `Bearer ${process.env.N8N_INGEST_SECRET}`,
      'content-type': 'application/json',
    },
    body,
  })
}

function mockGetLookup(result: { data: unknown; error: { code?: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const eq = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ eq })

  fromMock.mockReturnValue({ select })

  return { select, eq, limit, maybeSingle }
}

function mockPostInsert(result: { error: { code?: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result)
  fromMock.mockReturnValue({ insert })
  return { insert }
}

describe('api/slack-meeting-dedupe route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'test-ingest-secret'
  })

  it('rejects unauthorized GET requests', async () => {
    const request = new NextRequest('https://example.com/api/slack-meeting-dedupe?event_id=evt_1')

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns duplicate false when GET event_id is missing', async () => {
    const request = makeAuthorizedRequest(
      'https://example.com/api/slack-meeting-dedupe',
      'GET'
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ duplicate: false })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns duplicate true when GET finds a processed event', async () => {
    const lookup = mockGetLookup({ data: { event_id: 'evt_1' }, error: null })
    const request = makeAuthorizedRequest(
      'https://example.com/api/slack-meeting-dedupe?event_id=evt_1',
      'GET'
    )

    const response = await GET(request)

    expect(fromMock).toHaveBeenCalledWith('slack_meeting_events_processed')
    expect(lookup.select).toHaveBeenCalledWith('event_id')
    expect(lookup.eq).toHaveBeenCalledWith('event_id', 'evt_1')
    expect(lookup.limit).toHaveBeenCalledWith(1)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ duplicate: true })
  })

  it('returns duplicate false when GET lookup errors', async () => {
    mockGetLookup({ data: null, error: { code: 'PGRST000' } })
    const request = makeAuthorizedRequest(
      'https://example.com/api/slack-meeting-dedupe?event_id=evt_1',
      'GET'
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ duplicate: false })
  })

  it('returns 400 for invalid POST JSON', async () => {
    const request = makeAuthorizedRequest(
      'https://example.com/api/slack-meeting-dedupe',
      'POST',
      '{bad json'
    )

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('treats duplicate POST inserts as success (idempotent)', async () => {
    const insert = mockPostInsert({ error: { code: '23505' } })
    const request = makeAuthorizedRequest(
      'https://example.com/api/slack-meeting-dedupe',
      'POST',
      JSON.stringify({ event_id: 'evt_1' })
    )

    const response = await POST(request)

    expect(fromMock).toHaveBeenCalledWith('slack_meeting_events_processed')
    expect(insert.insert).toHaveBeenCalledWith({ event_id: 'evt_1' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('returns 500 for non-unique POST insert errors', async () => {
    mockPostInsert({ error: { code: 'XX000' } })
    const request = makeAuthorizedRequest(
      'https://example.com/api/slack-meeting-dedupe',
      'POST',
      JSON.stringify({ event_id: 'evt_1' })
    )

    const response = await POST(request)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Insert failed' })
  })
})
