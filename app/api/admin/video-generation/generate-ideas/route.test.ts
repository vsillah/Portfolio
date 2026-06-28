import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  fetchVideoIdeasContext: vi.fn(),
  serializeContextForPrompt: vi.fn(),
  fetchVideoContextByEmail: vi.fn(),
  recordOpenAICost: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/video-ideas-context', () => ({
  fetchVideoIdeasContext: mocks.fetchVideoIdeasContext,
  serializeContextForPrompt: mocks.serializeContextForPrompt,
}))

vi.mock('@/lib/video-context', () => ({
  fetchVideoContextByEmail: mocks.fetchVideoContextByEmail,
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

import { POST } from './route'
import { evaluateVideoIdeasGenerationBudget } from '@/lib/video-ideas-generation'

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/admin/video-generation/generate-ideas', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/generate-ideas', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key', LLM_RETRY_DELAY_MS: '0' }
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
    mocks.fetchVideoContextByEmail.mockResolvedValue({ found: false })
    mocks.fetchVideoIdeasContext.mockResolvedValue({ meetings: [], chatSessions: [], siteContent: [] })
    mocks.serializeContextForPrompt.mockReturnValue('Short context.')
    mocks.from.mockImplementation((table: string) => {
      if (table === 'video_ideas_queue') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [{ id: 'idea-1' }], error: null })),
          })),
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

    const response = await POST(makeRequest({ mode: 'from_direction', customPrompt: 'Make a video.' }))

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('generates ideas, records budget metadata, links cost, and returns agentRunId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 500, completion_tokens: 1000, total_tokens: 1500 },
        choices: [
          {
            message: {
              content: JSON.stringify({
                ideas: [
                  {
                    title: 'Automation That Gives Time Back',
                    script: 'A practical script.',
                    scriptOutline: {
                      pain_point: 'Teams move faster than their approvals.',
                      hook: 'AI can create faster than teams can govern.',
                      open_loop: 'Show the operating loop that closes the gap.',
                      frame: 'Receipts create trust.',
                      proof_demo: 'Portfolio shows the review gate.',
                      teaching_beats: ['Name the pain', 'Show the loop'],
                      cta: 'Join the Accelerated Workshop interest path.',
                      closing_question: 'Where is this showing up in your workflow?',
                      thumbnail_promise: 'AI speed needs a gate.',
                      source_distance_notes: 'Use structure only.',
                    },
                    storyboard: { scenes: [{ sceneNumber: 1, description: 'Open on admin workflow.' }] },
                  },
                ],
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      mode: 'from_direction',
      customPrompt: 'Turn this note into one practical video.',
      limit: 1,
      scriptTemplateId: 'killer_script',
      scriptIntent: 'Make the pain point and CTA explicit.',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ideas: [
        {
          title: 'Automation That Gives Time Back',
          script: 'A practical script.',
          scriptOutline: {
            pain_point: 'Teams move faster than their approvals.',
            hook: 'AI can create faster than teams can govern.',
            open_loop: 'Show the operating loop that closes the gap.',
            frame: 'Receipts create trust.',
            proof_demo: 'Portfolio shows the review gate.',
            teaching_beats: ['Name the pain', 'Show the loop'],
            cta: 'Join the Accelerated Workshop interest path.',
            closing_question: 'Where is this showing up in your workflow?',
            thumbnail_promise: 'AI speed needs a gate.',
            source_distance_notes: 'Use structure only.',
          },
          storyboard: { scenes: [{ sceneNumber: 1, description: 'Open on admin workflow.' }] },
        },
      ],
      addedToQueue: 1,
      mode: 'from_direction',
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'video_ideas_generation',
        triggerSource: 'admin:video_generate_ideas',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'video_ideas_generation',
          mode: 'from_direction',
          budget_status: 'warning',
        }),
      }),
    )
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        eventType: 'budget_check',
        severity: 'warning',
        metadata: expect.objectContaining({
          operation: 'video_ideas_generation',
          mode: 'from_direction',
          limit: 1,
          budget_status: 'warning',
        }),
        idempotencyKey: 'agent-run-1:video_ideas_generation:budget_check:warning',
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o',
      { type: 'video_ideas_generation', id: 'agent-run-1' },
      expect.objectContaining({
        operation: 'video_ideas_generation',
        mode: 'from_direction',
        budget_status: 'warning',
      }),
      'agent-run-1',
    )
    const openAiBody = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(openAiBody.messages[1].content).toContain('Selected script template: Killer script')
    expect(openAiBody.messages[1].content).toContain('Script intent: Make the pain point and CTA explicit.')
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks generation', async () => {
    mocks.serializeContextForPrompt.mockReturnValue('x'.repeat(1_000_000))
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      mode: 'from_scratch',
      limit: 10,
      includeTranscripts: true,
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This video ideas request is over the current Agent Ops budget limit. Use fewer ideas, shorter notes, or less transcript context before retrying.',
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
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        eventType: 'budget_check',
        severity: 'error',
        metadata: expect.objectContaining({
          operation: 'video_ideas_generation',
          mode: 'from_scratch',
          limit: 10,
          budget_status: 'blocked',
        }),
        idempotencyKey: 'agent-run-1:video_ideas_generation:budget_check:blocked',
      }),
    )
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      expect.stringContaining('Estimated cost'),
      expect.objectContaining({ operation: 'video_ideas_generation', mode: 'from_scratch' }),
    )
  })

  it('retries a transient OpenAI failure before queueing generated ideas', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        text: async () => 'temporarily unavailable',
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ideas: [
                    {
                      title: 'Automation That Gives Time Back',
                      script: 'A practical script.',
                      storyboard: { scenes: [{ sceneNumber: 1, description: 'Open on admin workflow.' }] },
                    },
                  ],
                }),
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      mode: 'from_direction',
      customPrompt: 'Turn this note into one practical video.',
      limit: 1,
    }))

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        addedToQueue: 1,
        mode: 'from_direction',
        agentRunId: 'agent-run-1',
      }),
    )
  })

  it('warns but allows normal video idea prompts under the manual hard cap', () => {
    const decision = evaluateVideoIdeasGenerationBudget({
      systemPrompt: 'Generate ideas.',
      userPrompt: 'Short direction.',
    })

    expect(decision.status).toBe('warning')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
    expect(decision.estimatedCostUsd).toBeLessThan(decision.limitUsd)
  })
})
