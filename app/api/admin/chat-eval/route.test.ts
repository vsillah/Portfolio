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

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/chat-eval${query}`)
}

function listQuery(result: { data: unknown; error: unknown; count?: number | null }) {
  const query = {
    select: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.lte.mockReturnValue(query)
  query.or.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  return query
}

function message(role: string, metadata?: Record<string, unknown> | null) {
  return { id: `${role}-id`, role, content: `${role} text`, metadata, created_at: '2026-09-01T00:00:00.000Z' }
}

const voiceSession = {
  id: 'row-voice',
  session_id: 'sess-voice',
  visitor_name: 'Ada',
  visitor_email: 'ada@example.com',
  is_escalated: true,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-02T00:00:00.000Z',
  prompt_version: 3,
  metadata: {
    recordingUrl: 'https://example.com/rec',
    durationSeconds: 42,
    summary: 'Talked through billing',
    endedReason: 'customer-ended',
  },
  chat_messages: [message('user', { source: 'voice' }), message('assistant', { channel: 'email' })],
  chat_evaluations: [
    {
      id: 'eval-1',
      rating: 'good',
      notes: 'Clear',
      category_id: 'cat-1',
      open_code: 'clear',
      evaluated_at: '2026-09-02T00:00:00.000Z',
      evaluation_categories: { name: 'Clarity', color: '#0f0' },
    },
  ],
}

const legacyChatSession = {
  id: 'row-chat',
  session_id: 'sess-chat',
  visitor_name: null,
  visitor_email: null,
  is_escalated: false,
  created_at: '2026-09-03T00:00:00.000Z',
  updated_at: '2026-09-03T00:00:00.000Z',
  prompt_version: null,
  metadata: {},
  chat_messages: [message('user', { source: 'text' }), message('assistant')],
  chat_evaluations: [],
}

const smsSession = {
  id: 'row-sms',
  session_id: 'sess-sms',
  visitor_name: 'Sam',
  visitor_email: null,
  is_escalated: false,
  created_at: '2026-09-04T00:00:00.000Z',
  updated_at: '2026-09-04T00:00:00.000Z',
  prompt_version: 1,
  metadata: null,
  chat_messages: [message('user', { channel: 'sms' })],
  chat_evaluations: [{ id: 'eval-sms', rating: 'bad', notes: null, category_id: null, open_code: null, evaluated_at: null, evaluation_categories: null }],
}

const emptySession = {
  id: 'row-empty',
  session_id: 'sess-empty',
  visitor_name: null,
  visitor_email: null,
  is_escalated: false,
  created_at: '2026-09-05T00:00:00.000Z',
  updated_at: '2026-09-05T00:00:00.000Z',
  metadata: {},
  chat_messages: [],
  chat_evaluations: [{ id: 'eval-empty', rating: null }],
}

describe('GET /api/admin/chat-eval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  it('rejects non-admins before querying sessions', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('uses the database count for pagination even after in-memory filters', async () => {
    const query = listQuery({ data: [voiceSession, legacyChatSession], error: null, count: 40 })
    mocks.from.mockReturnValue(query)

    const response = await GET(request('?page=2&limit=5&channel=voice'))
    const body = await response.json()

    expect(query.range).toHaveBeenCalledWith(5, 9)
    expect(query.gte).not.toHaveBeenCalled()
    expect(query.or).not.toHaveBeenCalled()
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0]).toMatchObject({
      session_id: 'sess-voice',
      channel: 'voice',
      message_count: 2,
      user_message_count: 1,
      assistant_message_count: 1,
      prompt_version: 3,
      recording_url: 'https://example.com/rec',
      call_duration_seconds: 42,
      evaluation: {
        id: 'eval-1',
        rating: 'good',
        category_name: 'Clarity',
        category_color: '#0f0',
      },
    })
    expect(body.pagination).toEqual({ page: 2, limit: 5, total: 40, totalPages: 8 })
  })

  it('defaults page and limit and treats an empty limit as 20', async () => {
    const query = listQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    await GET(request('?limit='))

    expect(query.range).toHaveBeenCalledWith(0, 19)
  })

  it('applies date bounds and interpolates search text into the or filter', async () => {
    const query = listQuery({ data: null, error: null, count: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(request('?dateFrom=2026-01-01&dateTo=2026-02-01&search=a,b%'))

    expect(query.gte).toHaveBeenCalledWith('created_at', '2026-01-01')
    expect(query.lte).toHaveBeenCalledWith('created_at', '2026-02-01')
    expect(query.or).toHaveBeenCalledWith(
      'session_id.ilike.%a,b%%,visitor_email.ilike.%a,b%%,visitor_name.ilike.%a,b%%'
    )
    expect(await response.json()).toEqual({
      sessions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
  })

  it('classifies chatbot as website chat, legacy text, or a missing source', async () => {
    mocks.from.mockReturnValue(listQuery({ data: [voiceSession, legacyChatSession, smsSession, emptySession], error: null, count: 4 }))

    const response = await GET(request('?channel=chatbot'))
    const body = await response.json()

    expect(body.sessions.map((session: { session_id: string }) => session.session_id)).toEqual(['sess-chat'])
    expect(body.sessions[0].channel).toBe('chatbot')
    expect(body.sessions[0].evaluation).toBeNull()
    expect(body.sessions[0]).not.toHaveProperty('prompt_version')
  })

  it('reserves the text channel for sms and keeps email on its own source', async () => {
    mocks.from.mockReturnValue(listQuery({ data: [voiceSession, smsSession], error: null, count: 2 }))
    const text = await GET(request('?channel=text'))
    expect((await text.json()).sessions.map((session: { session_id: string; channel: string }) => [session.session_id, session.channel])).toEqual([
      ['sess-sms', 'text'],
    ])

    mocks.from.mockReturnValue(listQuery({ data: [voiceSession, smsSession], error: null, count: 2 }))
    const email = await GET(request('?channel=email'))
    expect((await email.json()).sessions.map((session: { session_id: string }) => session.session_id)).toEqual(['sess-voice'])
  })

  it('keeps an unknown channel filter from dropping sessions that have messages', async () => {
    mocks.from.mockReturnValue(listQuery({ data: [legacyChatSession, emptySession], error: null, count: 2 }))

    const response = await GET(request('?channel=slack'))
    const body = await response.json()

    expect(body.sessions.map((session: { session_id: string }) => session.session_id)).toEqual(['sess-chat'])
  })

  it('lets an explicit rating win over the annotated flag', async () => {
    mocks.from.mockReturnValue(
      listQuery({ data: [voiceSession, legacyChatSession, smsSession, emptySession], error: null, count: 4 })
    )

    const response = await GET(request('?rating=good&annotated=false'))
    const body = await response.json()

    expect(body.sessions.map((session: { session_id: string }) => session.session_id)).toEqual(['sess-voice'])
  })

  it('treats unrated and annotated=false as sessions without a rating', async () => {
    mocks.from.mockReturnValue(
      listQuery({ data: [voiceSession, legacyChatSession, smsSession, emptySession], error: null, count: 4 })
    )
    const unrated = await GET(request('?rating=unrated'))
    expect((await unrated.json()).sessions.map((session: { session_id: string }) => session.session_id)).toEqual([
      'sess-chat',
      'sess-empty',
    ])

    mocks.from.mockReturnValue(
      listQuery({ data: [voiceSession, legacyChatSession, smsSession], error: null, count: 3 })
    )
    const annotated = await GET(request('?annotated=true'))
    expect((await annotated.json()).sessions.map((session: { session_id: string }) => session.session_id)).toEqual([
      'sess-voice',
      'sess-sms',
    ])
  })

  it('returns a generic error when the session query fails', async () => {
    mocks.from.mockReturnValue(listQuery({ data: null, error: { message: 'timeout' }, count: null }))

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch sessions' })
  })
})
