import { describe, expect, it } from 'vitest'
import { answerSubscriptionBudgetQuery, getSubscriptionStatusRegistry } from './subscription-status'

describe('subscription status budget queries', () => {
  it('exposes a receipt-backed monthly budget snapshot', () => {
    const registry = getSubscriptionStatusRegistry()

    expect(registry.budget?.monthlyTargetUsd).toBe(300)
    expect(registry.budget?.confirmedMonthlyRunRateUsd).toBeGreaterThan(300)
    expect(registry.budget?.expectedNextCycleRunRateUsd).toBeLessThan(registry.budget?.confirmedMonthlyRunRateUsd ?? 0)
    expect(registry.budget?.lineItems.map((item) => item.vendor)).toEqual(
      expect.arrayContaining(['Gamma', 'Apify', 'OpenAI / ChatGPT Pro'])
    )
  })

  it('answers under-budget queries with spend and cut candidates', () => {
    const result = answerSubscriptionBudgetQuery('Are we under $300 and what can we cut?')

    expect(result.answer).toContain('$791.02')
    expect(result.answer).toContain('over the $300 target')
    expect(result.suggestedCuts[0]?.vendor).toBe('BuiltWith')
    expect(result.unresolvedChecks.length).toBeGreaterThan(0)
  })

  it('keeps Gamma and Apify visible as budget watch items', () => {
    const result = answerSubscriptionBudgetQuery('Should we keep an eye on Gamma and Apify, and analyze Apify calls?')

    expect(result.answer).toContain('Gamma')
    expect(result.answer).toContain('Apify')
    expect(result.apifyCallAnalysis?.configuredActorSurfaces).toBeGreaterThan(0)
  })

  it('handles transition spend from the Anthropic to ChatGPT switch', () => {
    const result = answerSubscriptionBudgetQuery('Will spend go down next month after switching from Anthropic to ChatGPT?')

    expect(result.answer).toContain('transition activity')
    expect(result.answer).toContain('Anthropic')
    expect(result.expectedNextCycleRunRateUsd).toBe(684.77)
    expect(result.transitionAdjustments[0]?.amountUsd).toBeLessThan(0)
  })
})
