export const OUTLIER_EVIDENCE_MODEL_VERSION = 'outlier-evidence-calibration-v1' as const

export const OUTLIER_EVIDENCE_DIMENSIONS = [
  'headline',
  'title',
  'thumbnail',
  'script',
  'description',
  'cta',
  'audience_fit',
  'timeliness',
  'product_evidence',
  'originality_risk',
] as const

export type OutlierEvidenceDimension = (typeof OUTLIER_EVIDENCE_DIMENSIONS)[number]

export const OUTLIER_EVIDENCE_LABELS: Record<OutlierEvidenceDimension, string> = {
  headline: 'Headline',
  title: 'Title',
  thumbnail: 'Thumbnail',
  script: 'Script',
  description: 'Description',
  cta: 'CTA',
  audience_fit: 'Audience fit',
  timeliness: 'Timeliness',
  product_evidence: 'Product evidence',
  originality_risk: 'Originality risk control',
}

export type OutlierEvidenceStatus = 'scored' | 'unscored'
export type OutlierEvidenceAuthorization = 'attributable' | 'missing' | 'unauthorized'
export type AudienceSizeBand = 'micro' | 'emerging' | 'established' | 'large'

export type OutlierEvidenceSignals = Partial<Record<OutlierEvidenceDimension, number | null>>

export type OutlierEvidenceCandidate = {
  content_id: string
  channel: string
  format: string
  audience_size: number
  evaluated_at: string
  signals: OutlierEvidenceSignals
}

export type OutlierEvidenceComparable = {
  id: string
  source_label: string
  source_url: string
  channel: string
  format: string
  audience_size: number
  published_at: string
  observed_at: string
  evidence_status: OutlierEvidenceAuthorization
  signals: OutlierEvidenceSignals
}

export type OutlierEvidenceCalibrationInput = {
  model_version: typeof OUTLIER_EVIDENCE_MODEL_VERSION
  candidate: OutlierEvidenceCandidate
  cohort: OutlierEvidenceComparable[]
  minimum_sample_size?: number
  freshness_days?: number
}

export type OutlierEvidenceDimensionEvaluation = {
  dimension: OutlierEvidenceDimension
  label: string
  status: OutlierEvidenceStatus
  score: number | null
  candidate_value: number | null
  cohort_median: number | null
  sample_size: number
  formula: string
  reason: string | null
  source_ids: string[]
}

export type OutlierEvidenceExcludedComparable = {
  id: string
  source_label: string
  reason: string
}

