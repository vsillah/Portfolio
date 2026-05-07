import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getVideoPromptFormatterPrompt: vi.fn(),
  recordOpenAICost: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/system-prompts', () => ({
  getVideoPromptFormatterPrompt: mocks.getVideoPromptFormatterPrompt,
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

import {
  POST,
} from './route'
import {
  buildVideoPromptFormatterUserMessage,
  evaluateVideoPromptFormatterBudget,
} from '@/lib/video-prompt-format'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/format-prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/video-generation/format-prompt', () => {
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
    mocks.getVideoPromptFormatterPrompt.mockResolvedValue({
      id: 'prompt-1',
      key: 'video_prompt_formatter',
      name: 'Video prompt formatter',
      prompt: 'Format video notes into a content brief.',
      config: { model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 800 },
      version: 1,
    })
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
    mocks.recordOpenAICost.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('requires admin auth before starting a trace', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ rawText: 'Make a short video.' }))

    expect(response.status).toBe(401)
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('formats the prompt, records budget metadata, links cost, and returns agentRunId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        choices: [
          {
            message: {
              content: 'TOPIC: Practical automation\nTARGET AUDIENCE: Small business owners',
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      rawText: 'I want a video about making automation practical.',
      audience: 'small business owners',
      tone: 'plainspoken',
      angle: 'automation that reduces burden',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      formattedPrompt: 'TOPIC: Practical automation\nTARGET AUDIENCE: Small business owners',
      agentRunId: 'agent-run-1',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'manual-admin',
        runtime: 'manual',
        kind: 'video_prompt_format',
        triggerSource: 'admin:video_prompt_format',
        triggeredByUserId: 'admin-user-1',
      }),
    )
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        stepKey: 'budget_check',
        metadata: expect.objectContaining({
          operation: 'video_prompt_format',
          budget_status: 'allowed',
        }),
      }),
    )
    expect(mocks.recordOpenAICost).toHaveBeenCalledWith(
      expect.any(Object),
      'gpt-4o-mini',
      { type: 'video_prompt_format', id: 'agent-run-1' },
      expect.objectContaining({
        operation: 'video_prompt_format',
        budget_status: 'allowed',
      }),
      'agent-run-1',
    )
    expect(mocks.endAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'agent-run-1',
        status: 'completed',
      }),
    )
  })

  it('marks the trace failed and returns a safe message when budget blocks formatting', async () => {
    mocks.getVideoPromptFormatterPrompt.mockResolvedValue({
      id: 'prompt-1',
      key: 'video_prompt_formatter',
      name: 'Video prompt formatter',
      prompt: 'Format video notes into a content brief.',
      config: { model: 'gpt-4o', temperature: 0.4, maxTokens: 100_000 },
      version: 1,
    })
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const response = await POST(makeRequest({
      rawText: 'x'.repeat(2_000_000),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'This video prompt formatting request is over the current Agent Ops budget limit. Shorten the notes or reduce the configured max tokens before retrying.',
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
      { operation: 'video_prompt_format' },
    )
  })

  it('builds detail fields into the formatter user message', () => {
    const message = buildVideoPromptFormatterUserMessage({
      rawText: 'Make this into a video brief.',
      audience: 'operators',
      tone: 'direct',
      angle: 'reduce manual work',
    })

    expect(message).toContain('Make this into a video brief.')
    expect(message).toContain('TARGET AUDIENCE: operators')
    expect(message).toContain('TONE: direct')
    expect(message).toContain('ANGLE / HOOK: reduce manual work')
  })

  it('evaluates normal formatter prompts within the manual budget', () => {
    const decision = evaluateVideoPromptFormatterBudget({
      systemPrompt: 'Format notes.',
      userMessage: 'Short notes.',
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
  })
})
