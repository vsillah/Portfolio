import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

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
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(body: unknown | string, asRaw = false) {
  if (asRaw) {
    return new NextRequest('http://localhost/api/admin/meetings/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body as string,
    })
  }
  return new NextRequest('http://localhost/api/admin/meetings/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/meetings/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects non-admin callers before touching the database', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ transcript: 'hello' }))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(makeRequest('{not-json', true))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 when transcript is missing or blank', async () => {
    const missing = await POST(makeRequest({ title: 'Sync' }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({
      error: 'transcript is required and must be non-empty',
    })

    const blank = await POST(makeRequest({ transcript: '   ' }))
    expect(blank.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts a meeting record with attendees and structured title notes', async () => {
    const inserted: Record<string, unknown>[] = []
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'meeting-1',
        meeting_type: 'external',
        meeting_date: '2026-07-01T12:00:00.000Z',
        transcript: 'Discussed hiring bottlenecks.',
        raw_notes: 'Hiring sync\n\nDiscussed hiring bottlenecks.',
        attendees: [{ name: 'Pat', email: 'pat@example.com' }],
        created_at: '2026-07-01T12:05:00.000Z',
      },
      error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn((row: Record<string, unknown>) => {
      inserted.push(row)
      return { select }
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') return { insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        transcript: 'Discussed hiring bottlenecks.',
        title: 'Hiring sync',
        meeting_date: '2026-07-01T12:00:00.000Z',
        attendee_name: 'Pat',
        attendee_email: 'pat@example.com',
      }),
    )

    expect(insert).toHaveBeenCalledTimes(1)
    expect(inserted[0]).toMatchObject({
      meeting_type: 'external',
      meeting_date: '2026-07-01T12:00:00.000Z',
      transcript: 'Discussed hiring bottlenecks.',
      raw_notes: 'Hiring sync\n\nDiscussed hiring bottlenecks.',
      attendees: [{ name: 'Pat', email: 'pat@example.com' }],
      structured_notes: { title: 'Hiring sync' },
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      meeting: {
        id: 'meeting-1',
        meeting_type: 'external',
        meeting_date: '2026-07-01T12:00:00.000Z',
        transcript: 'Discussed hiring bottlenecks.',
        raw_notes: 'Hiring sync\n\nDiscussed hiring bottlenecks.',
        attendees: [{ name: 'Pat', email: 'pat@example.com' }],
        created_at: '2026-07-01T12:05:00.000Z',
      },
    })
  })

  it('returns a generic 500 when insert fails', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation missing' },
    })
    mocks.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single }),
      }),
    })

    const response = await POST(makeRequest({ transcript: 'Notes only' }))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to save meeting record' })
  })
})