export type OutlierEvidenceEvaluation = {
  model_version: typeof OUTLIER_EVIDENCE_MODEL_VERSION
  status: OutlierEvidenceStatus
  overall_score: number | null
  input_fingerprint: string
  evaluated_at: string
  normalization: {
    channel: string
    format: string
    audience_band: AudienceSizeBand
    freshness_days: number
    minimum_sample_size: number
  }
  dimensions: OutlierEvidenceDimensionEvaluation[]
  included_sources: OutlierEvidenceComparable[]
  excluded_sources: OutlierEvidenceExcludedComparable[]
  blockers: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boundedSignal(value: unknown): number | null {
  const number = finiteNumber(value)
  if (number === null || number < 0 || number > 100) return null
  return number
}

function parsedTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasAttributableUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function audienceSizeBand(size: number): AudienceSizeBand {
  if (size < 10_000) return 'micro'
  if (size < 100_000) return 'emerging'
  if (size < 1_000_000) return 'established'
  return 'large'
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Number(((sorted[midpoint - 1] + sorted[midpoint]) / 2).toFixed(1))
    : sorted[midpoint]
}

function percentileRank(candidate: number, cohort: number[]) {
  const lower = cohort.filter((value) => value < candidate).length
  const equal = cohort.filter((value) => value === candidate).length
  return Math.round(((lower + (equal * 0.5)) / cohort.length) * 100)
}

function invalidEvaluation(reason: string): OutlierEvidenceEvaluation {
  return {
    model_version: OUTLIER_EVIDENCE_MODEL_VERSION,
    status: 'unscored',
    overall_score: null,
    input_fingerprint: fnv1a(reason),
    evaluated_at: '',
    normalization: {
      channel: 'unknown',
      format: 'unknown',
      audience_band: 'micro',
      freshness_days: 90,
      minimum_sample_size: 3,
    },
    dimensions: OUTLIER_EVIDENCE_DIMENSIONS.map((dimension) => ({
      dimension,
      label: OUTLIER_EVIDENCE_LABELS[dimension],
      status: 'unscored',
      score: null,
      candidate_value: null,
      cohort_median: null,
      sample_size: 0,
      formula: 'Percentile rank = (lower cohort values + 0.5 x equal values) / comparable sample x 100.',
      reason,
      source_ids: [],
    })),
    included_sources: [],
    excluded_sources: [],
    blockers: [reason],
  }
}

export function evaluateOutlierEvidenceCalibration(value: unknown): OutlierEvidenceEvaluation {
  if (!isRecord(value)) return invalidEvaluation('No attributable calibration packet is attached.')
  if (value.model_version !== OUTLIER_EVIDENCE_MODEL_VERSION) {
    return invalidEvaluation('The calibration packet version is missing or unsupported.')
  }
  if (!isRecord(value.candidate) || !Array.isArray(value.cohort)) {
    return invalidEvaluation('Candidate or comparable cohort inputs are missing.')
  }

  const candidate = value.candidate as OutlierEvidenceCandidate
  const cohort = value.cohort.filter(isRecord) as OutlierEvidenceComparable[]
  const minimumSampleSize = Math.max(2, Math.floor(finiteNumber(value.minimum_sample_size) ?? 3))
  const freshnessDays = Math.max(1, Math.floor(finiteNumber(value.freshness_days) ?? 90))
  const evaluatedAt = parsedTime(candidate.evaluated_at)
  const candidateAudienceSize = finiteNumber(candidate.audience_size)
  if (
    evaluatedAt === null
    || candidateAudienceSize === null
    || candidateAudienceSize < 0
    || typeof candidate.channel !== 'string'
    || !candidate.channel.trim()
    || typeof candidate.format !== 'string'
    || !candidate.format.trim()
    || !isRecord(candidate.signals)
  ) {
    return invalidEvaluation('Candidate normalization inputs are missing or invalid.')
  }

  const targetAudienceBand = audienceSizeBand(candidateAudienceSize)
  const includedSources: OutlierEvidenceComparable[] = []
  const excludedSources: OutlierEvidenceExcludedComparable[] = []
  const maximumAgeMs = freshnessDays * 86_400_000

  for (const comparable of [...cohort].sort((left, right) => left.id.localeCompare(right.id))) {
    let reason = ''
    const observedAt = parsedTime(comparable.observed_at)
    const publishedAt = parsedTime(comparable.published_at)
    const audienceSize = finiteNumber(comparable.audience_size)
    if (comparable.evidence_status !== 'attributable' || !hasAttributableUrl(comparable.source_url)) {
      reason = comparable.evidence_status === 'unauthorized'
        ? 'Source evidence is unauthorized.'
        : 'Source attribution is missing.'
    } else if (comparable.channel !== candidate.channel) {
      reason = 'Channel does not match the candidate.'
    } else if (comparable.format !== candidate.format) {
      reason = 'Format does not match the candidate.'
    } else if (audienceSize === null || audienceSize < 0 || audienceSizeBand(audienceSize) !== targetAudienceBand) {
      reason = 'Audience-size band does not match the candidate.'
    } else if (
      observedAt === null
      || publishedAt === null
      || observedAt > evaluatedAt
      || publishedAt > evaluatedAt
      || evaluatedAt - observedAt > maximumAgeMs
      || evaluatedAt - publishedAt > maximumAgeMs
    ) {
      reason = `Evidence is stale or outside the ${freshnessDays}-day recency window.`
    } else if (!isRecord(comparable.signals)) {
      reason = 'Comparable evaluation inputs are missing.'
    }

    if (reason) excludedSources.push({ id: comparable.id, source_label: comparable.source_label, reason })
    else includedSources.push(comparable)
  }

  const formula = 'Percentile rank = (lower cohort values + 0.5 x equal values) / comparable sample x 100.'
  const dimensions = OUTLIER_EVIDENCE_DIMENSIONS.map((dimension): OutlierEvidenceDimensionEvaluation => {
    const candidateValue = boundedSignal(candidate.signals[dimension])
    const comparableValues = includedSources
      .map((source) => ({ id: source.id, value: boundedSignal(source.signals[dimension]) }))
      .filter((entry): entry is { id: string; value: number } => entry.value !== null)

    if (candidateValue === null) {
      return {
        dimension,
        label: OUTLIER_EVIDENCE_LABELS[dimension],
        status: 'unscored',
        score: null,
        candidate_value: null,
        cohort_median: median(comparableValues.map((entry) => entry.value)),
        sample_size: comparableValues.length,
        formula,
        reason: 'Candidate evidence is missing, so this dimension fails closed.',
        source_ids: comparableValues.map((entry) => entry.id),
      }
    }
    if (comparableValues.length < minimumSampleSize) {
      return {
        dimension,
        label: OUTLIER_EVIDENCE_LABELS[dimension],
        status: 'unscored',
        score: null,
        candidate_value: candidateValue,
        cohort_median: median(comparableValues.map((entry) => entry.value)),
        sample_size: comparableValues.length,
        formula,
        reason: `Only ${comparableValues.length} attributable, fresh comparable(s) are available; ${minimumSampleSize} are required.`,
        source_ids: comparableValues.map((entry) => entry.id),
      }
    }

    const values = comparableValues.map((entry) => entry.value)
    return {
      dimension,
      label: OUTLIER_EVIDENCE_LABELS[dimension],
      status: 'scored',
      score: percentileRank(candidateValue, values),
      candidate_value: candidateValue,
      cohort_median: median(values),
      sample_size: values.length,
      formula,
      reason: null,
      source_ids: comparableValues.map((entry) => entry.id),
    }
  })

  const blockers = dimensions
    .filter((dimension) => dimension.status === 'unscored')
    .map((dimension) => `${dimension.label}: ${dimension.reason}`)
  const scoredValues = dimensions.flatMap((dimension) => dimension.score === null ? [] : [dimension.score])
  const status: OutlierEvidenceStatus = blockers.length === 0 ? 'scored' : 'unscored'

  return {
    model_version: OUTLIER_EVIDENCE_MODEL_VERSION,
    status,
    overall_score: status === 'scored'
      ? Math.round(scoredValues.reduce((total, score) => total + score, 0) / scoredValues.length)
      : null,
    input_fingerprint: fnv1a(stableValue({
      model_version: value.model_version,
      candidate,
      cohort: [...cohort].sort((left, right) => left.id.localeCompare(right.id)),
      minimum_sample_size: minimumSampleSize,
      freshness_days: freshnessDays,
    })),
    evaluated_at: candidate.evaluated_at,
    normalization: {
      channel: candidate.channel,
      format: candidate.format,
      audience_band: targetAudienceBand,
      freshness_days: freshnessDays,
      minimum_sample_size: minimumSampleSize,
    },
    dimensions,
    included_sources: includedSources,
    excluded_sources: excludedSources,
    blockers,
  }
}

const READY_SIGNALS: Record<OutlierEvidenceDimension, number> = {
  headline: 84,
  title: 81,
  thumbnail: 72,
  script: 88,
  description: 78,
  cta: 86,
  audience_fit: 91,
  timeliness: 83,
  product_evidence: 94,
  originality_risk: 89,
}

export function outlierEvidenceCalibrationQaFixture(
  state: 'ready' | 'missing' | 'stale' | 'unauthorized' = 'ready',
): OutlierEvidenceCalibrationInput {
  const observedAt = state === 'stale' ? '2025-10-01T12:00:00.000Z' : '2026-10-12T12:00:00.000Z'
  const cohort = [
    { id: 'cohort-1', label: 'Operator proof breakdown', audience: 24_000, offset: -12 },
    { id: 'cohort-2', label: 'Evidence-first launch review', audience: 38_000, offset: -4 },
    { id: 'cohort-3', label: 'Human gate field note', audience: 61_000, offset: 5 },
    { id: 'cohort-4', label: 'Decision receipt walkthrough', audience: 82_000, offset: 11 },
  ].map((entry, index): OutlierEvidenceComparable => ({
    id: entry.id,
    source_label: entry.label,
    source_url: `https://example.com/public-evidence/${entry.id}`,
    channel: 'linkedin',
    format: 'single_image',
    audience_size: entry.audience,
    published_at: observedAt,
    observed_at: observedAt,
    evidence_status: state === 'unauthorized' ? 'unauthorized' : 'attributable',
    signals: Object.fromEntries(OUTLIER_EVIDENCE_DIMENSIONS.map((dimension, dimensionIndex) => [
      dimension,
      Math.max(0, Math.min(100, 70 + entry.offset + (dimensionIndex % 4))),
    ])) as Record<OutlierEvidenceDimension, number>,
  }))

  return {
    model_version: OUTLIER_EVIDENCE_MODEL_VERSION,
    candidate: {
      content_id: 'social-outlier-evidence-qa',
      channel: 'linkedin',
      format: 'single_image',
      audience_size: 42_000,
      evaluated_at: '2026-10-15T12:00:00.000Z',
      signals: state === 'missing' ? { ...READY_SIGNALS, product_evidence: null } : READY_SIGNALS,
    },
    cohort,
    minimum_sample_size: 3,
    freshness_days: 90,
  }
}
