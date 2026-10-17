import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, POST } from './route'

function postRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest('http://localhost/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('/api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('GET currently returns events without authentication', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 1, event_name: 'page_view', event_type: 'page_view' }],
      error: null,
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ limit }),
        }),
      }),
    })

    const response = await GET(new NextRequest('http://localhost/api/analytics'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      events: [{ id: 1, event_name: 'page_view', event_type: 'page_view' }],
    })
    expect(mocks.from).toHaveBeenCalledWith('analytics_events')
  })

  it('POST stores a v4 UUID user_id and anonymizes IPv4 last octets', async () => {
    const inserted: Record<string, unknown>[] = []
    mocks.from.mockImplementation((table: string) => {
      if (table === 'analytics_events') {
        return {
          insert: vi.fn(async (rows: Record<string, unknown>[]) => {
            inserted.push(rows[0])
            return { error: null }
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await POST(
      postRequest(
        {
          event_type: 'page_view',
          event_name: 'home',
          user_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        { 'x-forwarded-for': '192.168.10.77' },
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(inserted[0]).toMatchObject({
      event_type: 'page_view',
      event_name: 'home',
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      ip_address: '192.168.10.0',
    })
  })

  it('POST drops anonymous-style user_ids that are not UUIDs', async () => {
    const inserted: Record<string, unknown>[] = []
    mocks.from.mockReturnValue({
      insert: vi.fn(async (rows: Record<string, unknown>[]) => {
        inserted.push(rows[0])
        return { error: null }
      }),
    })

    const response = await POST(postRequest({ event_type: 'click', user_id: 'user_anon_1' }))

    expect(response.status).toBe(200)
    expect(inserted[0].user_id).toBeNull()
  })
})
