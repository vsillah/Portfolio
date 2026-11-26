import { createHash } from 'node:crypto'
import { acquireAttributableObservation, type AcquisitionFixture } from './attributable-performance-acquisition'
import { ATTRIBUTABLE_PERFORMANCE_VERSION, MINIMUM_MATCHED_COMPARABLES, evaluateAttributablePerformance, rawResponseSha256, type Baseline, type PerformanceObservation, type PerformanceReceipt } from './attributable-performance-evidence'

/** A caller-owned, checked-in manifest is the only input authority. No file or source is opened here. */
export type HistoricalFixtureApproval = {
  record_id: string
  raw_response_sha256: string
  evidence_version: string
  collector_version: string
  source_policy_version: string
  policy_approval_receipt_id: string
  kind: 'synthetic' | 'approved_checked_in_historical'
  approval_receipt_id: string
  source_path: string
}
export type HistoricalFixtureManifest = {
  manifest_id: string
  manifest_version: string
  policy_id: string
  policy_version: string
  evidence_version: string
  metric_definition: { metric_name: string; denominator_name: string; definition_version: string; approval_receipt_id: string }
  entries: HistoricalFixtureApproval[]
}
export type CohortDecision = {
  role: 'candidate' | 'comparable'
  status: 'Included' | 'Excluded' | 'Unscored'
  reason: string | null
  canonical_identity: { platform: string; format: string; object_id: string; object_url: string } | null
  historical_record_id: string
  record_id: string
  raw_response_sha256: string
  evidence_version: string
  collector_version: string
  observation_window: { start: string; end: string }
  audience_band: string | null
  baseline_receipt: { baseline_id: string; baseline_version: string; receipt_sha256: string | null }
  policy_approval_receipt: { receipt_id: string; policy_sha256: string }
  provenance: AcquisitionFixture['provenance']
  rights_privacy: AcquisitionFixture['rights']
  rollback: AcquisitionFixture['rollback']
  fixture_approval: HistoricalFixtureApproval | null
  fixture_approval_entries: HistoricalFixtureApproval[]
}
export type HistoricalCohortManifest = {
  contract_version: typeof ATTRIBUTABLE_PERFORMANCE_VERSION
  constructor_version: 'historical-cohort-v1'
  fixture_manifest_id: string
  fixture_manifest_version: string
  metric_definition: HistoricalFixtureManifest['metric_definition']
  evaluated_at: string
  status: 'Scored' | 'Unscored'
  candidate_record_id: string
  included_record_ids: string[]
  excluded_record_ids: string[]
  qualifying_comparable_count: number
  minimum_comparables: typeof MINIMUM_MATCHED_COMPARABLES
  decisions: CohortDecision[]
  blockers: string[]
  performance_receipt: PerformanceReceipt | null
  receipt_sha256: string
  external_actions_enabled: false
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
const sha = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex')
const band = (size: number): string | null => !Number.isFinite(size) || size < 0 ? null : size < 10_000 ? 'micro' : size < 100_000 ? 'emerging' : size < 1_000_000 ? 'established' : 'large'
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const order = (a: AcquisitionFixture, b: AcquisitionFixture) =>
  compare(a.provenance.record_id, b.provenance.record_id) ||
  compare(rawResponseSha256(a.raw_response), rawResponseSha256(b.raw_response)) ||
  compare(stable(a), stable(b))

export function constructHistoricalCohort(input: {
  candidate: AcquisitionFixture
  comparables: AcquisitionFixture[]
  baselines: Baseline[]
  fixture_manifest: HistoricalFixtureManifest
  evaluated_at: string
}): HistoricalCohortManifest {
  const { candidate, fixture_manifest: manifest } = input
  const sorted = [...input.comparables].sort(order)
  const fixtures = [candidate, ...sorted]
  const approvals = new Map<string, HistoricalFixtureApproval[]>()
  for (const entry of manifest.entries) approvals.set(entry.record_id, [...(approvals.get(entry.record_id) ?? []), entry])
  const duplicateManifestReasons = [...approvals.entries()]
    .filter(([, entries]) => entries.length > 1)
    .sort(([a], [b]) => compare(a, b))
    .map(([id, entries]) => `Duplicate fixture-manifest record ID ${id}${new Set(entries.map(stable)).size > 1 ? ' has conflicting bindings' : ''}.`)
  const seenObjects = new Set<string>()
  const seenResponses = new Set<string>()
  const seenRecords = new Set<string>()
  const blockers: string[] = []
  const candidateObservation = acquireAttributableObservation(candidate).observation
  const valid: PerformanceObservation[] = []
  const decisions: CohortDecision[] = fixtures.map((fixture, index) => {
    const role = index === 0 ? 'candidate' : 'comparable'
    const recordId = fixture.provenance.record_id
    const digest = rawResponseSha256(fixture.raw_response)
    const approvalEntries = [...(approvals.get(recordId) ?? [])].sort((a, b) => compare(stable(a), stable(b)))
    const approval = approvalEntries.length === 1 ? approvalEntries[0] : null
    const acquired = acquireAttributableObservation(fixture)
    const observation = acquired.observation
    const reasons = [...acquired.blockers]
    reasons.push(...duplicateManifestReasons)
    if (index > 0 && observation && candidateObservation) {
      if (observation.platform !== candidateObservation.platform) reasons.push('Cross-channel equivalence is unsupported.')
      if (observation.format !== candidateObservation.format) reasons.push('Cross-format equivalence is unsupported.')
      if (band(observation.audience.subscribers_or_followers) !== band(candidateObservation.audience.subscribers_or_followers)) reasons.push('Audience band does not match.')
      if (observation.cohort_id !== candidateObservation.cohort_id) reasons.push('Cohort identity does not match.')
    }
    if (approvalEntries.length === 0 || (approval && (!approval.approval_receipt_id || !approval.source_path || approval.source_path.startsWith('/') || approval.source_path.split('/').includes('..') || !['synthetic', 'approved_checked_in_historical'].includes(approval.kind)))) reasons.push('Checked-in fixture approval is missing.')
    else if (approval && (approval.record_id !== recordId || approval.raw_response_sha256 !== digest || approval.evidence_version !== fixture.evidence_version || approval.collector_version !== fixture.collector_version || approval.source_policy_version !== fixture.source_policy_version || approval.policy_approval_receipt_id !== fixture.policy.approval.receipt_id)) reasons.push('Checked-in fixture differs from its exact approved manifest entry.')
    if (!manifest.manifest_id || !manifest.manifest_version || !manifest.policy_id || !manifest.policy_version || !manifest.evidence_version) reasons.push('Fixture manifest identity or current policy binding is missing.')
    if (!manifest.metric_definition?.metric_name || !manifest.metric_definition.denominator_name || !manifest.metric_definition.definition_version || !manifest.metric_definition.approval_receipt_id || observation?.metric.name !== manifest.metric_definition.metric_name || observation?.metric.denominator_name !== manifest.metric_definition.denominator_name) reasons.push('Approved metric or denominator definition is missing or differs.')
    if (fixture.policy.policy_id !== manifest.policy_id || fixture.policy.policy_version !== manifest.policy_version || fixture.evidence_version !== manifest.evidence_version || fixture.source_policy_version !== manifest.policy_version) reasons.push('Source policy is not the current exact approved version.')
    if (seenRecords.has(recordId)) reasons.push('Duplicate historical record identity.')
    if (seenResponses.has(digest)) reasons.push('Duplicate retained response identity.')
    const objectKey = observation ? `${observation.platform}:${observation.object_id}` : null
    if (objectKey && seenObjects.has(objectKey)) reasons.push('Duplicate canonical object.')
    seenRecords.add(recordId); seenResponses.add(digest)
    if (objectKey) seenObjects.add(objectKey)
    const baseline = input.baselines.find((item) => item.baseline_id === fixture.baseline_id && item.baseline_version === fixture.baseline_version)
    if (!reasons.length && observation) valid.push(observation)
    return {
      role, status: reasons.length ? 'Unscored' : 'Excluded', reason: reasons.join(' ') || null,
      canonical_identity: observation ? { platform: observation.platform, format: observation.format, object_id: observation.object_id, object_url: observation.object_url } : null,
      historical_record_id: fixture.rollback.historical_record_id, record_id: recordId, raw_response_sha256: digest,
      evidence_version: fixture.evidence_version, collector_version: fixture.collector_version,
      observation_window: fixture.observation_window, audience_band: band(fixture.audience.subscribers_or_followers),
      baseline_receipt: { baseline_id: fixture.baseline_id, baseline_version: fixture.baseline_version, receipt_sha256: baseline?.receipt_sha256 ?? null },
      policy_approval_receipt: { receipt_id: fixture.policy.approval.receipt_id, policy_sha256: fixture.policy.approval.policy_sha256 },
      provenance: fixture.provenance, rights_privacy: fixture.rights, rollback: fixture.rollback, fixture_approval: approval,
      fixture_approval_entries: approvalEntries,
    }
  })
  const candidateValid = valid[0]?.provenance.record_id === candidate.provenance.record_id && decisions[0].reason === null
  const receipt = candidateValid ? evaluateAttributablePerformance({ candidate: valid[0], comparables: valid.slice(1), baselines: input.baselines, evaluated_at: input.evaluated_at }) : null
  const included = new Set(receipt?.included_record_ids ?? [])
  const excluded = new Map(receipt?.excluded.map((item) => [item.record_id, item.reason]) ?? [])
  for (const decision of decisions) {
    if (decision.reason) continue
    if (decision.role === 'candidate') {
      decision.status = receipt?.blockers.some((reason) => reason.startsWith('Candidate:') || reason.includes('baseline')) ? 'Unscored' : 'Included'
      decision.reason = receipt?.blockers.find((reason) => reason.startsWith('Candidate:') || reason.includes('baseline')) ?? null
    } else if (included.has(decision.record_id)) decision.status = 'Included'
    else { decision.status = 'Unscored'; decision.reason = excluded.get(decision.record_id) ?? 'Candidate is not eligible for cohort construction.' }
  }
  blockers.push(...decisions.filter((item) => item.status === 'Unscored').map((item) => `${item.role} ${item.record_id}: ${item.reason}`))
  blockers.push(...(receipt?.blockers ?? (candidateValid ? [] : ['Candidate acquisition or fixture approval is invalid.'])))
  const includedIds = decisions.filter((item) => item.role === 'comparable' && item.status === 'Included').map((item) => item.record_id)
  if (includedIds.length < MINIMUM_MATCHED_COMPARABLES && !blockers.some((item) => item.includes('At least 5'))) blockers.push(`At least ${MINIMUM_MATCHED_COMPARABLES} distinct qualifying comparables are required.`)
  const result = {
    contract_version: ATTRIBUTABLE_PERFORMANCE_VERSION, constructor_version: 'historical-cohort-v1' as const,
    fixture_manifest_id: manifest.manifest_id, fixture_manifest_version: manifest.manifest_version, metric_definition: manifest.metric_definition,
    evaluated_at: input.evaluated_at, status: receipt?.status === 'Scored' && includedIds.length >= MINIMUM_MATCHED_COMPARABLES ? 'Scored' as const : 'Unscored' as const,
    candidate_record_id: candidate.provenance.record_id, included_record_ids: includedIds,
    excluded_record_ids: decisions.filter((item) => item.role === 'comparable' && item.status !== 'Included').map((item) => item.record_id),
    qualifying_comparable_count: includedIds.length, minimum_comparables: MINIMUM_MATCHED_COMPARABLES as typeof MINIMUM_MATCHED_COMPARABLES,
    decisions, blockers, performance_receipt: receipt, external_actions_enabled: false as const,
  }
  return { ...result, receipt_sha256: sha(result) }
}
