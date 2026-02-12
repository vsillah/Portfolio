// Guarantee System — Shared types and helpers
// Implements Hormozi conditional guarantee lifecycle

// ============================================================================
// Types
// ============================================================================

export type GuaranteeType = 'conditional' | 'unconditional';

export type GuaranteePayoutType = 'refund' | 'credit' | 'rollover_upsell' | 'rollover_continuity';

export type PayoutAmountType = 'full' | 'partial' | 'fixed';

export type VerificationMethod = 'admin_verified' | 'client_self_report';

export type GuaranteeInstanceStatus =
  | 'active'
  | 'conditions_met'
  | 'refund_issued'
  | 'credit_issued'
  | 'rollover_upsell_applied'
  | 'rollover_continuity_applied'
  | 'expired'
  | 'voided';

export type MilestoneStatus = 'pending' | 'met' | 'not_met' | 'waived';

// ============================================================================
// Condition schema (stored in guarantee_templates.conditions JSONB)
// ============================================================================

export interface GuaranteeCondition {
  id: string;                          // Unique slug, e.g. "attend-sessions"
  label: string;                       // Human-readable, e.g. "Attend all 6 coaching sessions"
  verification_method: VerificationMethod;
  required: boolean;                   // Must be met for guarantee to pay out
}

// ============================================================================
// Database row types
// ============================================================================

