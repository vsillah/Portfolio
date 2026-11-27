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

import { DELETE } from './route'

function makeRequest(token?: string, query = '') {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest(`http://localhost/api/analytics/cleanup${query}`, {
    method: 'DELETE',
    headers,
  })
}

describe('DELETE /api/analytics/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects requests with no bearer token', async () => {
    const response = await DELETE(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects non-admin users before deleting rows', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'client' }, error: null }),
        }),
      }),
    })

    const response = await DELETE(makeRequest('tok'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
    expect(mocks.from).not.toHaveBeenCalledWith('analytics_events')
  })

  it('deletes events and sessions older than the requested window', async () => {
    const eventsLt = vi.fn().mockResolvedValue({ error: null })
    const sessionsLt = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'analytics_events') {
        return { delete: vi.fn().mockReturnValue({ lt: eventsLt }) }
      }
      if (table === 'analytics_sessions') {
        return { delete: vi.fn().mockReturnValue({ lt: sessionsLt }) }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await DELETE(makeRequest('tok', '?days=14'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Deleted events and sessions older than 14 days',
    })
    expect(eventsLt).toHaveBeenCalledTimes(1)
    expect(sessionsLt).toHaveBeenCalledTimes(1)
    const cutoff = eventsLt.mock.calls[0][1] as string
    expect(Number.isNaN(Date.parse(cutoff))).toBe(false)
  })
})
