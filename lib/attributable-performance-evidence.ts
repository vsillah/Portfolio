import { createHash } from 'node:crypto'

/** Internal, read-only evidence contract. No collector or external executor is exported. */
export const ATTRIBUTABLE_PERFORMANCE_VERSION = 'attributable-performance-v1' as const
export const MINIMUM_MATCHED_COMPARABLES = 5
export const OUTLIER_SCORE_THRESHOLD = 75

export const PLATFORM_FORMATS = {
  linkedin: ['text', 'image', 'document', 'video'],
  youtube: ['long_form', 'shorts', 'live'],
  x: ['single_post', 'thread', 'image', 'video'],
  instagram: ['feed', 'carousel', 'reel'],
  facebook: ['text', 'link', 'image', 'reel', 'video'],
} as const

export type Platform = keyof typeof PLATFORM_FORMATS
export type Format<P extends Platform = Platform> = (typeof PLATFORM_FORMATS)[P][number]
export type SourceClass = 'owned_first_party' | 'external_creator'
export type EvidenceUse = 'performance' | 'structural_topic_context'
export type EvidenceStatus = 'Scored' | 'Unscored'

export type SourceClassPolicy = {
  source_class: SourceClass
  policy_id: string
  policy_version: string
  evidence_version: string
  platform: Platform
  format: string
  object_id: string
  observation_id: string
  raw_response_sha256: string
  approved: boolean
  expiry_basis: 'approved_source_class_policy'
  issued_at: string
  /** This timestamp must be issued by the approved, version-bound policy. */
  expires_at: string
  approval: { receipt_id: string; authority_id: string; authority_version: string; policy_sha256: string }
}

export type RawPlatformObservation = {
  platform: Platform
  format: string
  object_id: string
  object_url: string
  account_id: string
  baseline_id: string
  baseline_version: string
  evidence_version: string
  source_policy_version: string
  observation_grade: 'directional' | 'decision'
  account_url: string
  published_at: string
  observed_at: string
  observation_window: { start: string; end: string }
  raw_response: unknown
  raw_response_sha256: string
  metric: { name: string; value: number; denominator_name: string; denominator: number }
  audience: { subscribers_or_followers: number; observed_at: string }
  cohort_id: string
  collector_version: string
  scoring_version: typeof ATTRIBUTABLE_PERFORMANCE_VERSION
  source_class: SourceClass
  source_url: string
  provenance: { record_id: string; captured_at: string; method: string }
  rights: { privacy_cleared: boolean; rights_cleared: boolean; rights_basis: string }
  policy: SourceClassPolicy
  rollback: { historical_record_id: string; supersedes_record_id: string | null; procedure: string }
}

export type PerformanceObservation = Omit<RawPlatformObservation, 'raw_response'> & {
  platform: Platform
  format: string
  raw_response_sha256: string
  evidence_use: EvidenceUse
  performance_weight: 0 | 1
}

export type Baseline = {
  baseline_id: string
  baseline_version: string
  platform: Platform
  format: string
  account_id: string
  metric_name: string
  denominator_name: string
  metric_value: number
  denominator: number
  audience: number
  observed_at: string
  source_record_id: string
  contributions: Array<{ record_id: string; raw_response_sha256: string; account_id: string; platform: Platform; format: string; metric_name: string; denominator_name: string; metric_value: number; denominator: number }>
  input_sha256: string
  computation_method: 'aggregate_rate'
  computation_version: string
  computed_at: string
  receipt_sha256: string
}

export type ExcludedComparable = { record_id: string; reason: string }
export type PerformanceReceipt = {
  contract_version: typeof ATTRIBUTABLE_PERFORMANCE_VERSION
  status: EvidenceStatus
  score: number | null
  outlier_score: number | null
  outlier_threshold: typeof OUTLIER_SCORE_THRESHOLD
  outlier_verdict: 'pass' | 'below_threshold' | 'unscored'
  receipt_sha256: string
  relative_performance: number | null
  baseline_id: string | null
  cohort_id: string | null
  included_record_ids: string[]
  excluded: ExcludedComparable[]
  blockers: string[]
  /** Historical observations remain available even when current eligibility changes. */
  historical_record_ids: string[]
  evaluated_at: string
  handoff: 'internal_human_qa_preparation_only' | 'none'
  external_actions_enabled: false
}

