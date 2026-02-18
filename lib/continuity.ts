// Continuity / Subscription System — Shared types and helpers
// Supports recurring billing via Stripe Subscriptions

// ============================================================================
// Types
// ============================================================================

export type BillingInterval = 'week' | 'month' | 'quarter' | 'year';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';

// ============================================================================
// Database row types
// ============================================================================

export interface ContinuityPlan {
  id: string;
  name: string;
  description: string | null;
  service_id: string | null;
  billing_interval: BillingInterval;
  billing_interval_count: number;
  amount_per_interval: number;
  currency: string;
  min_commitment_cycles: number;
  max_cycles: number | null;
  trial_days: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  features: string[];
  cancellation_policy: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientSubscription {
  id: string;
  continuity_plan_id: string;
  user_id: string | null;
  client_email: string;
  client_name: string | null;
  order_id: number | null;
  guarantee_instance_id: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cycles_completed: number;
  credit_remaining: number;
  credit_total: number;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Input types
// ============================================================================

export interface CreateContinuityPlanInput {
  name: string;
  description?: string;
  service_id?: string;
  billing_interval: BillingInterval;
  billing_interval_count?: number;
  amount_per_interval: number;
  currency?: string;
  min_commitment_cycles?: number;
  max_cycles?: number;
  trial_days?: number;
  features?: string[];
  cancellation_policy?: string;
}

export interface UpdateContinuityPlanInput extends Partial<CreateContinuityPlanInput> {
  is_active?: boolean;
}

export interface CreateSubscriptionInput {
  continuity_plan_id: string;
  client_email: string;
  client_name?: string;
  user_id?: string;
  order_id?: number;
  guarantee_instance_id?: string;
  credit_amount?: number;  // For guarantee rollover credit
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert our billing_interval to Stripe's recurring interval.
 */
export function toStripeInterval(interval: BillingInterval): 'week' | 'month' | 'year' {
  switch (interval) {
    case 'week':
      return 'week';
    case 'month':
      return 'month';
    case 'quarter':
      return 'month'; // quarter = 3 months
    case 'year':
      return 'year';
  }
}

/**
 * Get the Stripe interval_count for our billing interval.
 */
export function toStripeIntervalCount(interval: BillingInterval, count: number): number {
  if (interval === 'quarter') {
    return count * 3; // 1 quarter = 3 months
  }
  return count;
}

/**
 * Calculate how many billing cycles a credit amount covers.
 */
export function creditCyclesCovered(creditAmount: number, amountPerInterval: number): number {
  if (amountPerInterval <= 0) return 0;
  return Math.floor(creditAmount / amountPerInterval);
}

/**
 * Format the billing interval for display.
 */
export function formatBillingInterval(interval: BillingInterval, count: number): string {
  if (count === 1) {
    switch (interval) {
      case 'week': return 'Weekly';
      case 'month': return 'Monthly';
      case 'quarter': return 'Quarterly';
      case 'year': return 'Annually';
    }
  }
  const unitLabels: Record<BillingInterval, string> = {
    week: 'weeks',
    month: 'months',
    quarter: 'quarters',
    year: 'years',
  };
  return `Every ${count} ${unitLabels[interval]}`;
}

/**
 * Format a currency amount.
 */
export function formatCurrency(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Labels / display helpers
// ============================================================================

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  week: 'Weekly',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Annually',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Free Trial',
  active: 'Active',
  past_due: 'Past Due',
  paused: 'Paused',
  canceled: 'Canceled',
  expired: 'Expired',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<SubscriptionStatus, string> = {
  trialing: 'bg-cyan-900/50 text-cyan-300 border-cyan-500',
  active: 'bg-green-900/50 text-green-300 border-green-500',
  past_due: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
  paused: 'bg-gray-700/50 text-gray-300 border-gray-500',
  canceled: 'bg-red-900/50 text-red-300 border-red-500',
  expired: 'bg-gray-700/50 text-gray-300 border-gray-500',
};
