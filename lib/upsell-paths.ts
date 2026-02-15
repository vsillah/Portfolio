// lib/upsell-paths.ts
// Shared helpers for querying and using offer_upsell_paths data.
// Used by: AI recommendation engine, follow-up scheduling, onboarding plans,
//          proposals, pricing page, progress updates, and sales conversation flow.

import { supabaseAdmin } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface UpsellPath {
  id: string;
  source_content_type: string;
  source_content_id: string;
  source_title: string;
  source_tier_slug: string | null;
  next_problem: string;
  next_problem_timing: string;
  next_problem_signals: string[];
  upsell_content_type: string;
  upsell_content_id: string;
  upsell_title: string;
  upsell_tier_slug: string | null;
  upsell_perceived_value: number | null;
  point_of_sale_steps: ScriptStep[];
  point_of_pain_steps: ScriptStep[];
  incremental_cost: number | null;
  incremental_value: number | null;
  value_frame_text: string | null;
  risk_reversal_text: string | null;
  credit_previous_investment: boolean;
  credit_note: string | null;
  point_of_sale_script_id: string | null;
  point_of_pain_script_id: string | null;
  display_order: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScriptStep {
  id: string;
  title: string;
  talking_points: string[];
  actions: string[];
}

// ============================================================================
// Query Helpers (server-side only — uses supabaseAdmin)
// ============================================================================

/**
 * Get the upsell path(s) for a given source offer.
 * Returns active paths ordered by display_order.
 */
export async function getUpsellPathsForOffer(
  contentType: string,
  contentId: string,
  tierSlug?: string
): Promise<UpsellPath[]> {
  let query = supabaseAdmin
    .from('offer_upsell_paths')
    .select('*')
    .eq('source_content_type', contentType)
    .eq('source_content_id', contentId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (tierSlug) {
    query = query.eq('source_tier_slug', tierSlug);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[upsell-paths] Error fetching for offer:', error.message);
    return [];
  }
  return (data || []) as UpsellPath[];
}

/**
 * Get all upsell paths for a given source tier slug.
 * Useful for the pricing page to show all upgrade paths for a CI tier.
 */
export async function getUpsellPathsForTier(
  tierSlug: string
): Promise<UpsellPath[]> {
  const { data, error } = await supabaseAdmin
    .from('offer_upsell_paths')
    .select('*')
    .eq('source_tier_slug', tierSlug)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[upsell-paths] Error fetching for tier:', error.message);
    return [];
  }
  return (data || []) as UpsellPath[];
}

/**
 * Get all active upsell paths.
 * Useful for the AI recommendation engine to scan for matches.
 */
export async function getAllActiveUpsellPaths(): Promise<UpsellPath[]> {
  const { data, error } = await supabaseAdmin
    .from('offer_upsell_paths')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[upsell-paths] Error fetching all:', error.message);
    return [];
  }
  return (data || []) as UpsellPath[];
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format an upsell path as a recommendation block for AI/script context.
 * Used when injecting upsell data into conversation prompts or proposals.
 */
export function formatUpsellRecommendation(path: UpsellPath): string {
  const lines: string[] = [];
  lines.push(`**Recommended Upgrade:** ${path.upsell_title}`);
  lines.push(`**From:** ${path.source_title} → ${path.upsell_title}`);
  
  if (path.incremental_cost) {
    lines.push(`**Additional Investment:** $${path.incremental_cost.toLocaleString()}`);
  }
  if (path.upsell_perceived_value) {
    lines.push(`**Value:** $${path.upsell_perceived_value.toLocaleString()}`);
  }
  if (path.value_frame_text) {
    lines.push(`**Value Frame:** ${path.value_frame_text}`);
  }
  if (path.risk_reversal_text) {
    lines.push(`**Guarantee:** ${path.risk_reversal_text}`);
  }
  if (path.credit_previous_investment && path.credit_note) {
    lines.push(`**Credit Policy:** ${path.credit_note}`);
  }
  
  return lines.join('\n');
}

/**
 * Format an upsell path as a proposal add-on line item.
 */
export function formatUpsellAsProposalAddon(path: UpsellPath): {
  title: string;
  description: string;
  price: number | null;
  perceived_value: number | null;
  is_optional: boolean;
  risk_reversal: string | null;
  credit_note: string | null;
} {
  return {
    title: `Recommended: ${path.upsell_title}`,
    description: path.next_problem,
    price: path.incremental_cost,
    perceived_value: path.upsell_perceived_value,
    is_optional: true,
    risk_reversal: path.risk_reversal_text,
    credit_note: path.credit_previous_investment ? path.credit_note : null,
  };
}

/**
 * Format an upsell path as an onboarding milestone note.
 */
export function formatUpsellAsOnboardingNote(path: UpsellPath): string {
  return [
    `📈 **Recommended Upgrade Available**`,
    `After completing the ${path.source_title}, consider upgrading to the ${path.upsell_title}.`,
    path.next_problem ? `**Why:** ${path.next_problem}` : '',
    path.value_frame_text ? `**Value:** ${path.value_frame_text}` : '',
    path.credit_previous_investment && path.credit_note ? `**Credit:** ${path.credit_note}` : '',
  ].filter(Boolean).join('\n');
}

// ============================================================================
// Follow-Up Scheduling
// ============================================================================

/**
 * Parse a human-readable timing string (e.g. "2-4 weeks", "1 month", "30 days")
 * into a target Date relative to now. Uses the midpoint for ranges.
 */
export function parseTimingToDate(timing: string, fromDate?: Date): Date {
  const base = fromDate || new Date();
  const lower = timing.toLowerCase().trim();

  // Match patterns like "2-4 weeks", "1-2 months", "30 days"
  const rangeMatch = lower.match(/^(\d+)\s*-\s*(\d+)\s*(day|week|month)s?$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    const mid = Math.round((min + max) / 2);
    const unit = rangeMatch[3];
    return addTimeUnit(base, mid, unit);
  }

  // Match patterns like "2 weeks", "1 month", "30 days"
  const singleMatch = lower.match(/^(\d+)\s*(day|week|month)s?$/);
  if (singleMatch) {
    const value = parseInt(singleMatch[1], 10);
    const unit = singleMatch[2];
    return addTimeUnit(base, value, unit);
  }

  // Fallback: 3 weeks from now
  return addTimeUnit(base, 3, 'week');
}

function addTimeUnit(base: Date, value: number, unit: string): Date {
  const result = new Date(base);
  switch (unit) {
    case 'day':
      result.setDate(result.getDate() + value);
      break;
    case 'week':
      result.setDate(result.getDate() + value * 7);
      break;
    case 'month':
      result.setMonth(result.getMonth() + value);
      break;
    default:
      result.setDate(result.getDate() + value * 7);
  }
  return result;
}

/**
 * Schedule an upsell follow-up task for a client project.
 * Creates a meeting_action_task with a due date based on next_problem_timing,
 * and a description summarizing the point-of-pain script.
 *
 * Returns the created task ID, or null on failure.
 */
export async function scheduleUpsellFollowUp(
  clientProjectId: string,
  upsellPath: UpsellPath,
  fromDate?: Date
): Promise<string | null> {
  const dueDate = parseTimingToDate(upsellPath.next_problem_timing, fromDate);

  // Build description from point-of-pain steps
  const painStepsSummary = upsellPath.point_of_pain_steps
    .map((step) => {
      const points = step.talking_points.join('; ');
      return `**${step.title}:** ${points}`;
    })
    .join('\n');

  const description = [
    `Upsell follow-up: ${upsellPath.source_title} → ${upsellPath.upsell_title}`,
    '',
    `**Predicted problem:** ${upsellPath.next_problem}`,
    upsellPath.value_frame_text ? `**Value frame:** ${upsellPath.value_frame_text}` : '',
    upsellPath.risk_reversal_text ? `**Risk reversal:** ${upsellPath.risk_reversal_text}` : '',
    upsellPath.credit_previous_investment && upsellPath.credit_note
      ? `**Credit:** ${upsellPath.credit_note}`
      : '',
    '',
    painStepsSummary ? `**Point-of-pain script:**\n${painStepsSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Check if a follow-up task already exists for this upsell path + project
  const { data: existing } = await supabaseAdmin
    .from('meeting_action_tasks')
    .select('id')
    .eq('client_project_id', clientProjectId)
    .ilike('title', `%Upsell check-in: ${upsellPath.upsell_title}%`)
    .limit(1);

  if (existing && existing.length > 0) {
    // Already scheduled — skip duplicate
    return existing[0].id as string;
  }

  const { data: task, error } = await supabaseAdmin
    .from('meeting_action_tasks')
    .insert({
      // meeting_record_id is null — this is a system-generated task, not from a meeting
      meeting_record_id: null,
      client_project_id: clientProjectId,
      title: `Upsell check-in: ${upsellPath.upsell_title}`,
      description,
      owner: 'Sales Lead',
      due_date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
      status: 'pending',
      display_order: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[upsell-paths] Error scheduling follow-up:', error.message);
    return null;
  }

  return (task?.id as string) ?? null;
}

// ============================================================================
// Signal Matching
// ============================================================================

/**
 * Check if a set of signals match the next_problem_signals for a path.
 * Used by progress updates to detect when a client is hitting the predicted pain point.
 */
export function matchesNextProblemSignals(
  path: UpsellPath,
  observedSignals: string[]
): { matches: boolean; matchedSignals: string[] } {
  if (!path.next_problem_signals || path.next_problem_signals.length === 0) {
    return { matches: false, matchedSignals: [] };
  }

  const matchedSignals: string[] = [];
  const lowerObserved = observedSignals.map((s) => s.toLowerCase());

  for (const signal of path.next_problem_signals) {
    const lowerSignal = signal.toLowerCase();
    // Check if any observed signal contains keywords from the expected signal
    const keywords = lowerSignal.split(/\s+/).filter((w) => w.length > 3);
    const hasMatch = lowerObserved.some((obs) =>
      keywords.filter((kw) => obs.includes(kw)).length >= Math.ceil(keywords.length * 0.5)
    );
    if (hasMatch) {
      matchedSignals.push(signal);
    }
  }

  // Consider it a match if at least one signal matches
  return {
    matches: matchedSignals.length > 0,
    matchedSignals,
  };
}
