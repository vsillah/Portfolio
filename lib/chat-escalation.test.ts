import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import {
  createChatEscalation,
  formatTranscriptFromHistory,
  notifySlackChatEscalation,
  truncateTranscript,
} from './chat-escalation'

function thenableList(data: unknown) {
  const query: {
    select: ReturnType<typeof vi.fn>
    ilike: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled) => Promise.resolve({ data }).then(onFulfilled),
  }
  query.select.mockReturnValue(query)
  query.ilike.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

describe('formatTranscriptFromHistory', () => {
  it('labels user, support, and assistant turns', () => {
    expect(formatTranscriptFromHistory([
      { role: 'user', content: 'I need a person' },
      { role: 'assistant', content: 'I can help' },
      { role: 'support', content: 'Joining now' },
    ])).toBe('User: I need a person\n\nAssistant: I can help\n\nSupport: Joining now')
  })

  it('keeps the tail when the transcript exceeds the stored limit', () => {
    const history = Array.from({ length: 400 }, (_, i) => ({
      role: 'user',
      content: `turn-${i}-${'x'.repeat(30)}`,
    }))
    const formatted = formatTranscriptFromHistory(history)

    expect(formatted.startsWith('...[truncated]\n\n')).toBe(true)
    expect(formatted.length).toBeLessThanOrEqual(8000)
    expect(formatted).toContain('turn-399')
    expect(formatted).not.toContain('turn-0-')
  })
})

describe('truncateTranscript', () => {
  it('returns short transcripts unchanged', () => {
    expect(truncateTranscript('hello')).toBe('hello')
  })
})

describe('notifySlackChatEscalation', () => {
  const originalWebhook = process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL

  afterEach(() => {
    if (originalWebhook === undefined) {
      delete process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL
    } else {
      process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL = originalWebhook
    }
  })

  it('does not POST when the webhook env is missing or not https', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    delete process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL
    await expect(notifySlackChatEscalation({
      sessionId: 'session01',
      source: 'text',
      transcript: 'hello',
    })).resolves.toBe(false)

    process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL = 'http://insecure.example/hooks'
    await expect(notifySlackChatEscalation({
      sessionId: 'session01',
      source: 'text',
      transcript: 'hello',
    })).resolves.toBe(false)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('createChatEscalation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL
  })

  it('auto-links when exactly one contact matches the visitor email', async () => {
    const contacts = thenableList([{ id: 42 }])
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 9 }, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return contacts
      if (table === 'chat_escalations') return { insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    await expect(createChatEscalation({
      sessionId: 'session01',
      source: 'text',
      reason: 'user_requested_human',
      visitorEmail: '  Lead@Example.com ',
      visitorName: 'Pat',
      transcript: 'User: help',
    })).resolves.toBe(9)

    expect(contacts.ilike).toHaveBeenCalledWith('email', 'lead@example.com')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      session_id: 'session01',
      source: 'text',
      visitor_email: '  Lead@Example.com ',
      contact_submission_id: 42,
    }))
  })

  it('skips auto-link when more than one contact shares the email', async () => {
    const contacts = thenableList([{ id: 1 }, { id: 2 }])
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 9 }, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return contacts
      if (table === 'chat_escalations') return { insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    await createChatEscalation({
      sessionId: 'session01',
      source: 'voice',
      visitorEmail: 'dup@example.com',
      transcript: 'help',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      contact_submission_id: null,
    }))
  })

  it('returns null when the insert fails', async () => {
    const contacts = thenableList([])
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return contacts
      if (table === 'chat_escalations') return { insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    await expect(createChatEscalation({
      sessionId: 'session01',
      source: 'text',
      transcript: 'help',
    })).resolves.toBeNull()
  })
})
