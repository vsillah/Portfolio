import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TestErrorContext, TestPersona } from './types'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

import { RemediationEngine } from './remediation'

const persona: TestPersona = {
  id: 'persona-1',
  name: 'Anna',
  company: 'Berin Studio',
  email: 'test-anna@example.com',
  role: 'decision_maker',
  urgency: 'medium',
  budget: '$5K-$15K',
  techSavvy: 6,
  decisionTimeline: '30_days',
  painPoints: ['manual follow-up'],
  interestAreas: ['ai_automation'],
  communicationStyle: 'brief',
  objectionProbability: 0.2,
  commonObjections: ['Will this add more work?'],
}

function errorContext(overrides: Partial<TestErrorContext> = {}): TestErrorContext {
  return {
    errorId: 'err-1',
    testRunId: 'run-1',
    clientSessionId: 'session-1',
    timestamp: new Date('2026-05-08T00:00:00Z').toISOString(),
    errorType: 'api_error',
    errorMessage: 'API returned 500',
    scenario: 'Chat inquiry',
    stepIndex: 1,
    stepType: 'chat',
    persona,
    likelySourceFiles: ['app/api/chat/route.ts'],
    relevantCodeSnippets: [
      {
        file: 'app/api/chat/route.ts',
        startLine: 1,
        endLine: 3,
        content: 'export async function POST() { return Response.json({ ok: false }) }',
      },
    ],
    ...overrides,
  }
}

describe('RemediationEngine provider retries', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllGlobals()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      OPENAI_API_KEY: 'test-openai-key',
      LLM_RETRY_DELAY_MS: '0',
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('retries transient OpenAI failures while enhancing test error analysis', async () => {
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
                  rootCause: 'The chat route returned an unhandled server error.',
                  suggestedApproach: 'Add a guarded response path and cover it with an API test.',
                  additionalFiles: ['lib/chat/service.ts'],
                }),
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const engine = new RemediationEngine()
    const analysis = await engine.analyzeErrors([errorContext()])

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(analysis.rootCause).toBe('The chat route returned an unhandled server error.')
    expect(analysis.suggestedApproach).toBe('Add a guarded response path and cover it with an API test.')
    expect(analysis.affectedFiles).toContain('lib/chat/service.ts')
  })

  it('retries transient OpenAI failures while generating a proposed test fix', async () => {
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
                  fixedContent: 'export async function POST() { return Response.json({ ok: true }) }',
                  explanation: 'Return a successful response for the tested path.',
                }),
              },
            },
          ],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const engine = new RemediationEngine()
    const fixes = await engine.generateFixes(
      [errorContext()],
      {
        rootCause: 'The chat route returned an unhandled server error.',
        suggestedApproach: 'Guard the response path.',
        affectedFiles: ['app/api/chat/route.ts'],
        confidence: 0.8,
        estimatedComplexity: 'simple',
      },
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(fixes).toHaveLength(1)
    expect(fixes[0]).toMatchObject({
      file: 'app/api/chat/route.ts',
      fixedContent: 'export async function POST() { return Response.json({ ok: true }) }',
      explanation: 'Return a successful response for the tested path.',
    })
  })
})
