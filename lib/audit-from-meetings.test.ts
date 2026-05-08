import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordOpenAICost: vi.fn(() => Promise.resolve()),
  recordAgentStep: vi.fn(() => Promise.resolve({ id: 'step-1' })),
  recordAgentEvent: vi.fn(() => Promise.resolve({ id: 'event-1' })),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mocks.recordOpenAICost,
  }
})

vi.mock('@/lib/agent-run', () => ({
  recordAgentStep: mocks.recordAgentStep,
  recordAgentEvent: mocks.recordAgentEvent,
}))

import {
  buildAuditFromMeetingsUserPrompt,
  evaluateAuditFromMeetingsBudget,
  extractDiagnosticFromMeetingText,
} from './audit-from-meetings'

describe('audit-from-meetings budget policy', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
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

  it('allows normal audit-from-meetings prompts within the manual admin budget', () => {
    const decision = evaluateAuditFromMeetingsBudget({
      systemPrompt: 'Extract diagnostic fields.',
      userPrompt: buildAuditFromMeetingsUserPrompt('Short meeting transcript.'),
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('blocks oversized audit-from-meetings prompts before dispatch', () => {
    const decision = evaluateAuditFromMeetingsBudget({
      systemPrompt: 'Extract diagnostic fields.',
      userPrompt: buildAuditFromMeetingsUserPrompt('x'.repeat(2_000_000)),
      model: 'gpt-4o',
      maxTokens: 100_000,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.reason).toContain('Manual admin LLM call cap')
  })

  it('records budget trace metadata and links cost when agentRunId is supplied', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                business_challenges: { primary_challenges: ['manual_processes'] },
                tech_stack: { crm: 'hubspot' },
                automation_needs: { priority_areas: ['lead_follow_up'] },
                ai_readiness: { data_quality: 'some_systems' },
                budget_timeline: { timeline: 'quarter' },
                decision_making: { decision_maker: true },
                diagnostic_summary: 'They need cleaner follow-up.',
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const extracted = await extractDiagnosticFromMeetingText(
      'Meeting transcript says follow-up is inconsistent.',
      {
        agentRunId: 'agent-run-1',
        contactSubmissionId: 42,
      },
    )

    expect(extracted.diagnostic_summary).toBe('They need cleaner follow-up.')
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          contact_submission_id: 42,
          budget_status: 'allowed',
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'contact', id: '42' },
      expect.objectContaining({
        operation: 'audit_from_meetings',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
  })

  it('retries transient OpenAI responses before parsing diagnostic output', async () => {
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
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  business_challenges: { primary_challenges: ['manual_processes'] },
                  tech_stack: {},
                  automation_needs: {},
                  ai_readiness: {},
                  budget_timeline: {},
                  decision_making: {},
                  diagnostic_summary: 'Recovered after retry.',
                }),
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const extracted = await extractDiagnosticFromMeetingText(
      'Meeting transcript says follow-up is inconsistent.'
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(extracted.diagnostic_summary).toBe('Recovered after retry.')
  })
})