export interface GuaranteeTemplate {
  id: string;
  name: string;
  description: string | null;
  guarantee_type: GuaranteeType;
  duration_days: number;
  conditions: GuaranteeCondition[];
  default_payout_type: GuaranteePayoutType;
  payout_amount_type: PayoutAmountType;
  payout_amount_value: number | null;
  rollover_upsell_service_ids: string[] | null;
  rollover_continuity_plan_id: string | null;
  rollover_bonus_multiplier: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuaranteeInstance {
  id: string;
  order_id: number | null;
  order_item_id: number | null;
  guarantee_template_id: string;
  client_email: string;
  client_name: string | null;
  user_id: string | null;
  purchase_amount: number;
  payout_type: GuaranteePayoutType;
  status: GuaranteeInstanceStatus;
  conditions_snapshot: GuaranteeCondition[];
  starts_at: string;
  expires_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  stripe_refund_id: string | null;
  discount_code_id: number | null;
  subscription_id: string | null;
  rollover_credit_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface GuaranteeMilestone {
  id: string;
  guarantee_instance_id: string;
  condition_id: string;
  condition_label: string;
  status: MilestoneStatus;
  verified_by: string | null;
  verified_at: string | null;
  admin_notes: string | null;
  client_evidence: string | null;
  client_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Input types (for API requests)
// ============================================================================

export interface CreateGuaranteeTemplateInput {
  name: string;
  description?: string;
  guarantee_type?: GuaranteeType;
  duration_days: number;
  conditions: GuaranteeCondition[];
  default_payout_type: GuaranteePayoutType;
  payout_amount_type?: PayoutAmountType;
  payout_amount_value?: number;
  rollover_upsell_service_ids?: string[];
  rollover_continuity_plan_id?: string;
  rollover_bonus_multiplier?: number;
}

export interface UpdateGuaranteeTemplateInput extends Partial<CreateGuaranteeTemplateInput> {
  is_active?: boolean;
}

export interface VerifyMilestoneInput {
  status: 'met' | 'not_met' | 'waived';
  admin_notes?: string;
}

export interface ClientSubmitMilestoneInput {
  client_evidence: string;
}

export interface ChoosePayoutInput {
  payout_type: GuaranteePayoutType;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate the payout amount based on template configuration.
 */
export function calculatePayoutAmount(
  purchaseAmount: number,
  template: Pick<GuaranteeTemplate, 'payout_amount_type' | 'payout_amount_value'>
): number {
  switch (template.payout_amount_type) {
    case 'full':
      return purchaseAmount;
    case 'partial':
      // payout_amount_value is a percentage (0-100)
      return purchaseAmount * ((template.payout_amount_value || 100) / 100);
    case 'fixed':
      return Math.min(template.payout_amount_value || 0, purchaseAmount);
    default:
      return purchaseAmount;
  }
}

/**
 * Calculate the rollover credit amount including bonus multiplier.
 */
export function calculateRolloverCredit(
  purchaseAmount: number,
  template: Pick<GuaranteeTemplate, 'payout_amount_type' | 'payout_amount_value' | 'rollover_bonus_multiplier'>
): number {
  const baseAmount = calculatePayoutAmount(purchaseAmount, template);
  return baseAmount * (template.rollover_bonus_multiplier || 1.0);
}

/**
 * Check if all required milestones are met (or waived).
 */
export function areAllConditionsMet(
  milestones: Pick<GuaranteeMilestone, 'status'>[],
  conditions: GuaranteeCondition[]
): boolean {
  // Build a set of required condition IDs
  const requiredIds = new Set(
    conditions.filter(c => c.required).map(c => c.id)
  );

  // All milestones matching required conditions must be 'met' or 'waived'
  return milestones.every(m => {
    // If this milestone is for a non-required condition, it passes regardless
    // But we check all milestones since they map 1:1 to conditions
    return m.status === 'met' || m.status === 'waived';
  }) || milestones.filter((_, i) => requiredIds.has(conditions[i]?.id))
    .every(m => m.status === 'met' || m.status === 'waived');
}

/**
 * Check whether a guarantee instance has expired.
 */
export function isGuaranteeExpired(instance: Pick<GuaranteeInstance, 'expires_at'>): boolean {
  return new Date(instance.expires_at) < new Date();
}

/**
 * Calculate days remaining on a guarantee.
 */
export function daysRemaining(instance: Pick<GuaranteeInstance, 'expires_at'>): number {
  const now = new Date();
  const expires = new Date(instance.expires_at);
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Determine the terminal status based on payout type.
 */
export function getResolvedStatus(payoutType: GuaranteePayoutType): GuaranteeInstanceStatus {
  switch (payoutType) {
    case 'refund':
      return 'refund_issued';
    case 'credit':
      return 'credit_issued';
    case 'rollover_upsell':
      return 'rollover_upsell_applied';
    case 'rollover_continuity':
      return 'rollover_continuity_applied';
  }
}

/**
 * Validate a conditions array structure.
 */
export function validateConditions(conditions: unknown): conditions is GuaranteeCondition[] {
  if (!Array.isArray(conditions)) return false;
  return conditions.every(c =>
    typeof c === 'object' && c !== null &&
    typeof c.id === 'string' && c.id.length > 0 &&
    typeof c.label === 'string' && c.label.length > 0 &&
    (c.verification_method === 'admin_verified' || c.verification_method === 'client_self_report') &&
    typeof c.required === 'boolean'
  );
}

// ============================================================================
// Labels / display helpers
// ============================================================================

export const GUARANTEE_TYPE_LABELS: Record<GuaranteeType, string> = {
  conditional: 'Conditional (client must meet conditions)',
  unconditional: 'Unconditional (no questions asked)',
};

export const PAYOUT_TYPE_LABELS: Record<GuaranteePayoutType, string> = {
  refund: 'Refund (money back)',
  credit: 'Credit (toward future purchase)',
  rollover_upsell: 'Rollover to Upsell (one-time credit)',
  rollover_continuity: 'Rollover to Continuity (subscription credit)',
};

export const PAYOUT_AMOUNT_TYPE_LABELS: Record<PayoutAmountType, string> = {
  full: 'Full purchase price',
  partial: 'Percentage of purchase price',
  fixed: 'Fixed dollar amount',
};

export const INSTANCE_STATUS_LABELS: Record<GuaranteeInstanceStatus, string> = {
  active: 'Active',
  conditions_met: 'Conditions Met — Awaiting Client Choice',
  refund_issued: 'Refund Issued',
  credit_issued: 'Credit Issued',
  rollover_upsell_applied: 'Upsell Credit Applied',
  rollover_continuity_applied: 'Continuity Credit Applied',
  expired: 'Expired',
  voided: 'Voided',
};

export const INSTANCE_STATUS_COLORS: Record<GuaranteeInstanceStatus, string> = {
  active: 'bg-blue-900/50 text-blue-300 border-blue-500',
  conditions_met: 'bg-green-900/50 text-green-300 border-green-500',
  refund_issued: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
  credit_issued: 'bg-purple-900/50 text-purple-300 border-purple-500',
  rollover_upsell_applied: 'bg-indigo-900/50 text-indigo-300 border-indigo-500',
  rollover_continuity_applied: 'bg-teal-900/50 text-teal-300 border-teal-500',
  expired: 'bg-gray-700/50 text-gray-300 border-gray-500',
  voided: 'bg-red-900/50 text-red-300 border-red-500',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  met: 'Met',
  not_met: 'Not Met',
  waived: 'Waived',
};
