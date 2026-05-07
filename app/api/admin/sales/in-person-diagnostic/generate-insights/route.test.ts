import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  recordOpenAICost: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: mocks.recordOpenAICost,
  }
})

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  recordAgentEvent: mocks.recordAgentEvent,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'
import { evaluateInPersonDiagnosticInsightsBudget } from '@/lib/in-person-diagnostic-insights'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/in-person-diagnostic/generate-insights', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    audit_id: 'audit-1',
    client_name: 'Anna Berin',
    client_company: 'Berin Studio',
    diagnostic_data: {
      business_challenges: { bottleneck: 'manual follow-up' },
      tech_stack: { crm: 'spreadsheet' },
      automation_needs: { priority: 'lead routing' },
    },
    ...overrides,
  }
}

describe('POST /api/admin/sales/in-person-diagnostic/generate-insights', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' }

    mocks.verifyAdmin.mockResolvedValue({
      user: { id: 'admin-user-1' },
      isAdmin: true,
    })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.recordOpenAICost.mockResolvedValue(undefined)
    mocks.eq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'diagnostic_audits') {
        return {
          update: mocks.update,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('requires admin auth before starting a trace', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('generates insights, records budget metadata, links cost, and returns agentRunId', async () => {
    const aiPayload = {
      diagnostic_summary: 'Manual follow-up is slowing lead conversion.',
      key_insights: ['Follow-up is not assigned consistently.', 'A CRM source of truth is missing.'],
      recommended_actions: ['Create lead routing rules.', 'Add an owner field to every lead.'],
      urgency_score: 7,
      opportunity_score: 8,
      sales_notes: 'Strong fit for a lightweight automation sprint.',
    }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 250, completion_tokens: 500, total_tokens: 750 },
        choices: [{ message: { content: JSON.stringify(aiPayload) } }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      summary: aiPayload.diagnostic_summary,
      insights: aiPayload.key_insights,
      actions: aiPayload.recommended_actions,
      urgency_score: 7,
      opportunity_score: 8,
      sales_notes: aiPayload.sales_notes,
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'in_person_diagnostic_insights',
        triggerSource: 'admin:in_person_diagnostic_generate_insights',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'in_person_diagnostic_insights',
          audit_id: 'audit-1',
          budget_status: 'allowed',
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'diagnostic_audit', id: 'audit-1' },
      expect.objectContaining({
        operation: 'in_person_diagnostic_insights',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
        outcome: expect.objectContaining({
          audit_id: 'audit-1',
          insight_count: 2,
          action_count: 2,
        }),
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks generation', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest(validBody({
      diagnostic_data: {
        business_challenges: { notes: 'x'.repeat(8_000_000) },
      },
    })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This in-person diagnostic insight request is over the current Agent Ops budget limit. Shorten the diagnostic notes before retrying.',
      agentRunId: 'agent-run-1',
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        status: 'failed',
      }),
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      expect.stringContaining('Estimated cost'),
      expect.objectContaining({
        operation: 'in_person_diagnostic_insights',
        audit_id: 'audit-1',
      }),
    )
  })

  it('allows normal in-person diagnostic insight prompts under the manual runtime budget', () => {
    const decision = evaluateInPersonDiagnosticInsightsBudget({
      systemPrompt: 'Respond only with JSON.',
      userPrompt: 'Summarize a short diagnostic conversation.',
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.runtime).toBe('manual')
  })
})
