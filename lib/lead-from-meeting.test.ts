import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockSupabaseAdmin,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockRecordOpenAICost,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  const mockSupabaseAdmin = { from: mockFrom }
  const mockRecordOpenAICost = vi.fn(() => Promise.resolve())

  return {
    mockSupabaseAdmin,
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockRecordOpenAICost,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))

vi.mock('@/lib/cost-calculator', () => ({
  recordOpenAICost: mockRecordOpenAICost,
}))

import {
  fetchMeetingForExtraction,
  extractLeadFieldsFromTranscript,
  extractLeadFieldsFromMeeting,
} from './lead-from-meeting'

describe('lead-from-meeting', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    mockFrom.mockClear()
    mockSelect.mockClear()
    mockEq.mockClear()
    mockSingle.mockClear()
    mockRecordOpenAICost.mockClear()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('returns null when meeting has no transcript or structured notes', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'm-1',
        meeting_type: 'discovery',
        meeting_date: '2026-03-27',
        transcript: '   ',
        structured_notes: {},
      },
      error: null,
    })

    const result = await fetchMeetingForExtraction('m-1')

    expect(result).toBeNull()
    expect(mockFrom).toHaveBeenCalledWith('meeting_records')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, meeting_type, meeting_date, transcript, structured_notes'
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'm-1')
  })

  it('maps OpenAI JSON to extracted lead fields and records usage cost', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Jane Prospect',
                email: 'jane@example.com',
                company: 'Acme Co',
                quick_wins: 'Automate follow-up reminders.',
                employee_count: 250,
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const extracted = await extractLeadFieldsFromTranscript(
      'Transcript says Jane needs faster follow-up.'
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(extracted.name).toBe('Jane Prospect')
    expect(extracted.email).toBe('jane@example.com')
    expect(extracted.company).toBe('Acme Co')
    expect(extracted.quick_wins).toBe('Automate follow-up reminders.')
    expect(extracted.employee_count).toBeUndefined()
    expect(mockRecordOpenAICost).toHaveBeenCalledTimes(1)
  })

  it('throws a generic extraction error when OpenAI returns non-OK', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'upstream error',
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      extractLeadFieldsFromTranscript('Need details for lead creation')
    ).rejects.toThrow('AI extraction failed')
  })

  it('extractLeadFieldsFromMeeting runs fetch -> combine -> extract flow', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'meeting-42',
        meeting_type: 'review',
        meeting_date: '2026-03-27',
        transcript: 'Sam from Northwind says follow-up is inconsistent.',
        structured_notes: null,
      },
      error: null,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Sam',
                company: 'Northwind',
                pain_points: 'Inconsistent follow-up creates missed opportunities.',
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await extractLeadFieldsFromMeeting('meeting-42')

    expect(result.meeting.id).toBe('meeting-42')
    expect(result.extracted.name).toBe('Sam')
    expect(result.extracted.company).toBe('Northwind')
    expect(result.extracted.pain_points).toContain('Inconsistent follow-up')
  })
})
