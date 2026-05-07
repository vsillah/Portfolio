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
  refreshCategoryStats: vi.fn(),
  linkEvidenceToCalculations: vi.fn(),
  from: vi.fn(),
  categoriesSelect: vi.fn(),
  categoriesEq: vi.fn(),
  evidenceInsert: vi.fn(),
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

vi.mock('@/lib/value-evidence-linker', () => ({
  refreshCategoryStats: mocks.refreshCategoryStats,
  linkEvidenceToCalculations: mocks.linkEvidenceToCalculations,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/meetings/classify-pain-points', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/meetings/classify-pain-points', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
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
    mocks.refreshCategoryStats.mockResolvedValue(undefined)
    mocks.linkEvidenceToCalculations.mockResolvedValue(undefined)
    mocks.categoriesEq.mockResolvedValue({
      data: [
        {
          id: 'cat-manual',
          name: 'manual_processes',
          display_name: 'Manual Processes',
          description: 'Manual repetitive work',
        },
      ],
      error: null,
    })
    mocks.categoriesSelect.mockReturnValue({ eq: mocks.categoriesEq })
    mocks.evidenceInsert.mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'pain_point_categories') {
        return { select: mocks.categoriesSelect }
      }
      if (table === 'pain_point_evidence') {
        return { insert: mocks.evidenceInsert }
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

    const response = await POST(makeRequest({ pain_points: 'Manual follow-up is inconsistent.' }))

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('classifies unmatched notes with AI, links cost, and returns agentRunId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 250, completion_tokens: 100, total_tokens: 350 },
        choices: [
          {
            message: {
              content: JSON.stringify([
                { index: 1, category_name: 'manual_processes', confidence: 0.71 },
              ]),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      pain_points: '- Team morale needs improvement and clearer handoffs',
      quick_wins: '',
      contact_submission_id: 42,
      insert_evidence: true,
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.agentRunId).toBe('agent-run-1')
    expect(body.classified).toHaveLength(1)
    expect(body.classified[0]).toMatchObject({
      categoryId: 'cat-manual',
      categoryName: 'manual_processes',
      method: 'ai',
    })
    expect(body.evidence).toMatchObject({ inserted: 1, errors: [] })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'meeting_pain_classification',
        triggerSource: 'admin:meetings_classify_pain_points',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'meeting_pain_classification',
          budget_status: 'allowed',
          unmatched_count: 1,
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'meeting_pain_classification', id: 'agent-run-1' },
      expect.objectContaining({
        operation: 'meeting_pain_classification',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
        outcome: expect.objectContaining({
          classified_count: 1,
          inserted_evidence_count: 1,
        }),
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks AI classification', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      pain_points: `- ${'x'.repeat(8_000_000)}`,
      quick_wins: '',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This meeting pain classification request is over the current Agent Ops budget limit. Shorten the meeting notes before retrying.',
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
        operation: 'meeting_pain_classification',
      }),
    )
  })
})
