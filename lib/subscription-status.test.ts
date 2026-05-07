import { describe, expect, it } from 'vitest'
import { answerSubscriptionBudgetQuery, getSubscriptionStatusRegistry } from './subscription-status'

describe('subscription status budget queries', () => {
  it('exposes a receipt-backed monthly budget snapshot', () => {
    const registry = getSubscriptionStatusRegistry()

    expect(registry.budget?.monthlyTargetUsd).toBe(300)
    expect(registry.budget?.confirmedMonthlyRunRateUsd).toBeGreaterThan(300)
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
    const result = answerSubscriptionBudgetQuery('Should we keep an eye on Gamma and Apify?')

    expect(result.answer).toContain('Gamma')
    expect(result.answer).toContain('Apify')
  })
})
