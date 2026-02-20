// Attraction Campaigns — Shared types and helpers
// Template-based criteria personalized per client using audit data and value evidence

import { calculatePayoutAmount, calculateRolloverCredit } from './guarantees';
import type { GuaranteePayoutType, PayoutAmountType } from './guarantees';

// ============================================================================
// Types
// ============================================================================

export type CampaignType = 'win_money_back' | 'free_challenge' | 'bonus_credit';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type CriteriaType = 'action' | 'result';

export type TrackingSource =
  | 'manual'
  | 'onboarding_milestone'
  | 'chat_session'
  | 'video_watch'
  | 'diagnostic_completion'
  | 'custom_webhook';

export type EnrollmentSource = 'auto_purchase' | 'admin_manual' | 'sales_conversation';

export type EnrollmentStatus =
  | 'active'
  | 'criteria_met'
  | 'payout_pending'
  | 'refund_issued'
  | 'credit_issued'
  | 'rollover_applied'
  | 'expired'
  | 'withdrawn';

export type ProgressStatus = 'pending' | 'in_progress' | 'met' | 'not_met' | 'waived';

// ============================================================================
// Database row types
// ============================================================================

export interface AttractionCampaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  enrollment_deadline: string | null;
  completion_window_days: number;
  min_purchase_amount: number;
  payout_type: GuaranteePayoutType;
  payout_amount_type: PayoutAmountType;
  payout_amount_value: number | null;
  rollover_bonus_multiplier: number;
  hero_image_url: string | null;
  promo_copy: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignEligibleBundle {
  id: string;
  campaign_id: string;
  bundle_id: string;
  override_min_amount: number | null;
  created_at: string;
}

