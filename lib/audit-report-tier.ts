/**
 * Report Tier Engine for Audit Deliverables
 *
 * Computes a Bronze/Silver/Gold/Platinum tier based on data completeness
 * of a diagnostic audit. Returns which report sections are available
 * and which are locked (with unlock prompts).
 *
 * Used by both the standalone audit results page and the chat diagnostic
 * report view — single source of truth for what to render.
 */

import type { DiagnosticAuditRecord, ReportTier } from './diagnostic'
import { AUDIT_CATEGORY_ORDER } from './audit-questions'

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

export type ReportSectionId =
  | 'scores'
  | 'score_drivers'
  | 'value_estimate'
  | 'industry_benchmarks'
  | 'tech_stack_comparison'
  | 'recommendations'
  | 'website_analysis'
  | 'strategy_deck'

export interface AvailableSection {
  id: ReportSectionId
  label: string
}

export interface LockedSection {
  id: ReportSectionId
  label: string
  unlockPrompt: string
  requiredFields: string[]
}

export interface TierResult {
  tier: ReportTier
  availableSections: AvailableSection[]
  lockedSections: LockedSection[]
  completedCategories: number
  totalCategories: number
  hasEmail: boolean
  hasUrl: boolean
  hasIndustry: boolean
}

// ---------------------------------------------------------------------------
// Data completeness signals
// ---------------------------------------------------------------------------

function countCompletedCategories(audit: DiagnosticAuditRecord): number {
  let count = 0
  for (const cat of AUDIT_CATEGORY_ORDER) {
    const data = audit[cat as keyof DiagnosticAuditRecord] as Record<string, unknown> | undefined
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      count++
    }
  }
  return count
}

