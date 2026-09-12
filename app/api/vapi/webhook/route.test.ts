import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  sendToN8n: vi.fn(),
  fetchConversationContext: vi.fn(),
  createChatEscalation: vi.fn(),
  recordCostEvent: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/n8n', () => ({
  sendToN8n: mocks.sendToN8n,
}))

vi.mock('@/lib/chat-context', () => ({
  fetchConversationContext: mocks.fetchConversationContext,
}))

vi.mock('@/lib/chat-escalation', () => ({
  createChatEscalation: mocks.createChatEscalation,
  formatTranscriptFromHistory: (history: Array<{ role: string; content: string }>) =>
    history
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
      .join('\n\n'),
}))

vi.mock('@/lib/cost-calculator', () => ({
  recordCostEvent: mocks.recordCostEvent,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/vapi/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function mockTables({
  session = { data: null, error: null },
}: {
  session?: { data: unknown; error: unknown }
} = {}) {
  const inserts: Array<{ table: string; payload: unknown }> = []
  const updates: Array<{ table: string; payload: unknown }> = []

  mocks.from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(session),
      }),
    }),
    insert: vi.fn((payload: unknown) => {
      inserts.push({ table, payload })
      return Promise.resolve({ data: null, error: null })
    }),
    update: vi.fn((payload: unknown) => {
      updates.push({ table, payload })
      return {
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }),
  }))

  return { inserts, updates }
}

