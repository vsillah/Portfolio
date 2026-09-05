import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  notifyMeetingBooked: vi.fn(),
  notifyChatTranscript: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/notifications', () => ({
  notifyMeetingBooked: mocks.notifyMeetingBooked,
  notifyChatTranscript: mocks.notifyChatTranscript,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/chat/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  to: 'ada@example.com',
  templateType: 'meeting_confirmation',
  sessionId: 'session-1',
  data: { name: 'Ada' },
}

describe('POST /api/chat/send-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.notifyMeetingBooked.mockResolvedValue(undefined)
    mocks.notifyChatTranscript.mockResolvedValue(undefined)
  })

  it('rejects an invalid session id before querying chat_sessions', async () => {
    const response = await POST(
      makeRequest({
        ...validBody,
        sessionId: 'bad',
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 403 when the chat session is missing', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid session' })
    expect(mocks.notifyMeetingBooked).not.toHaveBeenCalled()
  })

  it('blocks sending to an email that does not match the session', async () => {
    const sessionSingle = vi.fn().mockResolvedValue({
      data: { id: '1', visitor_email: 'owner@example.com', user_id: null },
      error: null,
    })
    const sessionEq = vi.fn().mockReturnValue({ single: sessionSingle })
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq })
    mocks.from.mockReturnValue({ select: sessionSelect })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Email does not match session' })
    expect(mocks.notifyMeetingBooked).not.toHaveBeenCalled()
  })

  it('requires a transcript for chat_summary', async () => {
    const sessionSingle = vi.fn().mockResolvedValue({
      data: { id: '1', visitor_email: 'ada@example.com', user_id: null },
      error: null,
    })
    const sessionEq = vi.fn().mockReturnValue({ single: sessionSingle })
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq })
    mocks.from.mockReturnValue({ select: sessionSelect })

    const response = await POST(
      makeRequest({
        to: 'ada@example.com',
        templateType: 'chat_summary',
        sessionId: 'session-1',
        data: { name: 'Ada' },
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Transcript is required for chat_summary',
    })
    expect(mocks.notifyChatTranscript).not.toHaveBeenCalled()
  })

  it('sends to an arbitrary recipient when the session has no visitor or user email', async () => {
    const sessionSingle = vi.fn().mockResolvedValue({
      data: { id: '1', visitor_email: null, user_id: null },
      error: null,
    })
    const sessionEq = vi.fn().mockReturnValue({ single: sessionSingle })
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq })
    mocks.from.mockReturnValue({ select: sessionSelect })

    const response = await POST(
      makeRequest({
        ...validBody,
        to: 'stranger@example.com',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.notifyMeetingBooked).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: 'stranger@example.com' }),
    )
  })

  it('sends to an arbitrary recipient when a linked profile has no email', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'chat_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: '1', visitor_email: null, user_id: 'user-9' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { email: null }, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await POST(
      makeRequest({
        ...validBody,
        to: 'stranger@example.com',
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.notifyMeetingBooked).toHaveBeenCalledWith(
      expect.objectContaining({ clientEmail: 'stranger@example.com' }),
    )
    expect(mocks.from).toHaveBeenCalledWith('user_profiles')
  })

  it('sends a meeting confirmation to the session visitor', async () => {
    const sessionSingle = vi.fn().mockResolvedValue({
      data: { id: '1', visitor_email: 'ada@example.com', user_id: null },
      error: null,
    })
    const sessionEq = vi.fn().mockReturnValue({ single: sessionSingle })
    const sessionSelect = vi.fn().mockReturnValue({ eq: sessionEq })
    mocks.from.mockReturnValue({ select: sessionSelect })

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.notifyMeetingBooked).toHaveBeenCalledWith({
      clientEmail: 'ada@example.com',
      clientName: 'Ada',
      meetingType: undefined,
      meetingDate: undefined,
      meetingTime: undefined,
      calendlyLink: undefined,
    })
  })
})
