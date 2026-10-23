import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

import { GET } from './route'

function makeRequest(token?: string, query = '') {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest(`http://localhost/api/analytics/export${query}`, { headers })
}

function adminProfile() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      }),
    }),
  }
}

function mockAdminExport(events: unknown[], sessions: unknown[] = []) {
  const eventsOrder = vi.fn().mockResolvedValue({ data: events, error: null })
  const sessionsOrder = vi.fn().mockResolvedValue({ data: sessions, error: null })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'user_profiles') return adminProfile()
    if (table === 'analytics_events') {
      return {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({ order: eventsOrder }),
        }),
      }
    }
    if (table === 'analytics_sessions') {
      return {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({ order: sessionsOrder }),
        }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return { eventsOrder, sessionsOrder }
}

describe('GET /api/analytics/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects requests with no bearer token', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid sessions before reading analytics rows', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } })

    const response = await GET(makeRequest('tok'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects non-admin users before exporting', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'client' }, error: null }),
        }),
      }),
    })

    const response = await GET(makeRequest('tok'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
    expect(mocks.from).not.toHaveBeenCalledWith('analytics_events')
  })

  it('returns JSON events and sessions for an admin by default', async () => {
    mockAdminExport(
      [{ id: 1, event_type: 'click', event_name: 'cta', section: 'hero', created_at: '2026-09-14T00:00:00.000Z', metadata: { a: 1 } }],
      [{ id: 's1' }],
    )

    const response = await GET(makeRequest('tok'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.events).toHaveLength(1)
    expect(body.sessions).toEqual([{ id: 's1' }])
    expect(body.dateRange.days).toBe(7)
    expect(typeof body.exportedAt).toBe('string')
  })

  it('escapes quotes and commas in CSV cells', async () => {
    mockAdminExport([
      {
        event_type: 'click',
        event_name: 'Click "Buy", now',
        section: 'hero,cta',
        created_at: '2026-09-14T00:00:00.000Z',
        metadata: { note: 'say "hi"' },
      },
    ])

    const response = await GET(makeRequest('tok', '?format=csv'))
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('analytics-')
    expect(csv.split('\n')[0]).toBe('Event Type,Event Name,Section,Created At,Metadata')
    expect(csv).toContain('"Click ""Buy"", now"')
    expect(csv).toContain('"hero,cta"')
    expect(csv).toContain('""note""')
    expect(csv).toContain('\\""hi\\""')
  })
})
