import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/llm-dispatch', () => ({
  generateJsonCompletion: vi.fn(),
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))

import {
  buildChiefOfStaffPrompt,
  normalizeChiefOfStaffHistory,
  parseChiefOfStaffJson,
  type ChiefOfStaffContext,
} from './chief-of-staff-chat'

const context: ChiefOfStaffContext = {
  generatedAt: '2026-05-02T12:00:00.000Z',
  activeRuns: [
    {
      id: 'run-1',
      agent_key: 'chief-of-staff',
      runtime: 'n8n',
      title: 'Morning review',
      status: 'running',
      current_step: 'Checking stale runs',
      error_message: null,
      started_at: '2026-05-02T11:55:00.000Z',
    },
  ],
  recentFailures: [],
  pendingApprovals: [],
  costEvents24h: {
    count: 2,
    totalUsd: 0.0123,
    providers: ['openai'],
    models: ['gpt-4o-mini'],
  },
}

describe('Chief of Staff chat helpers', () => {
  it('normalizes chat history to the last valid messages', () => {
    const history = normalizeChiefOfStaffHistory([
      { role: 'user', content: '  first  ' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ])

    expect(history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ])
  })

  it('parses the model JSON contract', () => {
    const result = parseChiefOfStaffJson(JSON.stringify({
      reply: 'Focus on the pending deployment and the approval queue.',
      suggested_actions: ['Check failed runs', 'Run morning review'],
    }))

    expect(result.reply).toContain('pending deployment')
    expect(result.suggestedActions).toEqual(['Check failed runs', 'Run morning review'])
  })

  it('builds a read-only operational prompt', () => {
    const prompt = buildChiefOfStaffPrompt(context, [{ role: 'user', content: 'What needs attention?' }])

    expect(prompt.systemPrompt).toContain('production mutations')
    expect(prompt.systemPrompt).toContain('Return JSON only')
    expect(prompt.userPrompt).toContain('Morning review')
    expect(prompt.userPrompt).toContain('What needs attention?')
  })
})
