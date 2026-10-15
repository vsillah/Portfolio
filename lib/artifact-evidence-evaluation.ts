export const ARTIFACT_EVALUATION_RECEIPT_VERSION = 'artifact-evaluation-scorecard/v1' as const

export const ARTIFACT_EVALUATION_DIMENSIONS = [
  'outlier_pattern_fit',
  'source_support',
  'core_audience_fit',
  'timeliness',
  'product_work_evidence_fit',
  'originality_repetition_risk',
] as const

export const ARTIFACT_EVALUATION_KINDS = [
  'headline_hook',
  'title_subject',
  'thumbnail',
  'script_message',
  'description',
  'cta',
  'visual_concept',
] as const

export type ArtifactEvaluationDimensionKey = (typeof ARTIFACT_EVALUATION_DIMENSIONS)[number]
export type ArtifactEvaluationKind = (typeof ARTIFACT_EVALUATION_KINDS)[number]
export type ArtifactEvaluationBasis = 'measured' | 'heuristic' | 'model_judgment' | 'unavailable'

export type ArtifactEvaluationReceiptLink = {
  receipt_id: string
  href: string
}

export type ArtifactEvaluationInput = {
  name: string
  value: string
  receipt_id: string
}

export type ArtifactEvaluationDimension = {
  status: 'scored' | 'unscored'
  score: number | null
  basis: ArtifactEvaluationBasis
  direction: 'higher_is_better' | 'lower_is_better'
  weight: number
  threshold: number
  percentile: number | null
  rank: { position: number; total: number } | null
  deterministic_inputs: ArtifactEvaluationInput[]
  source_receipts: ArtifactEvaluationReceiptLink[]
  rationale: string
}

export type ArtifactEvaluationBenchmarkCohort = {
  cohort_id: string | null
  status: 'approved' | 'missing' | 'stale' | 'unapproved'
  sample_size: number | null
  observed_from: string | null
  observed_to: string | null
  fresh_until: string | null
  source_receipts: ArtifactEvaluationReceiptLink[]
}

export type ArtifactEvaluationReceipt = {
  version: typeof ARTIFACT_EVALUATION_RECEIPT_VERSION
  receipt_id: string
  evaluation_kind: ArtifactEvaluationKind
  content_version: string
  evaluated_at: string
  weighting_version: string
  benchmark_cohort: ArtifactEvaluationBenchmarkCohort
  dimensions: Record<ArtifactEvaluationDimensionKey, ArtifactEvaluationDimension>
  overall: {
    score: number | null
    threshold: number
    recommendation: 'advance' | 'revise' | 'hold' | 'unscored'
    confidence_score: number | null
    confidence_label: 'high' | 'medium' | 'low' | 'unscored'
    rationale: string
    source_receipts: ArtifactEvaluationReceiptLink[]
  }
}

export type ArtifactEvaluationValidation = {
  receipt: ArtifactEvaluationReceipt | null
  ready: boolean
  stale: boolean
  blockers: string[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function timestamp(value: unknown): string | null {
  const parsed = Date.parse(text(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function boundedScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}

function safeHref(value: unknown): string {
  const href = text(value)
  return href.startsWith('/admin/') && !href.includes('://') && !href.includes('..') ? href : ''
}

function parseLinks(value: unknown): ArtifactEvaluationReceiptLink[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const candidate = record(entry)
    return candidate ? { receipt_id: text(candidate.receipt_id), href: safeHref(candidate.href) } : null
  }).filter((entry): entry is ArtifactEvaluationReceiptLink => Boolean(entry))
}

function parseInputs(value: unknown): ArtifactEvaluationInput[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const candidate = record(entry)
    return candidate ? { name: text(candidate.name), value: text(candidate.value), receipt_id: text(candidate.receipt_id) } : null
  }).filter((entry): entry is ArtifactEvaluationInput => Boolean(entry))
}

function parseDimension(value: unknown): ArtifactEvaluationDimension | null {
  const candidate = record(value)
  const rank = record(candidate?.rank)
  if (!candidate) return null
  return {
    status: candidate.status === 'scored' ? 'scored' : 'unscored',
    score: boundedScore(candidate.score),
    basis: ['measured', 'heuristic', 'model_judgment', 'unavailable'].includes(text(candidate.basis))
      ? text(candidate.basis) as ArtifactEvaluationBasis
      : 'unavailable',
    direction: candidate.direction === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better',
    weight: Number(candidate.weight),
    threshold: Number(candidate.threshold),
    percentile: candidate.percentile == null ? null : boundedScore(candidate.percentile),
    rank: rank ? { position: Number(rank.position), total: Number(rank.total) } : null,
    deterministic_inputs: parseInputs(candidate.deterministic_inputs),
    source_receipts: parseLinks(candidate.source_receipts),
    rationale: text(candidate.rationale),
  }
}

