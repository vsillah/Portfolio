/**
 * Pure helpers + canonical view-model for the rich audit report.
 *
 * Both the audit flow's `step === 'results'` inline render and the persistent
 * permalink at `/tools/audit/report/[auditId]` derive from the same payload
 * shape returned by `/api/chat/diagnostic`. This module is the single source
 * of truth for all the derived values (score bands, improvement tips, drivers,
 * improvement areas, capture status) and the static copy/constants used to
 * render that report.
 *
 * Keep this file PURE (no React, no hooks, no framer-motion). React components
 * that render the report live under `components/audits/`.
 */

import { AUDIT_CATEGORY_ORDER, formatPayloadLine } from '@/lib/audit-questions'

// ---------------------------------------------------------------------------
// Canonical view-model
// ---------------------------------------------------------------------------

/**
 * Shape returned by `/api/chat/diagnostic` for a single diagnostic audit.
 * Anchored to the JSON (camelCase) response — NOT the DB row shape.
 *
 * Use this type anywhere you need to render the rich audit report.
 */
export interface AuditReportViewModel {
  id: string
  status: string
  businessChallenges?: Record<string, unknown>
  techStack?: Record<string, unknown>
  automationNeeds?: Record<string, unknown>
  aiReadiness?: Record<string, unknown>
  budgetTimeline?: Record<string, unknown>
  decisionMaking?: Record<string, unknown>
  diagnosticSummary?: string
  keyInsights?: string[]
  recommendedActions?: string[]
  urgencyScore?: number | null
  opportunityScore?: number | null
  businessName?: string | null
  websiteUrl?: string | null
  contactEmail?: string | null
  industrySlug?: string | null
  enrichedTechStack?: {
    domain?: string
    technologies?: Array<{ name: string; tag?: string; categories?: string[] }>
    byTag?: Record<string, string[]>
  } | null
  reportTier?: string | null
}

// ---------------------------------------------------------------------------
// Score bands, styles, and definitions
// ---------------------------------------------------------------------------

export type ScoreBand = 'low' | 'mid' | 'high'
export type ScoreType = 'urgency' | 'opportunity'

/** Score band for color and copy: 0–3 low, 4–6 mid, 7–10 high */
export function getScoreBand(score: number): ScoreBand {
  if (score <= 3) return 'low'
  if (score <= 6) return 'mid'
  return 'high'
}

