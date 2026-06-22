import {
  mobileFoundryScoreFactors,
  type MobileFoundryBacklogRecord,
  type MobileFoundryScoreBreakdown,
} from '@/lib/mobile-app-foundry'

export type MobileFoundrySourcePacket = {
  title: string
  url?: string
  summary?: string
  transcriptStatus?: 'available' | 'pending' | 'unavailable'
  evidence: string[]
}

export type MobileFoundryGitHubInventorySummary = {
  builderPatterns: string[]
  reusableStack?: string[]
  commercializationFit?: string[]
  privateInventoryIncluded?: boolean
}

export type MobileFoundryOpportunityInput = {
  id: string
  title: string
  audience: string
  jobToBeDone: string
  trendSources: string[]
  competitors: string[]
  demandSignals?: string[]
  monetizationSignals?: string[]
  builderFitSignals?: string[]
  buildVelocitySignals?: string[]
  differentiationSignals?: string[]
  releaseReadinessSignals?: string[]
  prototypeScope: string[]
  commercializationPath: string[]
  risks?: string[]
}

export type MobileFoundryAnalystInput = {
  sourcePacket: MobileFoundrySourcePacket
  githubInventorySummary?: MobileFoundryGitHubInventorySummary
  marketEvidence: {
    opportunities: MobileFoundryOpportunityInput[]
  }
  openBrainContext?: {
    approvedPatterns?: string[]
    priorCommercializationNotes?: string[]
  }
}

export type MobileFoundryAnalystResult = {
  generated_at: string
  mode: 'read_only'
  source_packet: {
    title: string
    url: string | null
    transcript_status: MobileFoundrySourcePacket['transcriptStatus']
    evidence_count: number
  }
  scoring_weights: Record<keyof MobileFoundryScoreBreakdown, number>
  backlog: MobileFoundryBacklogRecord[]
  safety_boundary: {
    creates_work_items: false
    creates_repositories: false
    creates_github_accounts: false
    sends_outbound_messages: false
    submits_to_app_stores: false
    changes_prices: false
  }
  warnings: string[]
}

const SCORE_WEIGHTS: Record<keyof MobileFoundryScoreBreakdown, number> = {
  demand_signal: 25,
  monetization_path: 20,
  builder_fit: 20,
  build_velocity: 15,
  differentiation: 10,
  release_readiness: 10,
}

const FACTOR_CAPS: Record<keyof MobileFoundryScoreBreakdown, number> = {
  demand_signal: 4,
  monetization_path: 3,
  builder_fit: 4,
  build_velocity: 3,
  differentiation: 2,
  release_readiness: 3,
}

export function analyzeMobileAppFoundryBacklog(
  input: MobileFoundryAnalystInput,
  generatedAt = new Date().toISOString()
): MobileFoundryAnalystResult {
  validateAnalystInput(input)

  const sourceEvidenceMissing = input.sourcePacket.evidence.length === 0
  const builderPatterns = [
    ...(input.githubInventorySummary?.builderPatterns ?? []),
    ...(input.openBrainContext?.approvedPatterns ?? []),
  ]

  const backlog = input.marketEvidence.opportunities
    .map((opportunity) => toBacklogRecord(opportunity, builderPatterns, sourceEvidenceMissing))
    .sort((a, b) => b.popularity_score - a.popularity_score || a.title.localeCompare(b.title))

  return {
    generated_at: generatedAt,
    mode: 'read_only',
    source_packet: {
      title: input.sourcePacket.title,
      url: input.sourcePacket.url ?? null,
      transcript_status: input.sourcePacket.transcriptStatus ?? 'pending',
      evidence_count: input.sourcePacket.evidence.length,
    },
    scoring_weights: weightsFromContract(),
    backlog,
    safety_boundary: {
      creates_work_items: false,
      creates_repositories: false,
      creates_github_accounts: false,
      sends_outbound_messages: false,
      submits_to_app_stores: false,
      changes_prices: false,
    },
    warnings: sourceEvidenceMissing
      ? ['Source packet has no evidence lines. Backlog records are flagged for human review before any scoring should be trusted.']
      : [],
  }
}

function validateAnalystInput(input: MobileFoundryAnalystInput) {
  if (!input.sourcePacket?.title?.trim()) throw new Error('sourcePacket.title is required')
  if (!Array.isArray(input.sourcePacket.evidence)) throw new Error('sourcePacket.evidence must be an array')
  if (!Array.isArray(input.marketEvidence?.opportunities)) throw new Error('marketEvidence.opportunities must be an array')
}