export function parseArtifactEvaluationReceipt(value: unknown): ArtifactEvaluationReceipt | null {
  const candidate = record(value)
  const rawDimensions = record(candidate?.dimensions)
  const rawCohort = record(candidate?.benchmark_cohort)
  const rawOverall = record(candidate?.overall)
  if (candidate?.version !== ARTIFACT_EVALUATION_RECEIPT_VERSION || !rawDimensions || !rawCohort || !rawOverall) return null

  const evaluationKind = text(candidate.evaluation_kind)
  if (!ARTIFACT_EVALUATION_KINDS.includes(evaluationKind as ArtifactEvaluationKind)) return null
  const dimensions = {} as Record<ArtifactEvaluationDimensionKey, ArtifactEvaluationDimension>
  for (const key of ARTIFACT_EVALUATION_DIMENSIONS) {
    const parsed = parseDimension(rawDimensions[key])
    if (!parsed) return null
    dimensions[key] = parsed
  }

  return {
    version: ARTIFACT_EVALUATION_RECEIPT_VERSION,
    receipt_id: text(candidate.receipt_id),
    evaluation_kind: evaluationKind as ArtifactEvaluationKind,
    content_version: text(candidate.content_version),
    evaluated_at: text(candidate.evaluated_at),
    weighting_version: text(candidate.weighting_version),
    benchmark_cohort: {
      cohort_id: text(rawCohort.cohort_id) || null,
      status: ['approved', 'missing', 'stale', 'unapproved'].includes(text(rawCohort.status))
        ? text(rawCohort.status) as ArtifactEvaluationBenchmarkCohort['status']
        : 'missing',
      sample_size: rawCohort.sample_size == null ? null : Number(rawCohort.sample_size),
      observed_from: text(rawCohort.observed_from) || null,
      observed_to: text(rawCohort.observed_to) || null,
      fresh_until: text(rawCohort.fresh_until) || null,
      source_receipts: parseLinks(rawCohort.source_receipts),
    },
    dimensions,
    overall: {
      score: boundedScore(rawOverall.score),
      threshold: Number(rawOverall.threshold),
      recommendation: ['advance', 'revise', 'hold', 'unscored'].includes(text(rawOverall.recommendation))
        ? text(rawOverall.recommendation) as ArtifactEvaluationReceipt['overall']['recommendation']
        : 'unscored',
      confidence_score: boundedScore(rawOverall.confidence_score),
      confidence_label: ['high', 'medium', 'low', 'unscored'].includes(text(rawOverall.confidence_label))
        ? text(rawOverall.confidence_label) as ArtifactEvaluationReceipt['overall']['confidence_label']
        : 'unscored',
      rationale: text(rawOverall.rationale),
      source_receipts: parseLinks(rawOverall.source_receipts),
    },
  }
}

export function calculateArtifactEvaluationOverall(receipt: Pick<ArtifactEvaluationReceipt, 'dimensions'>): number | null {
  const entries = ARTIFACT_EVALUATION_DIMENSIONS.map((key) => receipt.dimensions[key])
  if (entries.some((dimension) => dimension.status !== 'scored' || dimension.score == null)) return null
  const weightTotal = entries.reduce((total, dimension) => total + dimension.weight, 0)
  if (Math.abs(weightTotal - 100) > 0.001) return null
  const weighted = entries.reduce((total, dimension) => {
    const normalized = dimension.direction === 'lower_is_better' ? 100 - dimension.score! : dimension.score!
    return total + normalized * dimension.weight
  }, 0)
  return Number((weighted / 100).toFixed(2))
}

