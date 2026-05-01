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

export interface SubscriptionStatusRegistry {
  generatedAt: string
  sourceDocument: string
  weeklyReportAutomationId: string
  dailyMonitorAutomationId: string
  approvalPhrasePattern: string
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

export function getSubscriptionStatusRegistry(): SubscriptionStatusRegistry {
  return subscriptionStatus as SubscriptionStatusRegistry
}
