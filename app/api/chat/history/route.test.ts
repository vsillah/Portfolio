import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { DELETE, GET } from './route'

function makeRequest(method: 'GET' | 'DELETE', query = '') {
  return new NextRequest(`http://localhost/api/chat/history${query}`, { method })
}

function sessionLookup(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

function messagesLookup(rows: unknown[], error: unknown = null) {
  const order = vi.fn().mockResolvedValue({ data: rows, error })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, order }
}

describe('GET /api/chat/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects a missing session id before querying', async () => {
    const response = await GET(makeRequest('GET'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns empty history when the session does not exist', async () => {
    mocks.from.mockReturnValue(sessionLookup(null, { message: 'not found' }))

    const response = await GET(makeRequest('GET', '?sessionId=session01'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ messages: [], session: null })
  })

  it('returns visitor identity and messages for a known session', async () => {
    const session = sessionLookup({
      id: 9,
      session_id: 'session01',
      visitor_email: 'ada@example.com',
      visitor_name: 'Ada',
      is_escalated: false,
      created_at: '2026-09-01T00:00:00.000Z',
    })
    const messages = messagesLookup([
      { id: 1, role: 'user', content: 'hello', metadata: {}, created_at: '2026-09-01T00:00:01.000Z' },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_sessions') return session
      if (table === 'chat_messages') return messages
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('GET', '?sessionId=session01'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.messages).toHaveLength(1)
    expect(body.session).toEqual({
      id: 9,
      sessionId: 'session01',
      visitorEmail: 'ada@example.com',
      visitorName: 'Ada',
      isEscalated: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    })
  })
})

describe('DELETE /api/chat/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects a missing session id before deleting', async () => {
    const response = await DELETE(makeRequest('DELETE'))

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes messages then the session for a valid id', async () => {
    const messageDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const sessionDeleteEq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_messages') {
        return { delete: vi.fn().mockReturnValue({ eq: messageDeleteEq }) }
      }
      if (table === 'chat_sessions') {
        return { delete: vi.fn().mockReturnValue({ eq: sessionDeleteEq }) }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await DELETE(makeRequest('DELETE', '?sessionId=session01'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(messageDeleteEq).toHaveBeenCalledWith('session_id', 'session01')
    expect(sessionDeleteEq).toHaveBeenCalledWith('session_id', 'session01')
  })
})
