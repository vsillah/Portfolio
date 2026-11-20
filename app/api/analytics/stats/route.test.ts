import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    event_type: 'page_view',
    event_name: 'home',
    section: 'hero',
    metadata: null,
    created_at: '2026-09-14T12:00:00.000Z',
    ...overrides,
  }
}

function mockTables(events: unknown[], sessions: unknown[] = [], eventsError: unknown = null) {
  const eventsGte = vi.fn().mockResolvedValue({ data: events, error: eventsError })
  const sessionsGte = vi.fn().mockResolvedValue({ data: sessions, error: null })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'analytics_events') {
      return { select: vi.fn().mockReturnValue({ gte: eventsGte }) }
    }
    if (table === 'analytics_sessions') {
      return { select: vi.fn().mockReturnValue({ gte: sessionsGte }) }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return { eventsGte, sessionsGte }
}

describe('GET /api/analytics/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T10:00:00.000Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('currently returns aggregated stats without authentication', async () => {
    mockTables(
      [
        event({ id: 1, event_type: 'page_view', event_name: 'home', section: 'hero' }),
        event({ id: 2, event_type: 'click', event_name: 'cta', section: 'hero' }),
        event({ id: 3, event_type: 'form_submit', event_name: 'contact', section: null }),
        event({
          id: 4,
          event_type: 'click',
          event_name: 'project_click',
          section: null,
          metadata: { projectTitle: 'Alpha' },
        }),
        event({
          id: 5,
          event_type: 'click',
          event_name: 'project_click',
          section: null,
          metadata: { projectTitle: 'Beta' },
        }),
        event({
          id: 6,
          event_type: 'click',
          event_name: 'project_click',
          section: null,
          metadata: { projectTitle: 'Alpha' },
        }),
        event({
          id: 7,
          event_type: 'click',
          event_name: 'video_play',
          section: null,
          metadata: { videoTitle: 'Intro' },
        }),
        event({
          id: 8,
          event_type: 'click',
          event_name: 'social_click',
          section: null,
          metadata: { platform: 'linkedin' },
        }),
      ],
      [{ id: 's1' }, { id: 's2' }],
    )

    const response = await GET(new NextRequest('http://localhost/api/analytics/stats'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalEvents).toBe(8)
    expect(body.totalSessions).toBe(2)
    expect(body.totalPageViews).toBe(1)
    expect(body.totalClicks).toBe(6)
    expect(body.totalFormSubmits).toBe(1)
    expect(body.eventsByType).toEqual({ page_view: 1, click: 6, form_submit: 1 })
    expect(body.eventsBySection).toEqual({ hero: 2 })
    expect(body.topProjects).toEqual([
      { title: 'Alpha', clicks: 2 },
      { title: 'Beta', clicks: 1 },
    ])
    expect(body.topVideos).toEqual([{ title: 'Intro', plays: 1 }])
    expect(body.socialClicks).toEqual({ linkedin: 1 })
    expect(body.recentEvents).toHaveLength(8)
  })

  it('uses the days query window when fetching events and sessions', async () => {
    const { eventsGte, sessionsGte } = mockTables([], [])

    const response = await GET(new NextRequest('http://localhost/api/analytics/stats?days=3'))

    expect(response.status).toBe(200)
    expect(eventsGte).toHaveBeenCalledWith('created_at', '2026-09-12T10:00:00.000Z')
    expect(sessionsGte).toHaveBeenCalledWith('started_at', '2026-09-12T10:00:00.000Z')
  })

  it('returns recent events newest-first and caps top lists at five', async () => {
    const events = Array.from({ length: 6 }, (_, index) =>
      event({
        id: index + 1,
        event_name: 'project_click',
        metadata: { projectTitle: `Project ${index + 1}` },
        created_at: `2026-09-0${index + 1}T00:00:00.000Z`,
      }),
    )
    mockTables(events)

    const body = await (await GET(new NextRequest('http://localhost/api/analytics/stats'))).json()

    expect(body.topProjects).toHaveLength(5)
    expect(body.recentEvents[0].created_at).toBe('2026-09-06T00:00:00.000Z')
    expect(body.recentEvents[5].created_at).toBe('2026-09-01T00:00:00.000Z')
  })

  it('returns 500 when the events query fails', async () => {
    mockTables([], [], { message: 'db down' })

    const response = await GET(new NextRequest('http://localhost/api/analytics/stats'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch analytics stats' })
  })
})