describe('POST /api/vapi/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendToN8n.mockResolvedValue({
      response: 'Here is the spoken answer.',
      escalated: false,
      metadata: { model: 'test-model' },
    })
    mocks.fetchConversationContext.mockResolvedValue({
      history: [
        {
          role: 'user',
          content: 'Earlier question',
          timestamp: '2026-08-21T10:00:00.000Z',
          source: 'text',
        },
      ],
      summary: 'Caller asked about services',
      sessionInfo: {
        sessionId: 'voice_call-1',
        visitorName: 'Ada',
        visitorEmail: 'ada@example.com',
        isEscalated: false,
        hasVoiceMessages: true,
        hasTextMessages: true,
        messageCount: 1,
      },
    })
    mocks.createChatEscalation.mockResolvedValue({ id: 'esc-1' })
    mocks.recordCostEvent.mockResolvedValue({ ok: true })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns 500 for invalid JSON payloads', async () => {
    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('acknowledges unknown message types without side effects', async () => {
    const response = await POST(makeRequest({ message: { type: 'speech-update' } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sendToN8n).not.toHaveBeenCalled()
  })

  it('acknowledges status updates that have no call payload', async () => {
    const response = await POST(makeRequest({ message: { type: 'status-update' } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a voice session when an in-progress call has no existing row', async () => {
    const { inserts } = mockTables({ session: { data: null, error: null } })

    const response = await POST(
      makeRequest({
        message: {
          type: 'status-update',
          call: {
            id: 'call-1',
            status: 'in-progress',
            customer: { name: 'Ada' },
            metadata: { sessionId: 'shared-session' },
          },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(inserts).toEqual([
      expect.objectContaining({
        table: 'chat_sessions',
        payload: expect.objectContaining({
          session_id: 'shared-session',
          visitor_name: 'Ada',
          metadata: expect.objectContaining({
            source: 'voice',
            vapiCallId: 'call-1',
          }),
        }),
      }),
    ])
  })

  it('ignores partial or non-user transcripts', async () => {
    mockTables()

    const partial = await POST(
      makeRequest({
        message: {
          type: 'transcript',
          role: 'user',
          transcript: 'hel',
          transcriptType: 'partial',
          call: { id: 'call-1', status: 'in-progress' },
        },
      }),
    )
    const assistant = await POST(
      makeRequest({
        message: {
          type: 'transcript',
          role: 'assistant',
          transcript: 'Hello there',
          transcriptType: 'final',
          call: { id: 'call-1', status: 'in-progress' },
        },
      }),
    )

    expect(partial.status).toBe(200)
    expect(assistant.status).toBe(200)
    expect(mocks.sendToN8n).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('persists a final user transcript, injects history, and returns the spoken reply', async () => {
    const { inserts, updates } = mockTables()

    const response = await POST(
      makeRequest({
        message: {
          type: 'transcript',
          role: 'user',
          transcript: 'Can you help me?',
          transcriptType: 'final',
          call: {
            id: 'call-1',
            status: 'in-progress',
            customer: { name: 'Ada' },
          },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      response: 'Here is the spoken answer.',
    })
    expect(mocks.sendToN8n).toHaveBeenCalledWith({
      message: 'Can you help me?',
      sessionId: 'voice_call-1',
      visitorName: 'Ada',
      visitorEmail: 'ada@example.com',
      source: 'voice',
      history: [
        {
          role: 'user',
          content: 'Earlier question',
          timestamp: '2026-08-21T10:00:00.000Z',
          source: 'text',
        },
      ],
      conversationSummary: 'Caller asked about services',
      hasCrossChannelHistory: true,
    })
    expect(inserts.filter((row) => row.table === 'chat_messages')).toHaveLength(2)
    expect(updates.some((row) => row.table === 'chat_sessions')).toBe(false)
    expect(mocks.createChatEscalation).not.toHaveBeenCalled()
  })

  it('marks the session escalated when n8n asks for a human', async () => {
    const { updates } = mockTables()
    mocks.sendToN8n.mockResolvedValue({
      response: 'I will get a person.',
      escalated: true,
      metadata: { fallback: true },
    })

    const response = await POST(
      makeRequest({
        message: {
          type: 'transcript',
          role: 'user',
          transcript: 'I need a human',
          transcriptType: 'final',
          call: { id: 'call-9', status: 'in-progress' },
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(updates).toContainEqual({
      table: 'chat_sessions',
      payload: { is_escalated: true },
    })
    expect(mocks.createChatEscalation).toHaveBeenCalledWith({
      sessionId: 'voice_call-9',
      source: 'voice',
      reason: 'fallback',
      visitorName: 'Ada',
      visitorEmail: 'ada@example.com',
      transcript: expect.stringContaining('I need a human'),
    })
  })

  it('returns a spoken apology when transcript processing throws', async () => {
    mockTables()
    mocks.sendToN8n.mockRejectedValue(new Error('n8n down'))

    const response = await POST(
      makeRequest({
        message: {
          type: 'transcript',
          role: 'user',
          transcript: 'Are you there?',
          transcriptType: 'final',
          call: { id: 'call-1', status: 'in-progress' },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      response: "I apologize, but I'm having trouble processing that. Could you please try again?",
    })
  })

  it('rejects function calls that omit functionCall data', async () => {
    const response = await POST(makeRequest({ message: { type: 'function-call' } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ error: 'No function call data' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a function result for startDiagnostic and logs the tool call', async () => {
    const { inserts } = mockTables()

    const response = await POST(
      makeRequest({
        message: {
          type: 'function-call',
          functionCall: { name: 'startDiagnostic', parameters: {} },
          call: { id: 'call-1', status: 'in-progress' },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: {
        message:
          "I'll start the diagnostic assessment now. Let me begin by understanding your current business challenges.",
        diagnosticStarted: true,
      },
    })
    expect(inserts).toEqual([
      expect.objectContaining({
        table: 'chat_messages',
        payload: expect.objectContaining({
          session_id: 'voice_call-1',
          content: '[Tool Call: startDiagnostic]',
          metadata: expect.objectContaining({
            isToolCall: true,
            toolCall: expect.objectContaining({
              name: 'startDiagnostic',
              success: true,
            }),
          }),
        }),
      }),
    ])
  })

  it('escalates transferToHuman and persists a Slack-bound escalation', async () => {
    const { updates } = mockTables()

    const response = await POST(
      makeRequest({
        message: {
          type: 'function-call',
          functionCall: { name: 'transferToHuman', parameters: {} },
          call: {
            id: 'call-2',
            status: 'in-progress',
            customer: { name: 'Bo' },
          },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: {
        message: "I'll connect you with a human team member. They'll be in touch shortly.",
        escalated: true,
      },
    })
    expect(updates).toContainEqual({
      table: 'chat_sessions',
      payload: { is_escalated: true },
    })
    expect(mocks.createChatEscalation).toHaveBeenCalledWith({
      sessionId: 'voice_call-2',
      source: 'voice',
      reason: 'transfer_to_human',
      visitorName: 'Bo',
      visitorEmail: 'ada@example.com',
      transcript: 'User: Earlier question',
    })
  })

  it('returns an error result for unknown function names', async () => {
    mockTables()

    const response = await POST(
      makeRequest({
        message: {
          type: 'function-call',
          functionCall: { name: 'deleteAllLeads', parameters: {} },
          call: { id: 'call-1', status: 'in-progress' },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      error: 'Unknown function: deleteAllLeads',
    })
  })

  it('acknowledges end-of-call reports without a call object', async () => {
    const response = await POST(makeRequest({ message: { type: 'end-of-call-report' } }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(mocks.recordCostEvent).not.toHaveBeenCalled()
  })

  it('records VAPI call cost and stores the report when duration is positive', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-21T10:02:00.000Z'))
    const { updates } = mockTables({
      session: {
        data: { metadata: { startedAt: '2026-08-21T10:00:00.000Z', source: 'voice' } },
        error: null,
      },
    })

    const response = await POST(
      makeRequest({
        message: {
          type: 'end-of-call-report',
          endedReason: 'assistant-ended',
          summary: 'Discussed onboarding',
          transcript: 'full transcript',
          recordingUrl: 'https://recordings.example/call-1.wav',
          call: { id: 'call-1', status: 'ended' },
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    const perMinute = Number.parseFloat(process.env.VAPI_COST_PER_MINUTE || '0.05')
    expect(mocks.recordCostEvent).toHaveBeenCalledWith({
      occurred_at: '2026-08-21T10:02:00.000Z',
      source: 'vapi_call',
      amount: Math.round(2 * perMinute * 10000) / 10000,
      reference_type: 'vapi_call',
      reference_id: 'call-1',
      metadata: { durationSeconds: 120, sessionId: 'voice_call-1' },
    })
    expect(updates).toEqual([
      {
        table: 'chat_sessions',
        payload: {
          metadata: expect.objectContaining({
            source: 'voice',
            vapiCallId: 'call-1',
            startedAt: '2026-08-21T10:00:00.000Z',
            endedAt: '2026-08-21T10:02:00.000Z',
            durationSeconds: 120,
            endedReason: 'assistant-ended',
            summary: 'Discussed onboarding',
            recordingUrl: 'https://recordings.example/call-1.wav',
          }),
        },
      },
    ])
  })

  it('does not record cost when the call duration cannot be computed', async () => {
    mockTables({ session: { data: { metadata: {} }, error: null } })

    const response = await POST(
      makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { id: 'call-1', status: 'ended' },
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.recordCostEvent).not.toHaveBeenCalled()
  })
})
