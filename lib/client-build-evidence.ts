import { supabaseAdmin } from './supabase'

type JsonRecord = Record<string, unknown>

export interface BuildEvidenceRepoMetrics {
  repoLabel: string
  publicRepoUrl: string | null
  capturedAt: string | null
  allBranchCommitCount: number
  headCommitCount: number
  trackedFiles: number
  trackedCodeDocConfigFiles: number
  trackedTextLines: number
  filesChanged: number
  insertions: number
  deletions: number
  releasePassCount: number
  releasePendingCount: number
  releasePendingGate: string | null
  workflow: string[]
}

export interface BuildEvidenceTokenUsage {
  attributionMethod: string
  confidenceLabel: string
  comparisonWindowLabel: string
  sessionCount: number
  totalTokens: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  shareOfComparisonWindowPct: number
  modelProvider: string | null
  model: string | null
  planType: string | null
}

export interface BuildEvidenceCostSummary {
  pricingCapturedAt: string | null
  pricingSourceLabel: string
  pricingAssumption: string
  apiEquivalentCostUsd: number | null
  subscriptionMonthlyCostUsd: number | null
  subscriptionAllocatedCostUsd: number | null
  subscriptionSharePct: number | null
}

export interface BuildEvidenceHourlyTranslation {
  defaultBenchmarkHourlyRate: number
  defaultProposalAmount: number
  focusedHoursLow: number
  focusedHoursHigh: number
  notes: string
}

export interface BuildEvidenceSourceConfidence {
  label: string
  confidence: 'high' | 'medium' | 'low'
  sourceSummary: string
  excludedSources: string[]
}

export interface ClientBuildEvidence {
  id: string
  projectLabel: string
  capturedAt: string
  repoMetrics: BuildEvidenceRepoMetrics
  tokenUsage: BuildEvidenceTokenUsage
  costSummary: BuildEvidenceCostSummary
  hourlyTranslation: BuildEvidenceHourlyTranslation
  sourceConfidence: BuildEvidenceSourceConfidence
  clientSafeNotes: string[]
}

interface BuildEvidenceRow {
  id: string
  project_label: string
  captured_at: string
  repo_metrics: JsonRecord | null
  token_usage: JsonRecord | null
  cost_summary: JsonRecord | null
  hourly_translation: JsonRecord | null
  source_confidence: JsonRecord | null
  client_safe_notes: unknown
}

const DEFAULT_REPO_METRICS: BuildEvidenceRepoMetrics = {
  repoLabel: '',
  publicRepoUrl: null,
  capturedAt: null,
  allBranchCommitCount: 0,
  headCommitCount: 0,
  trackedFiles: 0,
  trackedCodeDocConfigFiles: 0,
  trackedTextLines: 0,
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
  releasePassCount: 0,
  releasePendingCount: 0,
  releasePendingGate: null,
  workflow: [],
}

const DEFAULT_TOKEN_USAGE: BuildEvidenceTokenUsage = {
  attributionMethod: 'strict_workspace_cwd',
  confidenceLabel: 'Direct workspace evidence',
  comparisonWindowLabel: '',
  sessionCount: 0,
  totalTokens: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  shareOfComparisonWindowPct: 0,
  modelProvider: null,
  model: null,
  planType: null,
}

const DEFAULT_COST_SUMMARY: BuildEvidenceCostSummary = {
  pricingCapturedAt: null,
  pricingSourceLabel: 'No provider pricing snapshot recorded',
  pricingAssumption: 'Token counts are observed. Dollar cost requires an admin-entered pricing or subscription snapshot.',
  apiEquivalentCostUsd: null,
  subscriptionMonthlyCostUsd: null,
  subscriptionAllocatedCostUsd: null,
  subscriptionSharePct: null,
}

const DEFAULT_HOURLY_TRANSLATION: BuildEvidenceHourlyTranslation = {
  defaultBenchmarkHourlyRate: 175,
  defaultProposalAmount: 30000,
  focusedHoursLow: 300,
  focusedHoursHigh: 475,
  notes: 'Scenario estimate, not a time sheet.',
}