function toBacklogRecord(
  opportunity: MobileFoundryOpportunityInput,
  builderPatterns: string[],
  sourceEvidenceMissing: boolean
): MobileFoundryBacklogRecord {
  const score_breakdown = scoreOpportunity(opportunity, builderPatterns)
  const popularity_score = Object.values(score_breakdown).reduce((sum, score) => sum + score, 0)
  const risks = [...(opportunity.risks ?? [])]

  if (sourceEvidenceMissing) {
    risks.unshift('Missing source-packet evidence; keep this record in review before prototype planning.')
  }
  if (opportunity.trendSources.length === 0) {
    risks.unshift('No trend sources supplied for this opportunity.')
  }

  return {
    id: normalizeId(opportunity.id || opportunity.title),
    title: opportunity.title,
    audience: opportunity.audience,
    job_to_be_done: opportunity.jobToBeDone,
    trend_sources: dedupeClean(opportunity.trendSources),
    competitors: dedupeClean(opportunity.competitors),
    popularity_score,
    score_breakdown,
    vambah_fit_summary: buildFitSummary(opportunity, builderPatterns),
    prototype_scope: dedupeClean(opportunity.prototypeScope),
    commercialization_path: dedupeClean(opportunity.commercializationPath),
    risks: dedupeClean(risks),
    human_gate: 'review_required',
  }
}

function scoreOpportunity(
  opportunity: MobileFoundryOpportunityInput,
  builderPatterns: string[]
): MobileFoundryScoreBreakdown {
  const matchedBuilderPatterns = matchBuilderPatterns(opportunity, builderPatterns)
  return {
    demand_signal: weightedScore(
      opportunity.trendSources.length + (opportunity.demandSignals?.length ?? 0),
      'demand_signal'
    ),
    monetization_path: weightedScore(opportunity.monetizationSignals?.length ?? 0, 'monetization_path'),
    builder_fit: weightedScore(
      (opportunity.builderFitSignals?.length ?? 0) + matchedBuilderPatterns.length,
      'builder_fit'
    ),
    build_velocity: weightedScore(opportunity.buildVelocitySignals?.length ?? 0, 'build_velocity'),
    differentiation: weightedScore(opportunity.differentiationSignals?.length ?? 0, 'differentiation'),
    release_readiness: weightedScore(opportunity.releaseReadinessSignals?.length ?? 0, 'release_readiness'),
  }
}

function weightedScore(signalCount: number, factor: keyof MobileFoundryScoreBreakdown): number {
  const ratio = Math.min(Math.max(signalCount, 0) / FACTOR_CAPS[factor], 1)
  return Math.round(SCORE_WEIGHTS[factor] * ratio)
}

function matchBuilderPatterns(opportunity: MobileFoundryOpportunityInput, patterns: string[]): string[] {
  const haystack = [
    opportunity.title,
    opportunity.audience,
    opportunity.jobToBeDone,
    ...(opportunity.builderFitSignals ?? []),
    ...opportunity.prototypeScope,
    ...opportunity.commercializationPath,
  ]
    .join(' ')
    .toLowerCase()

  return dedupeClean(patterns).filter((pattern) => haystack.includes(pattern.toLowerCase()))
}

function buildFitSummary(opportunity: MobileFoundryOpportunityInput, builderPatterns: string[]): string {
  const matches = matchBuilderPatterns(opportunity, builderPatterns)
  if (matches.length > 0) {
    return `Matches approved builder patterns: ${matches.slice(0, 3).join(', ')}.`
  }
  if ((opportunity.builderFitSignals?.length ?? 0) > 0) {
    return `Fits supplied builder signals: ${opportunity.builderFitSignals?.slice(0, 3).join(', ')}.`
  }
  return 'No strong builder-fit pattern supplied yet; keep this in research before prototype planning.'
}

function weightsFromContract(): Record<keyof MobileFoundryScoreBreakdown, number> {
  const fallback = { ...SCORE_WEIGHTS }

  for (const factor of mobileFoundryScoreFactors) {
    if (factor.label === 'Demand signal') fallback.demand_signal = factor.weight
    if (factor.label === 'Monetization path') fallback.monetization_path = factor.weight
    if (factor.label === 'Builder fit') fallback.builder_fit = factor.weight
    if (factor.label === 'Build velocity') fallback.build_velocity = factor.weight
    if (factor.label === 'Differentiation') fallback.differentiation = factor.weight
    if (factor.label === 'Release readiness') fallback.release_readiness = factor.weight
  }

  return fallback
}

function normalizeId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'mobile-app-opportunity'
}

function dedupeClean(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}
