/**
 * Bundle Item Value Methods
 *
 * Maps each bundle item to a calculation method so its retail value
 * can be dynamically computed from industry benchmarks rather than hardcoded.
 *
 * Retail value = baseHours × benchmarkHourlyRate × categoryMultiplier
 *
 * This produces non-round, credible numbers that shift by segment:
 *   - Nonprofit (low rates) → lower retail values
 *   - Midmarket (high rates) → higher retail values
 */

// ============================================================================
// Types
// ============================================================================

export type ItemCategory = 'consulting' | 'technology' | 'content' | 'support';

export interface ItemValueMethod {
  /** Estimated effort hours for this deliverable */
  baseHours: number;
  /** Category determines the rate multiplier */
  category: ItemCategory;
  /** Optional: this item's value = another tier's total (e.g. "Everything in AI Quick Win") */
  cumulativeRef?: string;
}

export interface BenchmarkContext {
  industry: string;
  companySize: string;
}

export interface SegmentFallbackRates {
  avg_hourly_wage: number;
  avg_deal_size: number;
  avg_employee_cost: number;
  avg_close_rate: number;
}

// ============================================================================
// Category Rate Multipliers
// ============================================================================

/**
 * Multiplier on top of avg_hourly_wage per item category.
 * Reflects market rates for different types of work:
 *   - consulting: premium advisory/strategy rate (~2x employee wage)
 *   - technology: specialized dev/AI engineering rate (~2.8x)
 *   - content: content creation rate (~1.5x)
 *   - support: support/maintenance rate (~1.2x)
 */
export const CATEGORY_RATE_MULTIPLIERS: Record<ItemCategory, number> = {
  consulting: 2.0,
  technology: 2.8,
  content: 1.5,
  support: 1.2,
};

// ============================================================================
// Segment → Benchmark Context Mapping
// ============================================================================

/**
 * Maps a pricing page segment to default benchmark lookup parameters.
 * Optional industry/companySize overrides (from ROI Calculator) take precedence.
 */
export function segmentToBenchmarkContext(
  segment: 'smb' | 'midmarket' | 'nonprofit',
  industry?: string,
  companySize?: string
): BenchmarkContext {
  const defaults: Record<string, BenchmarkContext> = {
    smb: { industry: '_default', companySize: '11-50' },
    midmarket: { industry: '_default', companySize: '51-200' },
    nonprofit: { industry: 'nonprofit', companySize: '1-10' },
  };

  const base = defaults[segment] ?? defaults.smb;

  return {
    industry: industry || base.industry,
    companySize: companySize || base.companySize,
  };
}

/**
 * Fallback rates per segment when DB benchmarks are unavailable.
 * Derived from BLS, Glassdoor, and ROI Calculator industry data.
 */
export const SEGMENT_FALLBACK_RATES: Record<string, SegmentFallbackRates> = {
  smb: {
    avg_hourly_wage: 42,
    avg_deal_size: 5000,
    avg_employee_cost: 60000,
    avg_close_rate: 0.20,
  },
  midmarket: {
    avg_hourly_wage: 58,
    avg_deal_size: 12000,
    avg_employee_cost: 82000,
    avg_close_rate: 0.22,
  },
  nonprofit: {
    avg_hourly_wage: 30,
    avg_deal_size: 3000,
    avg_employee_cost: 45000,
    avg_close_rate: 0.18,
  },
  // Fallback for unknown segments or when industry lookup fails
  _default: {
    avg_hourly_wage: 40,
    avg_deal_size: 5000,
    avg_employee_cost: 60000,
    avg_close_rate: 0.20,
  },
};

// ============================================================================
// Item → Value Method Mapping
// ============================================================================

/**
 * Maps item titles to their value calculation parameters.
 *
 * For cumulative items ("Everything in X"), the cumulativeRef points to
 * the tier whose total value should be used instead of baseHours × rate.
 *
 * baseHours represents a reasonable estimate of the effort to deliver
 * each item as a standalone service.
 */