function hasField(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function hasEnrichedTechStack(audit: DiagnosticAuditRecord): boolean {
  const tech = audit.enriched_tech_stack
  if (!tech || typeof tech !== 'object') return false
  const keys = Object.keys(tech)
  return keys.length > 0 && keys.some((k) => k !== '{}')
}

function hasScreenshot(audit: DiagnosticAuditRecord): boolean {
  return hasField(audit.website_screenshot_path)
}

function hasAnnotations(audit: DiagnosticAuditRecord): boolean {
  const annotations = audit.website_annotations
  return Array.isArray(annotations) && annotations.length > 0
}

function hasValueEstimate(audit: DiagnosticAuditRecord): boolean {
  const ve = audit.value_estimate
  if (!ve || typeof ve !== 'object') return false
  return 'annualValue' in ve && typeof (ve as Record<string, unknown>).annualValue === 'number'
}

// ---------------------------------------------------------------------------
// Tier computation
// ---------------------------------------------------------------------------

/**
 * Compute the report tier and available/locked sections for a diagnostic audit.
 *
 * Tier rules:
 * - Bronze:   < 6 categories OR no email
 * - Silver:   All 6 categories + email
 * - Gold:     Silver + website URL + industry (+ enrichment available)
 * - Platinum: Gold + generated strategy deck (gamma_reports linked)
 *
 * The tier is the maximum tier the data supports. Sections that require
 * a higher tier than the current one are returned as locked with prompts.
 */
export function computeReportTier(
  audit: DiagnosticAuditRecord,
  options?: { hasDeck?: boolean }
): TierResult {
  const completedCategories = countCompletedCategories(audit)
  const totalCategories = AUDIT_CATEGORY_ORDER.length
  const allCategoriesComplete = completedCategories === totalCategories
  const hasEmail = hasField(audit.contact_email)
  const hasUrl = hasField(audit.website_url)
  const hasIndustry = hasField(audit.industry_slug)
  const hasDeck = options?.hasDeck ?? (audit.report_tier === 'platinum')

  let tier: ReportTier = 'bronze'
  if (allCategoriesComplete && hasEmail) tier = 'silver'
  if (tier === 'silver' && hasUrl && hasIndustry) tier = 'gold'
  if (tier === 'gold' && hasDeck) tier = 'platinum'

  const available: AvailableSection[] = []
  const locked: LockedSection[] = []

  // Bronze: always available
  if (completedCategories > 0) {
    available.push({ id: 'scores', label: 'Urgency & Opportunity Scores' })
    available.push({ id: 'score_drivers', label: 'Based on Your Answers' })
  }

  // Silver: value estimate + recommendations
  if (tier === 'silver' || tier === 'gold' || tier === 'platinum') {
    available.push({ id: 'value_estimate', label: 'Your Opportunity Estimate' })
    available.push({ id: 'recommendations', label: 'Personalized Recommendations' })

    if (hasIndustry) {
      available.push({ id: 'industry_benchmarks', label: 'Industry Benchmarks' })
    } else {
      locked.push({
        id: 'industry_benchmarks',
        label: 'Industry Benchmarks',
        unlockPrompt: 'Select your industry to see how you compare to similar businesses.',
        requiredFields: ['industry_slug'],
      })
    }
  } else {
    // Bronze — these are locked
    const missingParts: string[] = []
    if (!allCategoriesComplete) {
      missingParts.push(`Complete all ${totalCategories} audit categories`)
    }
    if (!hasEmail) {
      missingParts.push('Provide your email')
    }

    locked.push({
      id: 'value_estimate',
      label: 'Your Opportunity Estimate',
      unlockPrompt: `${missingParts.join(' and ')} to unlock your personalized opportunity estimate.`,
      requiredFields: allCategoriesComplete ? ['contact_email'] : ['all_categories', 'contact_email'],
    })
    locked.push({
      id: 'recommendations',
      label: 'Personalized Recommendations',
      unlockPrompt: `${missingParts.join(' and ')} to unlock tailored recommendations.`,
      requiredFields: allCategoriesComplete ? ['contact_email'] : ['all_categories', 'contact_email'],
    })
    locked.push({
      id: 'industry_benchmarks',
      label: 'Industry Benchmarks',
      unlockPrompt: 'Complete the audit and select your industry to see benchmarks.',
      requiredFields: ['all_categories', 'contact_email', 'industry_slug'],
    })
  }

  // Gold: tech stack comparison + website analysis
  if (tier === 'gold' || tier === 'platinum') {
    if (hasEnrichedTechStack(audit)) {
      available.push({ id: 'tech_stack_comparison', label: 'Tech Stack Analysis' })
    } else {
      // URL provided but enrichment hasn't run yet — show as available but loading
      available.push({ id: 'tech_stack_comparison', label: 'Tech Stack Analysis' })
    }

    if (hasScreenshot(audit) || hasAnnotations(audit)) {
      available.push({ id: 'website_analysis', label: 'Website Analysis' })
    } else {
      locked.push({
        id: 'website_analysis',
        label: 'Website Visual Analysis',
        unlockPrompt: 'Your website is being analyzed. This section will appear when the analysis is ready.',
        requiredFields: ['website_screenshot_path'],
      })
    }
  } else {
    if (!hasUrl) {
      locked.push({
        id: 'tech_stack_comparison',
        label: 'Tech Stack Analysis',
        unlockPrompt: 'Add your website URL to unlock a comparison of your detected tech stack vs. what you reported.',
        requiredFields: ['website_url'],
      })
    }

    locked.push({
      id: 'website_analysis',
      label: 'Website Visual Analysis',
      unlockPrompt: 'Add your website URL and industry to unlock an annotated analysis of your site.',
      requiredFields: ['website_url', 'industry_slug'],
    })
  }

  // Platinum: strategy deck
  if (tier === 'platinum') {
    available.push({ id: 'strategy_deck', label: 'Your Strategy Deck' })
  } else if (tier === 'gold') {
    locked.push({
      id: 'strategy_deck',
      label: 'Personalized Strategy Deck',
      unlockPrompt: 'Your personalized strategy deck is being generated. We\'ll also email it to you.',
      requiredFields: [],
    })
  } else {
    locked.push({
      id: 'strategy_deck',
      label: 'Personalized Strategy Deck',
      unlockPrompt: 'Complete your audit with website URL and industry to unlock a downloadable strategy deck.',
      requiredFields: ['all_categories', 'contact_email', 'website_url', 'industry_slug'],
    })
  }

  return {
    tier,
    availableSections: available,
    lockedSections: locked,
    completedCategories,
    totalCategories,
    hasEmail,
    hasUrl,
    hasIndustry,
  }
}

/**
 * Human-friendly tier label for display.
 */
export function getTierLabel(tier: ReportTier): string {
  switch (tier) {
    case 'bronze': return 'Basic Report'
    case 'silver': return 'Smart Report'
    case 'gold': return 'Full Analysis'
    case 'platinum': return 'Strategy Package'
  }
}

/**
 * Tier badge color classes (Tailwind).
 */
export function getTierColorClasses(tier: ReportTier): string {
  switch (tier) {
    case 'bronze': return 'bg-amber-700/20 border-amber-600/40 text-amber-300'
    case 'silver': return 'bg-slate-400/20 border-slate-300/40 text-slate-200'
    case 'gold': return 'bg-yellow-500/20 border-yellow-400/40 text-yellow-200'
    case 'platinum': return 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
  }
}
