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

import { POST } from './route'

function makeRequest(token?: string, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest('http://localhost/api/contact/mark-read', {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('POST /api/contact/mark-read', () => {
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
    const response = await POST(makeRequest(undefined, { id: 1 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects non-admin users before accepting a mark-read body', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'client' }, error: null }),
        }),
      }),
    })

    const response = await POST(makeRequest('tok', { all: true }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
  })

  it('returns 400 when neither all nor id is provided', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        }),
      }),
    })

    const response = await POST(makeRequest('tok', {}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' })
  })

  it('acknowledges all or a specific id without writing a read column', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        }),
      }),
    })

    const all = await POST(makeRequest('tok', { all: true }))
    expect(all.status).toBe(200)
    await expect(all.json()).resolves.toMatchObject({
      success: true,
      message: 'All submissions marked as read',
    })

    const one = await POST(makeRequest('tok', { id: 12 }))
    expect(one.status).toBe(200)
    await expect(one.json()).resolves.toMatchObject({
      success: true,
      message: 'Submission marked as read',
    })

    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
    expect(mocks.from).not.toHaveBeenCalledWith('contact_submissions')
  })
})