export function validateArtifactEvaluationReceipt(value: unknown, currentContentVersion: string): ArtifactEvaluationValidation {
  const receipt = parseArtifactEvaluationReceipt(value)
  if (!receipt) return { receipt: null, ready: false, stale: false, blockers: ['The artifact evaluation receipt is missing or malformed.'] }
  const blockers: string[] = []
  const currentVersion = timestamp(currentContentVersion)
  const receiptVersion = timestamp(receipt.content_version)
  const evaluatedAt = timestamp(receipt.evaluated_at)
  const stale = !currentVersion || !receiptVersion || currentVersion !== receiptVersion

  if (!receipt.receipt_id || !receipt.weighting_version || !evaluatedAt) blockers.push('The evaluation receipt identity, weighting version, or evaluation date is missing.')
  if (stale) blockers.push('The artifact evaluation receipt is stale for the current content version.')
  if (!Number.isFinite(receipt.overall.threshold) || receipt.overall.threshold < 0 || receipt.overall.threshold > 100) blockers.push('The overall recommendation threshold must be between 0 and 100.')
  if (!receipt.overall.rationale || receipt.overall.rationale.length > 320) blockers.push('The overall evaluation needs a bounded rationale of 320 characters or fewer.')
  if (!receipt.overall.source_receipts.length || receipt.overall.source_receipts.some((link) => !link.receipt_id || !link.href)) blockers.push('The overall recommendation and rationale need exact safe source-receipt links.')

  let hasUnscoredDimension = false
  let weightTotal = 0
  for (const key of ARTIFACT_EVALUATION_DIMENSIONS) {
    const dimension = receipt.dimensions[key]
    const label = key.replaceAll('_', ' ')
    weightTotal += dimension.weight
    if (!Number.isFinite(dimension.weight) || dimension.weight < 0 || dimension.weight > 100) blockers.push(`${label} has an invalid weight.`)
    if (!Number.isFinite(dimension.threshold) || dimension.threshold < 0 || dimension.threshold > 100) blockers.push(`${label} has an invalid threshold.`)
    if (!dimension.rationale || dimension.rationale.length > 320) blockers.push(`${label} needs a bounded rationale of 320 characters or fewer.`)
    if (!dimension.source_receipts.length || dimension.source_receipts.some((link) => !link.receipt_id || !link.href)) blockers.push(`${label} has no safe source-receipt link for its score or rationale.`)

    if (dimension.status === 'unscored') {
      hasUnscoredDimension = true
      if (dimension.score !== null || dimension.basis !== 'unavailable') blockers.push(`${label} must use Unscored with a null value when evidence is unavailable.`)
      continue
    }

    if (dimension.score == null || dimension.basis === 'unavailable') blockers.push(`${label} is marked scored without a valid 0-100 value and evidence basis.`)
    if (!dimension.deterministic_inputs.length) blockers.push(`${label} has no deterministic calculation inputs.`)
    const linkedReceipts = new Set(dimension.source_receipts.map((link) => link.receipt_id))
    if (dimension.deterministic_inputs.some((input) => !input.name || !input.value || !linkedReceipts.has(input.receipt_id))) {
      blockers.push(`${label} has a calculation input that is not linked to an exact source receipt.`)
    }
    if (dimension.rank && (!Number.isInteger(dimension.rank.position) || !Number.isInteger(dimension.rank.total) || dimension.rank.position < 1 || dimension.rank.total < dimension.rank.position)) {
      blockers.push(`${label} has an invalid benchmark rank.`)
    }
  }
  if (Math.abs(weightTotal - 100) > 0.001) blockers.push('Evaluation dimension weights must total 100.')

  const cohort = receipt.benchmark_cohort
  const freshUntil = timestamp(cohort.fresh_until)
  const cohortCurrent = cohort.status === 'approved'
    && Boolean(cohort.cohort_id)
    && Number.isInteger(cohort.sample_size)
    && Number(cohort.sample_size) > 0
    && Boolean(timestamp(cohort.observed_from))
    && Boolean(timestamp(cohort.observed_to))
    && Boolean(freshUntil && currentVersion && freshUntil >= currentVersion)
    && cohort.source_receipts.length > 0
    && cohort.source_receipts.every((link) => link.receipt_id && link.href)
  const outlier = receipt.dimensions.outlier_pattern_fit
  if (outlier.status === 'scored' && !cohortCurrent) blockers.push('Outlier-pattern fit cannot be scored without a current approved benchmark cohort and safe receipt links.')
  if (!cohortCurrent && outlier.status !== 'unscored') blockers.push('Missing, stale, or unapproved benchmark evidence must remain Unscored.')

  const calculatedOverall = calculateArtifactEvaluationOverall(receipt)
  if (hasUnscoredDimension) {
    blockers.push('The evaluation contains Unscored dimensions and cannot advance until approved evidence is attached.')
    if (receipt.overall.score !== null || receipt.overall.confidence_score !== null || !['hold', 'unscored'].includes(receipt.overall.recommendation) || receipt.overall.confidence_label !== 'unscored') {
      blockers.push('An incomplete scorecard must keep the overall result Unscored and hold advancement.')
    }
  } else if (calculatedOverall == null || receipt.overall.score == null || Math.abs(calculatedOverall - receipt.overall.score) > 0.01) {
    blockers.push('The overall score does not match the versioned weighted calculation.')
  } else {
    if (receipt.overall.confidence_score == null || receipt.overall.confidence_label === 'unscored') blockers.push('A complete scorecard needs a 0-100 overall confidence value and label.')
    if (receipt.overall.score >= receipt.overall.threshold && receipt.overall.recommendation !== 'advance') blockers.push('The overall recommendation does not match the versioned advancement threshold.')
    if (receipt.overall.score < receipt.overall.threshold && !['revise', 'hold'].includes(receipt.overall.recommendation)) blockers.push('The overall recommendation does not match the versioned advancement threshold.')
  }

  return { receipt, ready: blockers.length === 0 && !hasUnscoredDimension, stale, blockers: [...new Set(blockers)] }
}
