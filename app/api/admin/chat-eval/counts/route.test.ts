import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/chat-eval/counts')
}

function sessionsQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

function session(
  messages: Array<{ metadata?: { source?: string; channel?: string } | null }>,
  rating?: string
) {
  return {
    id: `session-${messages.length}-${rating ?? 'none'}`,
    chat_messages: messages,
    chat_evaluations: rating ? [{ rating }] : [],
  }
}

describe('GET /api/admin/chat-eval/counts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  it('rejects non-admins before reading sessions', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a generic error when the session query fails', async () => {
    mocks.from.mockReturnValue(sessionsQuery({ data: null, error: { message: 'relation missing' } }))

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch counts' })
  })

  it('counts channels from source or channel and keeps annotation buckets separate', async () => {
    const query = sessionsQuery({
      data: [
        session(
          [{ metadata: { source: 'voice', channel: 'email' } }, { metadata: { channel: 'email' } }],
          'good'
        ),
        session([{ metadata: { source: 'chatbot' } }], 'bad'),
        session([{ metadata: { source: 'text' } }]),
        session([{ metadata: null }]),
        session([{ metadata: { source: '', channel: 'sms' } }], 'good'),
        session([{ metadata: { channel: 'email' } }], 'meh'),
        session([], 'bad'),
      ],
      error: null,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      channel: { voice: 1, text: 1, email: 2, chatbot: 3 },
      annotated: 5,
      unannotated: 2,
      good: 2,
      bad: 2,
    })
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns zero counts when the session list is null', async () => {
    mocks.from.mockReturnValue(sessionsQuery({ data: null, error: null }))

    const response = await GET(request())

    expect(await response.json()).toEqual({
      channel: { voice: 0, text: 0, email: 0, chatbot: 0 },
      annotated: 0,
      unannotated: 0,
      good: 0,
      bad: 0,
    })
  })

  it('hides thrown errors behind a generic response', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('socket hang up')
    })

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})
