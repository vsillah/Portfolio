export type PricingState = 'fresh' | 'needs_review' | 'stale' | 'quote_required' | 'source_unavailable'
export type Complexity = 'low' | 'medium' | 'high'
export type OwnershipFit = 'local' | 'hybrid' | 'cloud'

export interface TechnologyOptionScoreInput {
  startupCost?: number | null
  monthlyCost?: number | null
  setupComplexity: Complexity
  integrationComplexity: Complexity
  dataOwnershipFit: OwnershipFit
  monitoringSupport: Complexity
  pricingState: PricingState
  stackMatch?: boolean
}

export interface TechnologyOptionScore {
  total: number
  decision: 'recommend' | 'pilot' | 'monitor' | 'avoid'
  reasons: string[]
}

const COMPLEXITY_SCORE: Record<Complexity, number> = { low: 5, medium: 3, high: 1 }
const OWNERSHIP_SCORE: Record<OwnershipFit, number> = { local: 5, hybrid: 4, cloud: 2 }
const FRESHNESS_SCORE: Record<PricingState, number> = {
  fresh: 5,
  needs_review: 3,
  stale: 2,
  quote_required: 2,
  source_unavailable: 1,
}

function costScore(startupCost?: number | null, monthlyCost?: number | null): number {
  const startup = startupCost ?? 0
  const monthly = monthlyCost ?? 0
  if (startup <= 250 && monthly <= 50) return 5
  if (startup <= 1500 && monthly <= 150) return 4
  if (startup <= 3000 && monthly <= 350) return 3
  if (startup <= 6000 && monthly <= 750) return 2
  return 1
}

export function evaluateTechnologyOption(input: TechnologyOptionScoreInput): TechnologyOptionScore {
  const weighted =
    costScore(input.startupCost, input.monthlyCost) * 0.2 +
    COMPLEXITY_SCORE[input.setupComplexity] * 0.15 +
    COMPLEXITY_SCORE[input.integrationComplexity] * 0.15 +
    OWNERSHIP_SCORE[input.dataOwnershipFit] * 0.2 +
    COMPLEXITY_SCORE[input.monitoringSupport] * 0.15 +
    FRESHNESS_SCORE[input.pricingState] * 0.1 +
    (input.stackMatch ? 5 : 3) * 0.05

  const total = Number(weighted.toFixed(2))
  const reasons: string[] = []
  if (input.dataOwnershipFit === 'local') reasons.push('Strong client-owned data fit')
  if (input.setupComplexity === 'low') reasons.push('Fast setup path')
  if (input.pricingState !== 'fresh') reasons.push('Pricing needs confirmation before proposal')
  if (input.integrationComplexity === 'high') reasons.push('Integration complexity may slow rollout')

  return {
    total,
    decision: total >= 4.2 ? 'recommend' : total >= 3.5 ? 'pilot' : total >= 2.8 ? 'monitor' : 'avoid',
    reasons,
  }
}

export function pricingFreshnessState(lastCheckedAt: string | null | undefined, maxAgeDays: number, quoteRequired = false): PricingState {
  if (quoteRequired) return 'quote_required'
  if (!lastCheckedAt) return 'needs_review'
  const checked = new Date(lastCheckedAt).getTime()
  if (Number.isNaN(checked)) return 'source_unavailable'
  const ageDays = (Date.now() - checked) / (24 * 60 * 60 * 1000)
  return ageDays > maxAgeDays ? 'stale' : 'fresh'
}
