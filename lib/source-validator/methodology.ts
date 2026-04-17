/**
 * VEP Source Validator - methodology-note composer
 *
 * Produces a short, human-readable source line that mirrors the "source line"
 * consultants put under every chart. Format:
 *
 *   "<source> (<year or vintage>) - Tier <n> <label>[; <adjustment note>]"
 *
 * Examples:
 *   "BLS Manufacturing Wage Data (2025) - Tier 1 BLS"
 *   "Ponemon Institute Financial Error Study (2025) - Tier 2 Ponemon Institute"
 *   "Industry estimate (2025) - Tier 5 low-trust free text; original source not verifiable"
 */

import type { TrustTier } from './types'
import type { TierAssignment } from './tiers'

export interface MethodologyInput {
  source: string | null | undefined
  year: number | null | undefined
  published_date: string | null | undefined
  trust_tier: TrustTier
  tier_label: string
  /** Free-form adjustment or caveat (optional). */
  adjustment?: string | null
  /** When URL fetch produced a title, include it for traceability. */
  fetched_title?: string | null
  /** When URL fetch failed, include a short reason. */
  fetch_error_reason?: string | null
}

function formatVintage(year: number | null | undefined, published_date: string | null | undefined): string {
  if (year && Number.isFinite(year)) return String(year)
  if (published_date) {
    const d = new Date(published_date)
    if (!Number.isNaN(d.getTime())) return String(d.getUTCFullYear())
  }
  return 'vintage unknown'
}

export function composeMethodologyNote(input: MethodologyInput): string {
  const source = (input.source ?? '').trim() || 'Unattributed source'
  const vintage = formatVintage(input.year, input.published_date)

  const parts: string[] = [`${source} (${vintage}) - Tier ${input.trust_tier} ${input.tier_label}`]

  if (input.fetched_title && input.fetched_title.toLowerCase() !== source.toLowerCase()) {
    parts.push(`title: "${input.fetched_title.slice(0, 120)}"`)
  }
  if (input.fetch_error_reason) {
    parts.push(`fetch: ${input.fetch_error_reason}`)
  }
  if (input.adjustment) {
    parts.push(input.adjustment)
  }

  return parts.join('; ')
}

/**
 * Helper to build from a TierAssignment.
 */
export function composeFromTier(
  source: string | null | undefined,
  year: number | null | undefined,
  published_date: string | null | undefined,
  tier: TierAssignment,
  extras?: Pick<MethodologyInput, 'adjustment' | 'fetched_title' | 'fetch_error_reason'>
): string {
  return composeMethodologyNote({
    source,
    year,
    published_date,
    trust_tier: tier.tier,
    tier_label: tier.label,
    ...(extras ?? {}),
  })
}