export const ITEM_VALUE_METHODS: Record<string, ItemValueMethod> = {
  // ── Quick Win tier items ──────────────────────────────────────────
  'AI Audit Calculator': { baseHours: 6, category: 'consulting' },
  'AI Implementation Playbook': { baseHours: 8, category: 'content' },
  'Automation ROI Templates Pack': { baseHours: 6, category: 'content' },
  'Half-Day AI Strategy Workshop': { baseHours: 42, category: 'consulting' },
  '2 Follow-up Strategy Calls': { baseHours: 6, category: 'consulting' },
  '30-Day Email Support': { baseHours: 12, category: 'support' },

  // ── Accelerator tier items ────────────────────────────────────────
  'Everything in AI Quick Win': { baseHours: 0, category: 'consulting', cumulativeRef: 'quick-win' },
  'AI Customer Support Chatbot': { baseHours: 128, category: 'technology' },
  'Inbound Lead Tracking System': { baseHours: 104, category: 'technology' },
  '4-Week Implementation Coaching': { baseHours: 32, category: 'consulting' },
  'Team Training Session': { baseHours: 16, category: 'consulting' },
  '90-Day Priority Support': { baseHours: 28, category: 'support' },

  // ── Growth Engine tier items ──────────────────────────────────────
  'Everything in AI Accelerator': { baseHours: 0, category: 'consulting', cumulativeRef: 'accelerator' },
  'Lead Generation Workflow Agent': { baseHours: 168, category: 'technology' },
  'Social Media Content Agent': { baseHours: 148, category: 'technology' },
  'Client Onboarding Automation': { baseHours: 104, category: 'technology' },
  'AI Email Sequence Builder': { baseHours: 84, category: 'technology' },
  '12-Week Implementation Program': { baseHours: 96, category: 'consulting' },
  'Monthly Advisory Calls (3 months)': { baseHours: 36, category: 'consulting' },
  'Custom Analytics Dashboard': { baseHours: 44, category: 'technology' },
  'Priority Support Channel': { baseHours: 24, category: 'support' },

  // ── Digital Transformation tier items ─────────────────────────────
  'Everything in Growth Engine': { baseHours: 0, category: 'consulting', cumulativeRef: 'growth-engine' },
  'AI Voice Agent (Inbound)': { baseHours: 144, category: 'technology' },
  'Mobile App Generation': { baseHours: 248, category: 'technology' },
  'Website Development / Redesign': { baseHours: 148, category: 'technology' },
  'RAG Knowledge Base System': { baseHours: 148, category: 'technology' },
  'Dedicated Account Manager (6 months)': { baseHours: 156, category: 'consulting' },
  'Quarterly Strategy Reviews': { baseHours: 48, category: 'consulting' },
  'Maintenance & Optimization (6 months)': { baseHours: 108, category: 'support' },

  // ── Community Impact (CI) Starter tier items ──────────────────────
  'AI Strategy Workshop (Recorded)': { baseHours: 10, category: 'content' },
  'AI Implementation Playbook (PDF)': { baseHours: 8, category: 'content' },
  'ROI Template Spreadsheets': { baseHours: 6, category: 'content' },
  'Community Forum Access': { baseHours: 8, category: 'support' },
  'AI Training Library Access': { baseHours: 10, category: 'content' },

  // ── CI Accelerator tier items ─────────────────────────────────────
  'Everything in CI Starter': { baseHours: 0, category: 'consulting', cumulativeRef: 'ci-starter' },
  'Pre-Built Chatbot Template': { baseHours: 28, category: 'technology' },
  'Group Onboarding Webinar': { baseHours: 18, category: 'consulting' },
  // '30-Day Email Support' already defined above

  // ── CI Growth tier items ──────────────────────────────────────────
  'Everything in CI Accelerator': { baseHours: 0, category: 'consulting', cumulativeRef: 'ci-accelerator' },
  'Lead Tracking Templates': { baseHours: 36, category: 'technology' },
  'Content Automation Templates': { baseHours: 28, category: 'technology' },
  'Group Implementation Program (6 Weeks)': { baseHours: 36, category: 'consulting' },
  'Shared Analytics Dashboard': { baseHours: 18, category: 'technology' },
  '60-Day Email Support': { baseHours: 16, category: 'support' },

  // ── Midmarket tier items (mirrors of SMB with different slugs) ────
  // Midmarket tiers reuse the same item titles as SMB, so they're
  // already covered by the mappings above.
};

/**
 * Get the value method for an item by title.
 * Returns null if no mapping exists (item will use its static perceivedValue).
 */
export function getItemValueMethod(title: string): ItemValueMethod | null {
  return ITEM_VALUE_METHODS[title] ?? null;
}
