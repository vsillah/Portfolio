import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockSupabaseAdmin,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockRecordOpenAICost,
  mockRecordAgentStep,
  mockRecordAgentEvent,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  const mockSupabaseAdmin = { from: mockFrom }
  const mockRecordOpenAICost = vi.fn(() => Promise.resolve())
  const mockRecordAgentStep = vi.fn(() => Promise.resolve({ id: 'step-1' }))
  const mockRecordAgentEvent = vi.fn(() => Promise.resolve({ id: 'event-1' }))

  return {
    mockSupabaseAdmin,
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockRecordOpenAICost,
    mockRecordAgentStep,
    mockRecordAgentEvent,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mockRecordOpenAICost,
  }
})

vi.mock('@/lib/agent-run', () => ({
  recordAgentStep: mockRecordAgentStep,
  recordAgentEvent: mockRecordAgentEvent,
}))

import {
  buildLeadExtractionUserPrompt,
  evaluateLeadFromMeetingBudget,
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
    mockRecordAgentStep.mockClear()
    mockRecordAgentEvent.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
    process.env.LLM_RETRY_DELAY_MS = '0'
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('allows normal meeting lead extraction prompts within the manual admin budget', () => {
    const decision = evaluateLeadFromMeetingBudget({
      systemPrompt: 'Extract contact details.',
      userPrompt: buildLeadExtractionUserPrompt('Short meeting transcript.'),
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('blocks oversized meeting lead extraction prompts before dispatch', () => {
    const decision = evaluateLeadFromMeetingBudget({
      systemPrompt: 'Extract contact details.',
      userPrompt: buildLeadExtractionUserPrompt('x'.repeat(2_000_000)),
      model: 'gpt-4o',
      maxTokens: 100_000,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.reason).toContain('Manual admin LLM call cap')
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

  it('retries transient OpenAI responses before mapping extracted lead fields', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'temporary outage',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: 'Retry Lead',
                  company: 'Recovered Co',
                }),
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const extracted = await extractLeadFieldsFromTranscript(
      'Transcript says this lead should recover after a transient provider outage.'
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(extracted.name).toBe('Retry Lead')
    expect(extracted.company).toBe('Recovered Co')
  })

  it('records budget trace metadata and links cost when agentRunId is supplied', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Morgan Lead',
                company: 'Example Co',
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const extracted = await extractLeadFieldsFromTranscript(
      'Morgan says the sales team needs cleaner follow-up.',
      { agentRunId: 'agent-run-1', meetingRecordId: 'meeting-99' },
    )

    expect(extracted.name).toBe('Morgan Lead')
    expect(mockRecordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          meeting_record_id: 'meeting-99',
          budget_status: 'allowed',
        }),
      }),
    )
    expect(mockRecordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'lead_extraction', id: 'meeting-99' },
      expect.objectContaining({
        operation: 'lead_from_meeting',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
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
