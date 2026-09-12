import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  fetchConversationContext: vi.fn(),
}))

vi.mock('@/lib/chat-context', () => ({
  fetchConversationContext: mocks.fetchConversationContext,
}))

import { GET } from './route'

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/chat/context${query}`)
}

describe('GET /api/chat/context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetchConversationContext.mockResolvedValue({
      history: [],
      sessionInfo: {
        sessionId: 'session01',
        isEscalated: false,
        hasVoiceMessages: false,
        hasTextMessages: true,
        messageCount: 0,
      },
    })
  })

  it('rejects a missing session id before fetching context', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request' })
    expect(mocks.fetchConversationContext).not.toHaveBeenCalled()
  })

  it('rejects an invalid session id format', async () => {
    const response = await GET(makeRequest('?sessionId=bad'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid request' })
    expect(mocks.fetchConversationContext).not.toHaveBeenCalled()
  })

  it('rejects a limit outside 1–100', async () => {
    const tooHigh = await GET(makeRequest('?sessionId=session01&limit=101'))
    const tooLow = await GET(makeRequest('?sessionId=session01&limit=0'))

    expect(tooHigh.status).toBe(400)
    expect(tooLow.status).toBe(400)
    expect(mocks.fetchConversationContext).not.toHaveBeenCalled()
  })

  it('defaults limit to 20 and returns fetched context', async () => {
    const response = await GET(makeRequest('?sessionId=session01'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.fetchConversationContext).toHaveBeenCalledWith('session01', 20)
    expect(body.sessionInfo.sessionId).toBe('session01')
  })

  it('returns a generic 500 when context fetch fails closed', async () => {
    mocks.fetchConversationContext.mockResolvedValue(null)

    const response = await GET(makeRequest('?sessionId=session01&limit=5'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch conversation context',
    })
    expect(mocks.fetchConversationContext).toHaveBeenCalledWith('session01', 5)
  })
})