const HOSTS: Record<Platform, readonly string[]> = {
  linkedin: ['linkedin.com', 'www.linkedin.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'],
}
const SOURCE_HOSTS: Record<Platform, readonly string[]> = {
  linkedin: [...HOSTS.linkedin, 'api.linkedin.com'],
  youtube: [...HOSTS.youtube, 'www.googleapis.com', 'youtubeanalytics.googleapis.com'],
  x: [...HOSTS.x, 'api.x.com', 'api.twitter.com'],
  instagram: [...HOSTS.instagram, 'graph.instagram.com', 'graph.facebook.com'],
  facebook: [...HOSTS.facebook, 'graph.facebook.com'],
}

/** Existing cross-channel backlog declares a seven-day decision review. Keep
 * format keys separate so a later approved policy can version each boundary. */
export const DECISION_WINDOW_DAYS: Record<Platform, Record<string, number>> = {
  linkedin: { text: 7, image: 7, document: 7, video: 7 },
  youtube: { long_form: 7, shorts: 7, live: 7 },
  x: { single_post: 7, thread: 7, image: 7, video: 7 },
  instagram: { feed: 7, carousel: 7, reel: 7 },
  facebook: { text: 7, link: 7, image: 7, reel: 7, video: 7 },
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(',')}}`
  }
  const encoded = JSON.stringify(value)
  return encoded === undefined ? 'null' : encoded
}

export function rawResponseSha256(raw: unknown): string {
  return createHash('sha256').update(stable(raw)).digest('hex')
}

export function policyApprovalSha256(policy: SourceClassPolicy): string {
  const { policy_sha256: _digest, ...approval } = policy.approval
  return createHash('sha256').update(stable({ ...policy, approval })).digest('hex')
}

export function baselineInputSha256(baseline: Baseline): string {
  return createHash('sha256').update(stable(baseline.contributions)).digest('hex')
}

export function baselineReceiptSha256(baseline: Baseline): string {
  const { receipt_sha256: _receipt, ...bound } = baseline
  return createHash('sha256').update(stable(bound)).digest('hex')
}

function time(value: string): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : null
}

function positive(value: number): boolean { return Number.isFinite(value) && value > 0 }
function nonnegative(value: number): boolean { return Number.isFinite(value) && value >= 0 }
function text(value: string): boolean { return typeof value === 'string' && value.trim().length > 0 }
function url(value: string, hosts?: readonly string[]): URL | null {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && (!hosts || hosts.includes(parsed.hostname.toLowerCase())) ? parsed : null
  } catch { return null }
}

function canonicalObject(platform: Platform, objectId: string, objectUrl: string): boolean {
  const parsed = url(objectUrl, HOSTS[platform])
  if (!parsed || !text(objectId) || /\s/.test(objectId)) return false
  let path: string
  try { path = decodeURIComponent(parsed.pathname) } catch { return false }
  switch (platform) {
    case 'linkedin': return path.includes(objectId) && (/\/posts\//.test(path) || /\/feed\/update\//.test(path))
    case 'youtube': return parsed.hostname === 'youtu.be'
      ? path.slice(1) === objectId
      : parsed.searchParams.get('v') === objectId || path === `/shorts/${objectId}` || path === `/live/${objectId}`
    case 'x': return new RegExp(`/status/${objectId}/?$`).test(path)
    case 'instagram': return new RegExp(`/(?:p|reel)/${objectId}/?$`).test(path)
    case 'facebook': return path.includes(objectId) || parsed.searchParams.get('story_fbid') === objectId
  }
}

function band(size: number): string | null {
  if (!nonnegative(size)) return null
  if (size < 10_000) return 'micro'
  if (size < 100_000) return 'emerging'
  if (size < 1_000_000) return 'established'
  return 'large'
}

/** Platform adapters validate exact format and object identity before normalization. */
export function adaptPlatformObservation(raw: RawPlatformObservation): { observation: PerformanceObservation | null; blockers: string[] } {
  const blockers: string[] = []
  const formats = PLATFORM_FORMATS[raw.platform] as readonly string[] | undefined
  if (!formats?.includes(raw.format)) blockers.push('Unsupported platform/format boundary.')
  if (!formats || !canonicalObject(raw.platform, raw.object_id, raw.object_url)) blockers.push('Ambiguous canonical platform object identity.')
  if (!text(raw.account_id) || !url(raw.account_url, HOSTS[raw.platform]) || !text(raw.source_url) || !url(raw.source_url, SOURCE_HOSTS[raw.platform])) blockers.push('Account, channel, or platform-authoritative source URL is missing.')
  const published = time(raw.published_at)
  const observed = time(raw.observed_at)
  const start = time(raw.observation_window?.start)
  const end = time(raw.observation_window?.end)
  if (published === null || observed === null || start === null || end === null || start < published || end < start || observed < end || end - start > (DECISION_WINDOW_DAYS[raw.platform]?.[raw.format] ?? 0) * 86_400_000) blockers.push('Publication or format-specific observation window is invalid.')
  if (raw.observation_grade !== 'directional' && raw.observation_grade !== 'decision') blockers.push('Observation grade is invalid.')
  if (!/^[a-f0-9]{64}$/.test(raw.raw_response_sha256) || rawResponseSha256(raw.raw_response) !== raw.raw_response_sha256) blockers.push('Immutable raw-response SHA-256 does not match.')
  const completeMetrics = text(raw.metric?.name) && nonnegative(raw.metric?.value) && text(raw.metric?.denominator_name) && positive(raw.metric?.denominator)
  const completeAudience = band(raw.audience?.subscribers_or_followers) !== null && time(raw.audience?.observed_at) !== null
  if (raw.source_class === 'owned_first_party' && !completeMetrics) blockers.push('Attributable metric or denominator is missing.')
  if (raw.source_class === 'owned_first_party' && !completeAudience) blockers.push('Observed audience/subscriber baseline is missing.')
  if (!text(raw.cohort_id) || !text(raw.collector_version) || !text(raw.baseline_id) || !text(raw.baseline_version) || !text(raw.evidence_version) || !text(raw.source_policy_version) || raw.scoring_version !== ATTRIBUTABLE_PERFORMANCE_VERSION) blockers.push('Cohort, baseline, evidence, collector, or scoring version is missing or unsupported.')
  if (!text(raw.provenance?.record_id) || time(raw.provenance?.captured_at) === null || !text(raw.provenance?.method)) blockers.push('Source provenance is incomplete.')
  if (!raw.rights?.privacy_cleared || !raw.rights?.rights_cleared || !text(raw.rights?.rights_basis)) blockers.push('Privacy or rights clearance is incomplete.')
  if (!text(raw.rollback?.historical_record_id) || !text(raw.rollback?.procedure)) blockers.push('Rollback information is incomplete.')
  if (raw.policy?.source_class !== raw.source_class || !raw.policy?.approved || raw.policy?.expiry_basis !== 'approved_source_class_policy' || !text(raw.policy?.policy_id) || !text(raw.policy?.policy_version) || time(raw.policy?.issued_at) === null || time(raw.policy?.expires_at) === null || time(raw.policy?.expires_at)! <= time(raw.policy?.issued_at)!) blockers.push('Explicit expiry from an approved version-bound source-class policy is missing.')
  if (raw.policy?.policy_version !== raw.source_policy_version || raw.policy?.evidence_version !== raw.evidence_version || raw.policy?.platform !== raw.platform || raw.policy?.format !== raw.format || raw.policy?.object_id !== raw.object_id || raw.policy?.observation_id !== raw.provenance?.record_id || raw.policy?.raw_response_sha256 !== raw.raw_response_sha256) blockers.push('Source policy is not bound to this exact evidence version and observation.')
  if (!text(raw.policy?.approval?.receipt_id) || !text(raw.policy?.approval?.authority_id) || !text(raw.policy?.approval?.authority_version) || raw.policy?.approval?.policy_sha256 !== policyApprovalSha256(raw.policy)) blockers.push('Policy approval authority or immutable receipt binding is missing or changed.')
  if (raw.source_class !== 'owned_first_party' && raw.source_class !== 'external_creator') blockers.push('Source class is unsupported.')
  if (blockers.length) return { observation: null, blockers }
  const { raw_response: _rawResponse, ...fields } = raw
  // External creator records can only be weighted when the full attributable
  // performance and audience basis is present; incomplete records remain context.
  const performanceWeight: 0 | 1 = completeMetrics && completeAudience ? 1 : 0
  return { observation: { ...fields, evidence_use: performanceWeight ? 'performance' : 'structural_topic_context', performance_weight: performanceWeight }, blockers }
}

function eligible(observation: PerformanceObservation, at: number): string | null {
  const expiry = time(observation.policy.expires_at)
  if (!observation.policy.approved || observation.policy.expiry_basis !== 'approved_source_class_policy' || !observation.policy.policy_id || !observation.policy.policy_version || time(observation.policy.issued_at) === null || expiry === null) return 'Source-class freshness policy is not approved and version-bound.'
  if (!text(observation.policy.approval?.receipt_id) || !text(observation.policy.approval?.authority_id) || !text(observation.policy.approval?.authority_version) || observation.policy.approval.policy_sha256 !== policyApprovalSha256(observation.policy)) return 'Policy approval authority or receipt binding has changed.'
  if (at > expiry) return 'Source-class policy expiry has passed.'
  if (observation.policy.policy_version !== observation.source_policy_version || observation.policy.evidence_version !== observation.evidence_version || observation.policy.platform !== observation.platform || observation.policy.format !== observation.format || observation.policy.object_id !== observation.object_id || observation.policy.observation_id !== observation.provenance.record_id || observation.policy.raw_response_sha256 !== observation.raw_response_sha256) return 'Source policy binding differs from the historical observation.'
  if (time(observation.observed_at)! > at) return 'Observation is from the future.'
  const start = time(observation.observation_window.start)
  const end = time(observation.observation_window.end)
  if (observation.observation_grade !== 'decision' || start === null || end === null || end - start < DECISION_WINDOW_DAYS[observation.platform][observation.format] * 86_400_000) return 'Directional or immature decision window cannot be scored.'
  if (observation.performance_weight === 0) return 'External creator evidence has zero performance weight; structural/topic context only.'
  return null
}

export function evaluateAttributablePerformance(input: {
  candidate: PerformanceObservation
  comparables: PerformanceObservation[]
  baselines: Baseline[]
  evaluated_at: string
}): PerformanceReceipt {
  const { candidate } = input
  const blockers: string[] = []
  const excluded: ExcludedComparable[] = []
  const included: PerformanceObservation[] = []
  const at = time(input.evaluated_at)
  if (at === null) blockers.push('Evaluation time is invalid.')
  else {
    const reason = eligible(candidate, at)
    if (reason) blockers.push(`Candidate: ${reason}`)
  }
  const candidateBand = band(candidate.audience.subscribers_or_followers)
  function rateAgainstBaseline(observation: PerformanceObservation): number | null {
    const baseline = input.baselines.find((item) => item.baseline_id === observation.baseline_id)
    if (!baseline || baseline.baseline_version !== observation.baseline_version || !text(baseline.source_record_id) || baseline.platform !== observation.platform || baseline.format !== observation.format || baseline.account_id !== observation.account_id || baseline.metric_name !== observation.metric.name || baseline.denominator_name !== observation.metric.denominator_name || !positive(baseline.denominator) || !positive(baseline.metric_value) || band(baseline.audience) !== band(observation.audience.subscribers_or_followers) || time(baseline.observed_at) === null || (at !== null && time(baseline.observed_at)! > at)) return null
    if (baseline.computation_method !== 'aggregate_rate' || !text(baseline.computation_version) || time(baseline.computed_at) === null || !Array.isArray(baseline.contributions) || baseline.contributions.length < MINIMUM_MATCHED_COMPARABLES || baseline.input_sha256 !== baselineInputSha256(baseline) || baseline.receipt_sha256 !== baselineReceiptSha256(baseline)) return null
    const unique = new Set(baseline.contributions.map((item) => item.record_id))
    if (unique.size !== baseline.contributions.length || baseline.contributions.some((item) => !text(item.record_id) || !/^[a-f0-9]{64}$/.test(item.raw_response_sha256) || item.account_id !== baseline.account_id || item.platform !== baseline.platform || item.format !== baseline.format || item.metric_name !== baseline.metric_name || item.denominator_name !== baseline.denominator_name || !nonnegative(item.metric_value) || !positive(item.denominator))) return null
    if (baseline.contributions.reduce((sum, item) => sum + item.metric_value, 0) !== baseline.metric_value || baseline.contributions.reduce((sum, item) => sum + item.denominator, 0) !== baseline.denominator) return null
    return (observation.metric.value / observation.metric.denominator) / (baseline.metric_value / baseline.denominator)
  }
  const candidateRelative = rateAgainstBaseline(candidate)
  if (candidateRelative === null) blockers.push('Attributable same-account, same-format baseline and denominator are required.')
  const seen = new Set<string>([`${candidate.platform}:${candidate.object_id}`])
  for (const comparable of [...input.comparables].sort((a, b) => a.provenance.record_id.localeCompare(b.provenance.record_id))) {
    const id = comparable.provenance.record_id
    let reason: string | null = null
    const objectKey = `${comparable.platform}:${comparable.object_id}`
    if (seen.has(objectKey)) reason = 'Duplicate canonical object.'
    else if (at === null) reason = 'Evaluation time is invalid.'
    else reason = eligible(comparable, at)
    if (!reason && comparable.platform !== candidate.platform) reason = 'Cross-channel equivalence is unsupported.'
    if (!reason && comparable.format !== candidate.format) reason = 'Cross-format equivalence is unsupported.'
    if (!reason && band(comparable.audience.subscribers_or_followers) !== candidateBand) reason = 'Audience band does not match.'
    if (!reason && (comparable.cohort_id !== candidate.cohort_id || comparable.metric.name !== candidate.metric.name || comparable.metric.denominator_name !== candidate.metric.denominator_name || !positive(comparable.metric.denominator))) reason = 'Cohort, metric, or denominator does not match.'
    if (!reason && rateAgainstBaseline(comparable) === null) reason = 'Comparable lacks its own attributable same-account baseline.'
    if (reason) excluded.push({ record_id: id, reason })
    else included.push(comparable)
    seen.add(objectKey)
  }
  if (included.length < MINIMUM_MATCHED_COMPARABLES) blockers.push(`At least ${MINIMUM_MATCHED_COMPARABLES} same-channel, same-format, audience-band-matched included comparables are required.`)
  const relative = !blockers.length ? candidateRelative : null
  const cohortRates = !blockers.length ? included.map((item) => rateAgainstBaseline(item)!) : []
  const score = relative !== null && cohortRates.length
    ? Math.round(100 * (cohortRates.filter((value) => value < relative).length + 0.5 * cohortRates.filter((value) => value === relative).length) / cohortRates.length)
    : null
  if (score === null && !blockers.length) blockers.push('A finite matched cohort rate is required.')
  const receipt = {
    contract_version: ATTRIBUTABLE_PERFORMANCE_VERSION,
    status: blockers.length ? 'Unscored' : 'Scored',
    score: blockers.length ? null : score,
    outlier_score: blockers.length ? null : score,
    outlier_threshold: OUTLIER_SCORE_THRESHOLD,
    outlier_verdict: blockers.length ? 'unscored' : score! >= OUTLIER_SCORE_THRESHOLD ? 'pass' : 'below_threshold',
    relative_performance: blockers.length ? null : relative,
    baseline_id: candidate.baseline_id,
    cohort_id: candidate.cohort_id,
    included_record_ids: included.map((item) => item.provenance.record_id),
    excluded,
    blockers,
    historical_record_ids: [candidate, ...input.comparables].map((item) => item.rollback.historical_record_id),
    evaluated_at: input.evaluated_at,
    handoff: blockers.length || score! < OUTLIER_SCORE_THRESHOLD ? 'none' : 'internal_human_qa_preparation_only',
    external_actions_enabled: false,
  }
  return { ...receipt, receipt_sha256: createHash('sha256').update(stable({ receipt, input })).digest('hex') } as PerformanceReceipt
}

/** Shadow replay has no persistence and returns each deterministic receipt in input order. */
export function shadowReplayAttributablePerformance(cases: Parameters<typeof evaluateAttributablePerformance>[0][]): PerformanceReceipt[] {
  return cases.map(evaluateAttributablePerformance)
}
