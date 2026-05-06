import subscriptionStatus from '@/docs/subscription-status.json'

export type SubscriptionStatusKey =
  | 'keep'
  | 'watch'
  | 'unresolved'
  | 'resolved_canceled'

export type SubscriptionStatusColor = 'green' | 'yellow' | 'red'

export interface SubscriptionStatusLink {
  label: string
  href: string
}

export interface SubscriptionVendorStatus {
  name: string
  status: SubscriptionStatusKey
  statusColor: SubscriptionStatusColor
  billingSignal: string
  usageSignal: string
  portfolioDependency: string
  recommendation: string
  nextAction: string
  decisionRequired: boolean
  links: SubscriptionStatusLink[]
}

export interface SubscriptionBudgetLineItem {
  vendor: string
  amountUsd: number
  billingCadence: 'monthly' | 'usage_based' | 'annual' | 'unknown'
  status: SubscriptionStatusKey | 'unknown'
  evidence: string
  budgetAction: string
}

export interface SubscriptionBudgetSummary {
  monthlyTargetUsd: number
  confirmedMonthlyRunRateUsd: number
  overTargetUsd: number
  confidence: 'partial_receipt_verified' | 'tracker_only' | 'dashboard_verified'
  lastReceiptRefresh: string
  queryExamples: string[]
  notes: string[]
  lineItems: SubscriptionBudgetLineItem[]
  watchItems: string[]
}

export interface SubscriptionStatusRegistry {
  generatedAt: string
  sourceDocument: string
  weeklyReportAutomationId: string
  dailyMonitorAutomationId: string
  approvalPhrasePattern: string
  budget?: SubscriptionBudgetSummary
  summary: {
    status: SubscriptionStatusColor
    headline: string
    nextReviewFocus: string[]
  }
  buckets: {
    keep: string[]
    watch: string[]
    unresolved: string[]
    resolvedCanceled: string[]
    needsDecision: string[]
  }
  vendors: SubscriptionVendorStatus[]
}

export interface SubscriptionQueryResult {
  query: string
  answer: string
  monthlyTargetUsd: number | null
  confirmedMonthlyRunRateUsd: number | null
  overTargetUsd: number | null
  matchingLineItems: SubscriptionBudgetLineItem[]
  suggestedCuts: SubscriptionBudgetLineItem[]
  unresolvedChecks: string[]
}

export function getSubscriptionStatusRegistry(): SubscriptionStatusRegistry {
  return subscriptionStatus as SubscriptionStatusRegistry
}

export function answerSubscriptionBudgetQuery(query: string): SubscriptionQueryResult {
  const registry = getSubscriptionStatusRegistry()
  const budget = registry.budget
  const normalized = query.toLowerCase()
  const lineItems = budget?.lineItems ?? []

  const matchingLineItems = lineItems.filter((item) => {
    const haystack = `${item.vendor} ${item.status} ${item.evidence} ${item.budgetAction}`.toLowerCase()
    return normalized
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .some((token) => haystack.includes(token))
  })

  const suggestedCuts = [...lineItems]
    .filter((item) => item.status === 'watch' || /cut|pause|replace|review|watch/i.test(item.budgetAction))
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .slice(0, 6)

  const unresolvedChecks = registry.vendors
    .filter((vendor) => vendor.status === 'unresolved' || vendor.decisionRequired)
    .map((vendor) => `${vendor.name}: ${vendor.nextAction}`)

  const target = budget?.monthlyTargetUsd ?? null
  const runRate = budget?.confirmedMonthlyRunRateUsd ?? null
  const overTarget = budget?.overTargetUsd ?? null

  let answer = registry.summary.headline
  if (budget && (normalized.includes('spend') || normalized.includes('budget') || normalized.includes('300') || normalized.includes('monthly') || normalized.includes('cost'))) {
    const direction = budget.overTargetUsd > 0
      ? `over the $${budget.monthlyTargetUsd.toFixed(0)} target by $${budget.overTargetUsd.toFixed(2)}`
      : `under the $${budget.monthlyTargetUsd.toFixed(0)} target`
    answer = `Confirmed monthly run-rate is $${budget.confirmedMonthlyRunRateUsd.toFixed(2)}, ${direction}.`
  }
  if (budget && (normalized.includes('cut') || normalized.includes('cancel') || normalized.includes('under'))) {
    const topCuts = suggestedCuts.slice(0, 3).map((item) => `${item.vendor} ($${item.amountUsd.toFixed(2)})`).join(', ')
    answer = `${answer} Biggest budget levers: ${topCuts}. Cancellation still requires the approval phrase: ${registry.approvalPhrasePattern}.`
  }
  if (budget && (normalized.includes('apify') || normalized.includes('gamma'))) {
    const watched = budget.lineItems
      .filter((item) => ['apify', 'gamma'].includes(item.vendor.toLowerCase()))
      .map((item) => `${item.vendor}: $${item.amountUsd.toFixed(2)}; ${item.budgetAction}`)
      .join(' ')
    answer = watched || answer
  }

  return {
    query,
    answer,
    monthlyTargetUsd: target,
    confirmedMonthlyRunRateUsd: runRate,
    overTargetUsd: overTarget,
    matchingLineItems: matchingLineItems.length > 0 ? matchingLineItems : lineItems,
    suggestedCuts,
    unresolvedChecks,
  }
}