const DEFAULT_SOURCE_CONFIDENCE: BuildEvidenceSourceConfidence = {
  label: 'Direct workspace evidence',
  confidence: 'high',
  sourceSummary: 'Strict attribution uses Codex sessions started from the tracked workspace.',
  excludedSources: [],
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function clientSafeStringArray(value: unknown): string[] {
  return stringArray(value).filter((item) => !item.includes('/Users/') && !item.includes('local-private'))
}

export function sanitizeBuildEvidenceRow(row: BuildEvidenceRow): ClientBuildEvidence {
  const repo = asRecord(row.repo_metrics)
  const token = asRecord(row.token_usage)
  const cost = asRecord(row.cost_summary)
  const hourly = asRecord(row.hourly_translation)
  const confidence = asRecord(row.source_confidence)

  return {
    id: row.id,
    projectLabel: row.project_label,
    capturedAt: row.captured_at,
    repoMetrics: {
      ...DEFAULT_REPO_METRICS,
      repoLabel: stringValue(repo.repoLabel, DEFAULT_REPO_METRICS.repoLabel),
      publicRepoUrl: nullableString(repo.publicRepoUrl),
      capturedAt: nullableString(repo.capturedAt),
      allBranchCommitCount: numberValue(repo.allBranchCommitCount, 0),
      headCommitCount: numberValue(repo.headCommitCount, 0),
      trackedFiles: numberValue(repo.trackedFiles, 0),
      trackedCodeDocConfigFiles: numberValue(repo.trackedCodeDocConfigFiles, 0),
      trackedTextLines: numberValue(repo.trackedTextLines, 0),
      filesChanged: numberValue(repo.filesChanged, 0),
      insertions: numberValue(repo.insertions, 0),
      deletions: numberValue(repo.deletions, 0),
      releasePassCount: numberValue(repo.releasePassCount, 0),
      releasePendingCount: numberValue(repo.releasePendingCount, 0),
      releasePendingGate: nullableString(repo.releasePendingGate),
      workflow: stringArray(repo.workflow),
    },
    tokenUsage: {
      ...DEFAULT_TOKEN_USAGE,
      attributionMethod: stringValue(token.attributionMethod, DEFAULT_TOKEN_USAGE.attributionMethod),
      confidenceLabel: stringValue(token.confidenceLabel, DEFAULT_TOKEN_USAGE.confidenceLabel),
      comparisonWindowLabel: stringValue(token.comparisonWindowLabel, DEFAULT_TOKEN_USAGE.comparisonWindowLabel),
      sessionCount: numberValue(token.sessionCount, 0),
      totalTokens: numberValue(token.totalTokens, 0),
      inputTokens: numberValue(token.inputTokens, 0),
      cachedInputTokens: numberValue(token.cachedInputTokens, 0),
      outputTokens: numberValue(token.outputTokens, 0),
      reasoningTokens: numberValue(token.reasoningTokens, 0),
      shareOfComparisonWindowPct: numberValue(token.shareOfComparisonWindowPct, 0),
      modelProvider: nullableString(token.modelProvider),
      model: nullableString(token.model),
      planType: nullableString(token.planType),
    },
    costSummary: {
      ...DEFAULT_COST_SUMMARY,
      pricingCapturedAt: nullableString(cost.pricingCapturedAt),
      pricingSourceLabel: stringValue(cost.pricingSourceLabel, DEFAULT_COST_SUMMARY.pricingSourceLabel),
      pricingAssumption: stringValue(cost.pricingAssumption, DEFAULT_COST_SUMMARY.pricingAssumption),
      apiEquivalentCostUsd: nullableNumber(cost.apiEquivalentCostUsd),
      subscriptionMonthlyCostUsd: nullableNumber(cost.subscriptionMonthlyCostUsd),
      subscriptionAllocatedCostUsd: nullableNumber(cost.subscriptionAllocatedCostUsd),
      subscriptionSharePct: nullableNumber(cost.subscriptionSharePct),
    },
    hourlyTranslation: {
      ...DEFAULT_HOURLY_TRANSLATION,
      defaultBenchmarkHourlyRate: numberValue(hourly.defaultBenchmarkHourlyRate, DEFAULT_HOURLY_TRANSLATION.defaultBenchmarkHourlyRate),
      defaultProposalAmount: numberValue(hourly.defaultProposalAmount, DEFAULT_HOURLY_TRANSLATION.defaultProposalAmount),
      focusedHoursLow: numberValue(hourly.focusedHoursLow, DEFAULT_HOURLY_TRANSLATION.focusedHoursLow),
      focusedHoursHigh: numberValue(hourly.focusedHoursHigh, DEFAULT_HOURLY_TRANSLATION.focusedHoursHigh),
      notes: stringValue(hourly.notes, DEFAULT_HOURLY_TRANSLATION.notes),
    },
    sourceConfidence: {
      ...DEFAULT_SOURCE_CONFIDENCE,
      label: stringValue(confidence.label, DEFAULT_SOURCE_CONFIDENCE.label),
      confidence: confidence.confidence === 'medium' || confidence.confidence === 'low' ? confidence.confidence : 'high',
      sourceSummary: stringValue(confidence.sourceSummary, DEFAULT_SOURCE_CONFIDENCE.sourceSummary),
      excludedSources: clientSafeStringArray(confidence.excludedSources),
    },
    clientSafeNotes: clientSafeStringArray(row.client_safe_notes),
  }
}

export async function getBuildEvidenceForClientProject(
  clientProjectId: string
): Promise<ClientBuildEvidence | null> {
  const { data, error } = await supabaseAdmin
    .from('client_project_build_evidence')
    .select('id, project_label, captured_at, repo_metrics, token_usage, cost_summary, hourly_translation, source_confidence, client_safe_notes')
    .eq('client_project_id', clientProjectId)
    .eq('is_client_visible', true)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Error fetching client build evidence:', error)
    return null
  }

  return sanitizeBuildEvidenceRow(data as BuildEvidenceRow)
}
