import { createHash } from 'node:crypto'
import { constructHistoricalCohort, type HistoricalCohortManifest, type HistoricalFixtureManifest } from './attributable-historical-cohort'
import { type AcquisitionFixture } from './attributable-performance-acquisition'
import { PLATFORM_FORMATS, type Baseline, type Platform } from './attributable-performance-evidence'

/** Pure Phase 5I replay. All inputs are caller-owned checked-in fixtures and approval receipts. */
export type ShadowCase = {
  case_id: string
  artifact_version: string
  candidate: AcquisitionFixture
  comparables: AcquisitionFixture[]
  baselines: Baseline[]
  fixture_manifest: HistoricalFixtureManifest
  evaluated_at: string
}
export type ApprovedOutcomeReceipt = {
  case_id: string
  artifact_version: string
  evidence_version: string
  platform: Platform
  format: string
  cohort_receipt_sha256: string
  performance_receipt_sha256: string | null
  outcome: 'pass' | 'below_threshold' | 'unscored'
  unsupported_change: boolean
  reviewer_or_authority: string
  decision_receipt_id: string
  decided_at: string
  valid_until: string
  privacy_cleared: boolean
  rights_cleared: boolean
  exclusions: string[]
  source_path: string
  receipt_sha256: string
}
export type CalibrationPolicy = {
  policy_id: string
  policy_version: string
  approval_receipt_id: string
  minimum_cases: number
  minimum_resolved: number
  minimum_positive: number
  minimum_negative: number
  minimum_binary_comparisons: number
  maximum_unresolved_rate: number
  evaluated_at: string
}
export type CalibrationTrace = {
  case_id: string
  artifact_version: string
  platform: string
  format: string
  fixture_kind: 'synthetic' | 'approved_checked_in_historical' | 'unresolved'
  predicted: 'pass' | 'below_threshold' | 'unscored'
  approved: ApprovedOutcomeReceipt | null
  outcome_receipts: ApprovedOutcomeReceipt[]
  agreement: 'exact' | 'disagreement' | 'unresolved'
  label_reasons: string[]
  cohort_receipt_sha256: string
  performance_receipt_sha256: string | null
  cohort_receipt: HistoricalCohortManifest
  source_and_cohort_rejections: string[]
  inclusion: 'included' | 'excluded'
}
export type CalibrationGroup = {
  platform: string
  format: string
  sample_size: number
  resolved: number
  unresolved: number
  unresolved_rate: number
  exact_agreement: number
  disagreements: number
  predicted: Record<'pass' | 'below_threshold' | 'unscored', number>
  approved: Record<'pass' | 'below_threshold' | 'unscored', number>
  true_positive: number
  true_negative: number
  false_positive: number
  false_negative: number
  precision: number | null
  recall: number | null
  unsupported_change_count: number
  unsupported_change_rate: number | null
  fixture_coverage: { synthetic: number; approved_checked_in_historical: number; unresolved: number }
  rejection_reasons: string[]
  confidence_eligible: boolean
  reportable: boolean
  blockers: string[]
  trace_case_ids: string[]
}
export type CalibrationReport = {
  contract_version: 'shadow-calibration-v1'
  policy: CalibrationPolicy
  groups: CalibrationGroup[]
  traces: CalibrationTrace[]
  orphan_outcome_receipts: ApprovedOutcomeReceipt[]
  receipt_sha256: string
  recommendations: string[]
  external_actions_enabled: false
  policy_changes_enabled: false
}
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => order(a, b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
const sha = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex')
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const timestamp = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null
const count = () => ({ pass: 0, below_threshold: 0, unscored: 0 })
const validPolicy = (p: CalibrationPolicy) => text(p.policy_id) && text(p.policy_version) && text(p.approval_receipt_id) && timestamp(p.evaluated_at) !== null && [p.minimum_cases, p.minimum_resolved, p.minimum_positive, p.minimum_negative, p.minimum_binary_comparisons].every((n) => Number.isSafeInteger(n) && n > 0) && Number.isFinite(p.maximum_unresolved_rate) && p.maximum_unresolved_rate >= 0 && p.maximum_unresolved_rate <= 1
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export function outcomeReceiptSha256(receipt: ApprovedOutcomeReceipt): string {
  const { receipt_sha256: _hash, ...bound } = receipt
  return sha(bound)
}
const path = (value: unknown) => text(value) && !value.startsWith('/') && !value.split('/').includes('..')

export function calibrateHistoricalShadow(input: { cases: ShadowCase[]; outcomes: ApprovedOutcomeReceipt[]; policy: CalibrationPolicy }): CalibrationReport {
  const { policy } = input
  const cases = [...input.cases].sort((a, b) => order(a.case_id, b.case_id) || order(stable(a), stable(b)))
  const labels = [...input.outcomes].sort((a, b) => order(a.case_id, b.case_id) || order(stable(a), stable(b)))
  const caseCounts = new Map<string, number>()
  for (const item of cases) caseCounts.set(item.case_id, (caseCounts.get(item.case_id) ?? 0) + 1)
  const labelCounts = new Map<string, number>()
  for (const item of labels) labelCounts.set(item.decision_receipt_id, (labelCounts.get(item.decision_receipt_id) ?? 0) + 1)
  const traces: CalibrationTrace[] = cases.map((item) => {
    const cohort = constructHistoricalCohort(item)
    const candidate = cohort.decisions[0]
    const platform = candidate.canonical_identity?.platform ?? item.candidate.policy.platform
    const format = candidate.canonical_identity?.format ?? item.candidate.format
    const matching = labels.filter((label) => label.case_id === item.case_id)
    const reasons: string[] = []
    if (!text(item.case_id) || caseCounts.get(item.case_id) !== 1) reasons.push('Missing or duplicate case ID.')
    if (!text(item.artifact_version)) reasons.push('Artifact version is missing.')
    if (matching.length !== 1) reasons.push(matching.length ? 'Duplicate or conflicting approved outcomes.' : 'Approved outcome is missing.')
    const label = matching.length === 1 ? matching[0] : null
    if (label) {
      if (label.receipt_sha256 !== outcomeReceiptSha256(label)) reasons.push('Approved outcome receipt content hash differs.')
      if (labelCounts.get(label.decision_receipt_id) !== 1 || !text(label.decision_receipt_id)) reasons.push('Duplicate or missing decision receipt ID.')
      if (label.case_id !== item.case_id || label.artifact_version !== item.artifact_version || label.evidence_version !== item.fixture_manifest.evidence_version || label.platform !== platform || label.format !== format || label.cohort_receipt_sha256 !== cohort.receipt_sha256 || label.performance_receipt_sha256 !== (cohort.performance_receipt?.receipt_sha256 ?? null)) reasons.push('Outcome binding differs from exact case, version, channel, format, or input receipt hashes.')
      if (!digest(label.cohort_receipt_sha256) || (label.performance_receipt_sha256 !== null && !digest(label.performance_receipt_sha256))) reasons.push('Outcome receipt hash is invalid.')
      const decided = timestamp(label.decided_at), expiry = timestamp(label.valid_until), at = timestamp(policy.evaluated_at)
      if (decided === null || expiry === null || at === null || decided > at || expiry < at || expiry < decided) reasons.push('Outcome approval is stale, future-dated, or invalid.')
      if (!text(label.reviewer_or_authority) || !path(label.source_path) || !label.privacy_cleared || !label.rights_cleared || !Array.isArray(label.exclusions) || label.exclusions.some((value) => !text(value))) reasons.push('Outcome authority, checked-in provenance, rights, privacy, or exclusions are incomplete.')
      if (!['pass', 'below_threshold', 'unscored'].includes(label.outcome) || typeof label.unsupported_change !== 'boolean') reasons.push('Outcome classification is unsupported.')
    }
    const entries = item.fixture_manifest.entries
    const fixture_kind = entries.length && entries.every((entry) => entry.kind === 'synthetic') ? 'synthetic' : entries.length && entries.every((entry) => entry.kind === 'approved_checked_in_historical') ? 'approved_checked_in_historical' : 'unresolved'
    if (fixture_kind === 'unresolved') reasons.push('Fixture kind is mixed or unresolved.')
    const predicted = cohort.performance_receipt?.outlier_verdict ?? 'unscored'
    const approved = reasons.length ? null : label
    return {
      case_id: item.case_id, artifact_version: item.artifact_version, platform, format, fixture_kind,
      predicted, approved, outcome_receipts: matching, agreement: !approved ? 'unresolved' : approved.outcome === predicted ? 'exact' : 'disagreement',
      label_reasons: reasons, cohort_receipt_sha256: cohort.receipt_sha256, performance_receipt_sha256: cohort.performance_receipt?.receipt_sha256 ?? null,
      cohort_receipt: cohort, source_and_cohort_rejections: [...cohort.blockers, ...cohort.decisions.filter((decision) => decision.status === 'Unscored').map((decision) => `${decision.record_id}: ${decision.reason}`)],
      inclusion: approved ? 'included' : 'excluded',
    }
  })
  const groups: CalibrationGroup[] = []
  for (const key of [...new Set(traces.map((trace) => `${trace.platform}\u0000${trace.format}`))].sort(order)) {
    const [platform, format] = key.split('\u0000')
    const rows = traces.filter((trace) => trace.platform === platform && trace.format === format)
    const resolved = rows.filter((row) => row.approved !== null)
    const predicted = count(), approved = count()
    let tp = 0, tn = 0, fp = 0, fn = 0, unsupported = 0
    for (const row of rows) {
      predicted[row.predicted]++
      if (!row.approved) continue
      approved[row.approved.outcome]++
      if (row.approved.unsupported_change) unsupported++
      // Binary pass metrics have valid denominators only for independently scored outcomes.
      if (row.predicted !== 'unscored' && row.approved.outcome !== 'unscored') {
        if (row.predicted === 'pass' && row.approved.outcome === 'pass') tp++
        else if (row.predicted === 'pass') fp++
        else if (row.approved.outcome === 'pass') fn++
        else tn++
      }
    }
    const unresolved = rows.length - resolved.length
    const positives = resolved.filter((row) => row.approved?.outcome === 'pass').length
    const negatives = resolved.filter((row) => row.approved?.outcome === 'below_threshold').length
    const blockers: string[] = []
    if (!validPolicy(policy)) blockers.push('Versioned calibration policy or threshold inputs are invalid.')
    if (!(PLATFORM_FORMATS[platform as Platform] as readonly string[] | undefined)?.includes(format)) blockers.push('Unsupported platform or format.')
    if (rows.length < policy.minimum_cases) blockers.push('Insufficient case sample.')
    if (resolved.length < policy.minimum_resolved) blockers.push('Insufficient resolved outcomes.')
    if (positives < policy.minimum_positive || negatives < policy.minimum_negative) blockers.push('Insufficient independently scored positive or negative outcomes.')
    if (tp + tn + fp + fn < policy.minimum_binary_comparisons) blockers.push('Insufficient valid binary comparisons.')
    if (tp + fp === 0 || tp + fn === 0) blockers.push('Precision or recall denominator is unavailable.')
    if (rows.length && unresolved / rows.length > policy.maximum_unresolved_rate) blockers.push('Unresolved rate exceeds approved limit.')
    const confidence_eligible = blockers.length === 0
    groups.push({ platform, format, sample_size: rows.length, resolved: resolved.length, unresolved, unresolved_rate: rows.length ? unresolved / rows.length : 0,
      exact_agreement: resolved.filter((row) => row.agreement === 'exact').length, disagreements: resolved.filter((row) => row.agreement === 'disagreement').length,
      predicted, approved, true_positive: tp, true_negative: tn, false_positive: fp, false_negative: fn,
      precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null,
      unsupported_change_count: unsupported, unsupported_change_rate: resolved.length ? unsupported / resolved.length : null,
      fixture_coverage: { synthetic: rows.filter((row) => row.fixture_kind === 'synthetic').length, approved_checked_in_historical: rows.filter((row) => row.fixture_kind === 'approved_checked_in_historical').length, unresolved: rows.filter((row) => row.fixture_kind === 'unresolved').length },
      rejection_reasons: [...new Set(rows.flatMap((row) => [...row.label_reasons, ...row.source_and_cohort_rejections]))].sort(order),
      confidence_eligible, reportable: confidence_eligible, blockers, trace_case_ids: rows.map((row) => row.case_id) })
  }
  const orphan_outcome_receipts = labels.filter((label) => !caseCounts.has(label.case_id))
  const result = { contract_version: 'shadow-calibration-v1' as const, policy, groups, traces, orphan_outcome_receipts,
    recommendations: [] as string[], external_actions_enabled: false as const, policy_changes_enabled: false as const }
  return { ...result, receipt_sha256: sha(result) }
}