export function getScoreStyle(band: ScoreBand): { bg: string; label: string } {
  switch (band) {
    case 'low':
      return { bg: 'bg-red-500/20 border-red-400/60 text-red-200', label: 'Early stage' }
    case 'mid':
      return { bg: 'bg-amber-500/20 border-amber-400/60 text-amber-200', label: 'In progress' }
    case 'high':
      return { bg: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200', label: 'Strong' }
  }
}

/** One-line definition for the band (UX: label alone is vague) */
export function getScoreDefinition(band: ScoreBand, scoreType: ScoreType): string {
  if (scoreType === 'urgency') {
    switch (band) {
      case 'low': return "You're at the start of your automation journey; small, focused steps will add up."
      case 'mid': return "You're taking steps; focusing on one or two priorities will help you move faster."
      case 'high': return "You're in a good position to act; the next step is execution and measuring impact."
    }
  }
  switch (band) {
    case 'low': return "Potential is high once you address a few foundations; our Resources can help."
    case 'mid': return "You have room to grow impact by connecting systems and clarifying one key outcome."
    case 'high': return "You're well positioned to capture value; focus on execution and clear metrics."
  }
}

export function getUrgencyImprovements(score: number): string[] {
  const band = getScoreBand(score)
  if (band === 'high') return []
  if (band === 'low') {
    return [
      'Clarify who can approve decisions and on what timeline.',
      'Identify one high-pain process to fix first and set a target date.',
    ]
  }
  return [
    'Document your current bottlenecks so you can prioritize automation.',
    'Align stakeholders on a single “must fix” outcome for the next quarter.',
  ]
}

export function getOpportunityImprovements(score: number): string[] {
  const band = getScoreBand(score)
  if (band === 'high') return []
  if (band === 'low') {
    return [
      'Map where manual work costs the most time or revenue.',
      'Review our Resources for quick wins (templates, playbooks) that don’t require big budget.',
    ]
  }
  return [
    'Connect your CRM and key tools so automation can use existing data.',
    'Pick one outcome (e.g. faster follow-up, less data entry) and measure baseline before automating.',
  ]
}

// ---------------------------------------------------------------------------
// Estimated opportunity value
// ---------------------------------------------------------------------------

/** Heuristic estimated opportunity value from budget + opportunity score (display only) */
export function getEstimatedOpportunityValue(
  budgetTimeline?: Record<string, unknown> | null,
  opportunityScore?: number | null
): string | null {
  if (opportunityScore == null) return null
  const range = (budgetTimeline?.budget_range as string) || (budgetTimeline?.budget_flexibility as string)
  const mult = opportunityScore <= 3 ? 0.5 : opportunityScore <= 6 ? 1 : 1.5
  if (range === 'large' || range === 'value_driven') return `$${Math.round(50 * mult)}k–$150k+ potential value`
  if (range === 'medium' || range === 'some_flex') return `$${Math.round(15 * mult)}k–$50k potential value`
  if (range === 'small' || range === 'fixed') return `$${Math.round(5 * mult)}k–$15k potential value`
  return `$${Math.round(10 * mult)}k–$40k potential value (based on your readiness)`
}

// ---------------------------------------------------------------------------
// Score drivers and improvement areas
// ---------------------------------------------------------------------------

/** Build human-readable score driver lines from audit payload (ties score to answers) */
export function getScoreDrivers(results: AuditReportViewModel): { urgency: string[]; opportunity: string[] } {
  const urgency: string[] = []
  const opportunity: string[] = []
  const bt = results.budgetTimeline
  const dm = results.decisionMaking
  const an = results.automationNeeds
  const ar = results.aiReadiness
  const ts = results.techStack

  if (bt) {
    const timeline = formatPayloadLine('budget_timeline', 'timeline', bt.timeline)
    if (timeline) { urgency.push(timeline); opportunity.push(timeline) }
    const range = formatPayloadLine('budget_timeline', 'budget_range', bt.budget_range)
    if (range) opportunity.push(range)
    const flex = formatPayloadLine('budget_timeline', 'budget_flexibility', bt.budget_flexibility)
    if (flex) opportunity.push(flex)
  }
  if (dm) {
    const decisionMaker = formatPayloadLine('decision_making', 'decision_maker', dm.decision_maker)
    if (decisionMaker) { urgency.push(decisionMaker); opportunity.push(decisionMaker) }
    const approval = formatPayloadLine('decision_making', 'approval_process', dm.approval_process)
    if (approval) urgency.push(approval)
  }
  if (an?.priority_areas && Array.isArray(an.priority_areas)) {
    const n = (an.priority_areas as string[]).length
    if (n > 0) opportunity.push(`Priority areas to automate: ${n} selected`)
  }
  if (ar) {
    const dq = formatPayloadLine('ai_readiness', 'data_quality', ar.data_quality)
    if (dq) opportunity.push(dq)
    const tr = formatPayloadLine('ai_readiness', 'team_readiness', ar.team_readiness)
    if (tr) opportunity.push(tr)
  }
  if (ts) {
    const ir = formatPayloadLine('tech_stack', 'integration_readiness', ts.integration_readiness)
    if (ir) opportunity.push(ir)
  }
  return { urgency: urgency.slice(0, 4), opportunity: opportunity.slice(0, 4) }
}

export interface ImprovementArea {
  id: string
  label: string
  reason: string
  nextStepLabel: string
  nextStepUrl: string
}

/** Derive improvement areas from payload + scores; each maps to a specific next step */
export function getImprovementAreas(results: AuditReportViewModel): ImprovementArea[] {
  const areas: ImprovementArea[] = []
  const ts = results.techStack
  const ar = results.aiReadiness
  const dm = results.decisionMaking
  const bt = results.budgetTimeline
  const urgency = results.urgencyScore ?? 5
  const opportunity = results.opportunityScore ?? 5

  if (ts?.integration_readiness === 'not_connected' || ts?.integration_readiness === 'some_apis') {
    areas.push({
      id: 'integration',
      label: 'Integration readiness',
      reason: 'Your tools aren’t fully connected yet. Connecting your CRM and key systems will make automation more effective.',
      nextStepLabel: 'Resources: Get your systems connected',
      nextStepUrl: '/resources',
    })
  }
  if (ar?.data_quality === 'scattered' || ar?.data_quality === 'some_systems') {
    areas.push({
      id: 'data_quality',
      label: 'Data quality',
      reason: 'Your data is in multiple places and not yet connected. Cleaning and structuring it will unlock better automation.',
      nextStepLabel: 'Resources: Get your data in shape',
      nextStepUrl: '/resources',
    })
  }
  if (ar?.team_readiness === 'not_yet' || ar?.team_readiness === 'individual') {
    areas.push({
      id: 'team_readiness',
      label: 'Team readiness',
      reason: 'Getting one champion or a small pilot in place will build confidence and show quick wins.',
      nextStepLabel: 'Resources: Templates and playbooks to get started',
      nextStepUrl: '/resources',
    })
  }
  if ((dm?.approval_process === 'committee' || dm?.approval_process === 'budget_threshold') && getScoreBand(urgency) !== 'high') {
    areas.push({
      id: 'decision_process',
      label: 'Decision process',
      reason: 'Involving stakeholders early and clarifying who can approve what will speed up decisions.',
      nextStepLabel: 'Start a conversation in chat for a tailored plan',
      nextStepUrl: '/',
    })
  }
  if (bt?.timeline === 'exploring' && urgency >= 5) {
    areas.push({
      id: 'timeline',
      label: 'Timeline clarity',
      reason: 'Picking one target date or one “must fix” outcome will help prioritize and move faster.',
      nextStepLabel: 'Resources: Roadmaps and prioritization guides',
      nextStepUrl: '/resources',
    })
  }
  if ((bt?.budget_range === 'none' || bt?.budget_range === 'small') && getScoreBand(opportunity) !== 'low') {
    areas.push({
      id: 'budget',
      label: 'Budget alignment',
      reason: 'Quick wins and templates can show impact without a large budget; we have options to match.',
      nextStepLabel: 'Resources: High-leverage tactics and templates',
      nextStepUrl: '/resources',
    })
  }
  return areas
}

// ---------------------------------------------------------------------------
// Category capture status (What we captured)
// ---------------------------------------------------------------------------

/** Short labels for the 6 audit categories, in `AUDIT_CATEGORY_ORDER`. */
export const STEP_LABELS = [
  'Challenges',
  'Tech stack',
  'Automation',
  'AI readiness',
  'Budget',
  'Decision',
] as const

/** View-model keys for each category (same order as STEP_LABELS / AUDIT_CATEGORY_ORDER). */
export const RESULTS_CATEGORY_KEYS: (keyof AuditReportViewModel)[] = [
  'businessChallenges',
  'techStack',
  'automationNeeds',
  'aiReadiness',
  'budgetTimeline',
  'decisionMaking',
]

/** Returns a boolean[] aligned with STEP_LABELS indicating whether each category has captured answers. */
export function getCategoryCaptureStatus(results: AuditReportViewModel): boolean[] {
  return RESULTS_CATEGORY_KEYS.map((key) => {
    const data = results[key]
    if (data == null || typeof data !== 'object') return false
    return Object.keys(data).length > 0
  })
}

// Re-export the canonical category order so consumers don't need two imports.
export { AUDIT_CATEGORY_ORDER }
