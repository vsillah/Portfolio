import { describe, expect, it } from 'vitest'
import {
  assertAgentBudgetAllowed,
  evaluateAgentBudget,
  estimateAgentLlmCost,
  getAgentBudgetRule,
} from './agent-budget-policy'

describe('agent budget policy', () => {
  it('allows a low-cost manual admin LLM estimate', () => {
    const decision = evaluateAgentBudget({
      runtime: 'manual',
      model: 'gpt-4o-mini',
      estimatedInputTokens: 1_000,
      estimatedOutputTokens: 1_000,
    })

    expect(decision.status).toBe('allowed')
    expect(decision.estimatedCostUsd).toBeCloseTo(0.00075, 6)
    expect(decision.rule.key).toBe('llm_manual_per_call')
  })

  it('warns when the estimate crosses the runtime warning threshold', () => {
    const decision = evaluateAgentBudget({
      runtime: 'hermes',
      model: 'claude-3-5-haiku-20241022',
      estimatedInputTokens: 10_000,
      estimatedOutputTokens: 10_000,
    })

    expect(decision.status).toBe('warning')
    expect(decision.estimatedCostUsd).toBeCloseTo(0.048, 6)
    expect(decision.warningUsd).toBe(0.02)
    expect(decision.limitUsd).toBe(0.1)
  })

  it('blocks a high-cost Codex estimate before dispatch', () => {
    const decision = evaluateAgentBudget({
      runtime: 'codex',
      model: 'gpt-4o',
      estimatedInputTokens: 100_000,
      estimatedOutputTokens: 100_000,
    })

    expect(decision.status).toBe('blocked')
    expect(decision.estimatedCostUsd).toBeCloseTo(1.25, 6)
    expect(() => assertAgentBudgetAllowed({
      runtime: 'codex',
      model: 'gpt-4o',
      estimatedInputTokens: 100_000,
      estimatedOutputTokens: 100_000,
    })).toThrow(/exceeds Codex LLM call cap/)
  })

  it('uses provider fallbacks for unknown model ids', () => {
    expect(estimateAgentLlmCost({
      runtime: 'n8n',
      model: 'gpt-future-model',
      estimatedInputTokens: 1_000,
      estimatedOutputTokens: 1_000,
    })).toBeCloseTo(0.0125, 6)

    expect(estimateAgentLlmCost({
      runtime: 'n8n',
      model: 'claude-future-model',
      estimatedInputTokens: 1_000,
      estimatedOutputTokens: 1_000,
    })).toBeCloseTo(0.018, 6)
  })

  it('falls back to the default rule when no runtime-specific rule exists', () => {
    const rule = getAgentBudgetRule('n8n', [
      {
        key: 'fallback',
        label: 'Fallback',
        runtime: 'any',
        scope: 'per_call',
        warningUsd: 0.01,
        limitUsd: 0.02,
        notes: 'test fallback',
      },
    ])

    expect(rule.key).toBe('fallback')
  })
})
