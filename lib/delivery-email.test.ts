import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))
vi.mock('@/lib/system-prompts', () => ({
  getSystemPrompt: vi.fn(),
}))
vi.mock('@/lib/cost-calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cost-calculator')>()
  return {
    ...actual,
    recordOpenAICost: vi.fn(),
  }
})
vi.mock('@/lib/notifications', () => ({
  sendEmailWithOutcome: vi.fn(),
}))
vi.mock('@/lib/agent-run', () => ({
  recordAgentEvent: vi.fn(),
  recordAgentStep: vi.fn(),
}))

import {
  DELIVERY_EMAIL_USER_PROMPT,
  evaluateDeliveryEmailBudget,
  suggestEmailTemplate,
  type ContactPageData,
} from './delivery-email'

function makeContactData(overrides: Partial<ContactPageData> = {}): ContactPageData {
  return {
    gammaReports: [],
    videos: [],
    valueReports: [],
    deliveries: [],
    salesSessions: [],
    audits: [],
    ...overrides,
  }
}

describe('suggestEmailTemplate', () => {
  it('returns proposal delivery when sales session exists', () => {
    const result = suggestEmailTemplate(
      makeContactData({
        salesSessions: [{ id: 'session-1' }],
      })
    )

    expect(result).toBe('email_proposal_delivery')
  })

  it('returns follow up when deliveries exist but no sales sessions', () => {
    const result = suggestEmailTemplate(
      makeContactData({
        deliveries: [{ id: 'delivery-1' }],
      })
    )

    expect(result).toBe('email_follow_up')
  })

  it('returns asset delivery when generated assets exist without delivery history', () => {
    const result = suggestEmailTemplate(
      makeContactData({
        gammaReports: [{ id: 'gamma-1' }],
      })
    )

    expect(result).toBe('email_asset_delivery')
  })

  it('returns cold outreach when no prior engagement exists', () => {
    const result = suggestEmailTemplate(makeContactData())

    expect(result).toBe('email_cold_outreach')
  })
})

describe('evaluateDeliveryEmailBudget', () => {
  it('allows normal delivery email prompts within the manual admin budget', () => {
    const decision = evaluateDeliveryEmailBudget({
      model: 'gpt-4o-mini',
      systemPrompt: 'Brief context for a single delivery email draft.',
      userPrompt: DELIVERY_EMAIL_USER_PROMPT,
      maxTokens: 800,
    })

    expect(decision.status).toBe('allowed')
    expect(decision.rule.key).toBe('llm_manual_per_call')
    expect(decision.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('blocks oversized delivery email prompts before dispatch', () => {
    const decision = evaluateDeliveryEmailBudget({
      model: 'gpt-4o',
      systemPrompt: 'x'.repeat(2_000_000),
      userPrompt: DELIVERY_EMAIL_USER_PROMPT,
      maxTokens: 100_000,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.reason).toContain('Manual admin LLM call cap')
  })
})