export interface CampaignCriteriaTemplate {
  id: string;
  campaign_id: string;
  label_template: string;
  description_template: string | null;
  criteria_type: CriteriaType;
  tracking_source: TrackingSource;
  tracking_config: Record<string, unknown>;
  threshold_source: string | null;
  threshold_default: string | null;
  required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignEnrollment {
  id: string;
  campaign_id: string;
  client_email: string;
  client_name: string | null;
  user_id: string | null;
  order_id: number | null;
  bundle_id: string | null;
  purchase_amount: number | null;
  enrollment_source: EnrollmentSource;
  status: EnrollmentStatus;
  enrolled_at: string;
  deadline_at: string;
  resolved_at: string | null;
  guarantee_instance_id: string | null;
  resolution_notes: string | null;
  diagnostic_audit_id: string | null;
  personalization_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentCriterion {
  id: string;
  enrollment_id: string;
  template_criterion_id: string;
  label: string;
  description: string | null;
  criteria_type: CriteriaType;
  tracking_source: TrackingSource;
  tracking_config: Record<string, unknown>;
  target_value: string | null;
  required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignProgress {
  id: string;
  enrollment_id: string;
  criterion_id: string;
  status: ProgressStatus;
  progress_value: number;
  current_value: string | null;
  auto_tracked: boolean;
  auto_source_ref: string | null;
  client_evidence: string | null;
  client_submitted_at: string | null;
  admin_verified_by: string | null;
  admin_verified_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Input types
// ============================================================================

export interface CreateCampaignInput {
  name: string;
  slug: string;
  description?: string;
  campaign_type?: CampaignType;
  starts_at?: string;
  ends_at?: string;
  enrollment_deadline?: string;
  completion_window_days?: number;
  min_purchase_amount?: number;
  payout_type?: GuaranteePayoutType;
  payout_amount_type?: PayoutAmountType;
  payout_amount_value?: number;
  rollover_bonus_multiplier?: number;
  hero_image_url?: string;
  promo_copy?: string;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: CampaignStatus;
}

export interface CreateCriteriaTemplateInput {
  label_template: string;
  description_template?: string;
  criteria_type?: CriteriaType;
  tracking_source?: TrackingSource;
  tracking_config?: Record<string, unknown>;
  threshold_source?: string;
  threshold_default?: string;
  required?: boolean;
  display_order?: number;
}

export interface ManualEnrollInput {
  client_email: string;
  client_name?: string;
  user_id?: string;
  order_id?: number;
  bundle_id?: string;
  purchase_amount?: number;
  diagnostic_audit_id?: string;
  enrollment_source?: EnrollmentSource;
}

export interface VerifyProgressInput {
  status: 'met' | 'not_met' | 'waived';
  admin_notes?: string;
  current_value?: string;
}

export interface ClientSubmitProgressInput {
  client_evidence: string;
  current_value?: string;
}

export interface ChooseCampaignPayoutInput {
  payout_type: GuaranteePayoutType;
}

// ============================================================================
// Personalization context — snapshot of data used to fill templates
// ============================================================================

export interface PersonalizationContext {
  audit_data?: Record<string, unknown>;
  value_evidence?: Record<string, unknown>;
  chat_insights?: Record<string, unknown>;
  custom_overrides?: Record<string, string>;
}

// ============================================================================
// Criteria materialization
// ============================================================================

/**
 * Resolve {{variable}} placeholders in a template string using context data.
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * Extract a value from nested context using a dot-path like "audit.desired_monthly_revenue".
 */
export function extractThresholdValue(
  context: PersonalizationContext,
  thresholdSource: string | null,
  thresholdDefault: string | null
): string | null {
  if (!thresholdSource) return thresholdDefault;

  const parts = thresholdSource.split('.');

  const keyMap: Record<string, string> = {
    audit: 'audit_data',
    evidence: 'value_evidence',
    chat: 'chat_insights',
    custom: 'custom_overrides',
  };

  let current: Record<string, unknown> | undefined = context as Record<string, unknown>;

  for (let i = 0; i < parts.length; i++) {
    const key = i === 0 ? (keyMap[parts[i]] || parts[i]) : parts[i];
    const val = current?.[key];
    if (val === undefined || val === null) return thresholdDefault;
    if (i < parts.length - 1) {
      if (typeof val !== 'object') return thresholdDefault;
      current = val as Record<string, unknown>;
    } else {
      return String(val);
    }
  }

  return thresholdDefault;
}

/**
 * Materialize personalized criteria from campaign templates + client context.
 * Returns enrollment_criteria rows ready for insert (without id/enrollment_id).
 */
export function materializeCriteria(
  templates: CampaignCriteriaTemplate[],
  context: PersonalizationContext
): Omit<EnrollmentCriterion, 'id' | 'enrollment_id' | 'created_at' | 'updated_at'>[] {
  return templates.map((t) => {
    const targetValue = extractThresholdValue(context, t.threshold_source, t.threshold_default);

    const variables: Record<string, string> = {};
    if (targetValue) {
      // Use the last segment of threshold_source as the variable name
      const varName = t.threshold_source?.split('.').pop() || 'target';
      variables[varName] = targetValue;
    }
    // Also include any custom overrides
    if (context.custom_overrides) {
      Object.assign(variables, context.custom_overrides);
    }

    return {
      template_criterion_id: t.id,
      label: resolveTemplate(t.label_template, variables),
      description: t.description_template ? resolveTemplate(t.description_template, variables) : null,
      criteria_type: t.criteria_type,
      tracking_source: t.tracking_source,
      tracking_config: t.tracking_config,
      target_value: targetValue,
      required: t.required,
      display_order: t.display_order,
    };
  });
}

// ============================================================================
// Enrollment helpers
// ============================================================================

/**
 * Calculate the deadline for an enrollment based on campaign config.
 */
export function calculateDeadline(enrolledAt: Date, completionWindowDays: number): Date {
  const deadline = new Date(enrolledAt);
  deadline.setDate(deadline.getDate() + completionWindowDays);
  return deadline;
}

/**
 * Check if all required criteria are met (or waived).
 */
export function areAllCriteriaMet(
  progress: { status: string }[],
  criteria: { required: boolean }[]
): boolean {
  return progress.every((p, i) => {
    if (!criteria[i]?.required) return true;
    return p.status === 'met' || p.status === 'waived';
  });
}

/**
 * Calculate overall progress percentage.
 */
export function calculateOverallProgress(
  progress: { status: string }[]
): number {
  if (progress.length === 0) return 0;
  const completed = progress.filter(p => p.status === 'met' || p.status === 'waived').length;
  return Math.round((completed / progress.length) * 100);
}

/**
 * Check if an enrollment has expired.
 */
export function isEnrollmentExpired(enrollment: Pick<CampaignEnrollment, 'deadline_at'>): boolean {
  return new Date(enrollment.deadline_at) < new Date();
}

/**
 * Days remaining on an enrollment.
 */
export function enrollmentDaysRemaining(enrollment: Pick<CampaignEnrollment, 'deadline_at'>): number {
  const now = new Date();
  const deadline = new Date(enrollment.deadline_at);
  const diff = deadline.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Check if a campaign is currently accepting enrollments.
 */
export function isCampaignEnrollable(campaign: Pick<AttractionCampaign, 'status' | 'starts_at' | 'ends_at' | 'enrollment_deadline'>): boolean {
  if (campaign.status !== 'active') return false;
  const now = new Date();
  if (campaign.starts_at && new Date(campaign.starts_at) > now) return false;
  if (campaign.enrollment_deadline && new Date(campaign.enrollment_deadline) < now) return false;
  if (campaign.ends_at && new Date(campaign.ends_at) < now) return false;
  return true;
}

// Payout helpers delegate to existing guarantee system
export { calculatePayoutAmount, calculateRolloverCredit };

// ============================================================================
// Validation
// ============================================================================

const VALID_CAMPAIGN_TYPES: CampaignType[] = ['win_money_back', 'free_challenge', 'bonus_credit'];
const VALID_CAMPAIGN_STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];
const VALID_TRACKING_SOURCES: TrackingSource[] = ['manual', 'onboarding_milestone', 'chat_session', 'video_watch', 'diagnostic_completion', 'custom_webhook'];
const VALID_CRITERIA_TYPES: CriteriaType[] = ['action', 'result'];
const VALID_ENROLLMENT_SOURCES: EnrollmentSource[] = ['auto_purchase', 'admin_manual', 'sales_conversation'];
const VALID_ENROLLMENT_STATUSES: EnrollmentStatus[] = ['active', 'criteria_met', 'payout_pending', 'refund_issued', 'credit_issued', 'rollover_applied', 'expired', 'withdrawn'];

export function isValidCampaignType(v: string): v is CampaignType {
  return VALID_CAMPAIGN_TYPES.includes(v as CampaignType);
}

export function isValidCampaignStatus(v: string): v is CampaignStatus {
  return VALID_CAMPAIGN_STATUSES.includes(v as CampaignStatus);
}

export function isValidTrackingSource(v: string): v is TrackingSource {
  return VALID_TRACKING_SOURCES.includes(v as TrackingSource);
}

export function isValidCriteriaType(v: string): v is CriteriaType {
  return VALID_CRITERIA_TYPES.includes(v as CriteriaType);
}

export function isValidEnrollmentSource(v: string): v is EnrollmentSource {
  return VALID_ENROLLMENT_SOURCES.includes(v as EnrollmentSource);
}

export function isValidEnrollmentStatus(v: string): v is EnrollmentStatus {
  return VALID_ENROLLMENT_STATUSES.includes(v as EnrollmentStatus);
}

export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// ============================================================================
// Labels / display helpers
// ============================================================================

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  win_money_back: 'Win Your Money Back',
  free_challenge: 'Free Challenge',
  bonus_credit: 'Bonus Credit',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-gray-700/50 text-gray-300 border-gray-500',
  active: 'bg-green-900/50 text-green-300 border-green-500',
  paused: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
  completed: 'bg-blue-900/50 text-blue-300 border-blue-500',
  archived: 'bg-gray-700/50 text-gray-400 border-gray-600',
};

export const CRITERIA_TYPE_LABELS: Record<CriteriaType, string> = {
  action: 'Action (do the work)',
  result: 'Result (get the outcome)',
};

export const TRACKING_SOURCE_LABELS: Record<TrackingSource, string> = {
  manual: 'Manual (client self-report or admin)',
  onboarding_milestone: 'Onboarding Milestone (auto)',
  chat_session: 'Chat Session (auto)',
  video_watch: 'Video Watch (auto)',
  diagnostic_completion: 'Diagnostic Completion (auto)',
  custom_webhook: 'Custom Webhook (external)',
};

export const ENROLLMENT_SOURCE_LABELS: Record<EnrollmentSource, string> = {
  auto_purchase: 'Auto (on purchase)',
  admin_manual: 'Admin (manual)',
  sales_conversation: 'Sales Conversation',
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Active',
  criteria_met: 'Criteria Met — Awaiting Payout Choice',
  payout_pending: 'Payout Pending',
  refund_issued: 'Refund Issued',
  credit_issued: 'Credit Issued',
  rollover_applied: 'Rollover Applied',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: 'bg-blue-900/50 text-blue-300 border-blue-500',
  criteria_met: 'bg-green-900/50 text-green-300 border-green-500',
  payout_pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
  refund_issued: 'bg-amber-900/50 text-amber-300 border-amber-500',
  credit_issued: 'bg-purple-900/50 text-purple-300 border-purple-500',
  rollover_applied: 'bg-indigo-900/50 text-indigo-300 border-indigo-500',
  expired: 'bg-gray-700/50 text-gray-300 border-gray-500',
  withdrawn: 'bg-red-900/50 text-red-300 border-red-500',
};

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  met: 'Met',
  not_met: 'Not Met',
  waived: 'Waived',
};

export const PROGRESS_STATUS_COLORS: Record<ProgressStatus, string> = {
  pending: 'bg-gray-700/50 text-gray-300 border-gray-500',
  in_progress: 'bg-blue-900/50 text-blue-300 border-blue-500',
  met: 'bg-green-900/50 text-green-300 border-green-500',
  not_met: 'bg-red-900/50 text-red-300 border-red-500',
  waived: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
};
