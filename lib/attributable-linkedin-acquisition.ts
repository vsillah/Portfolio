import { createHash } from 'node:crypto'
import { constructHistoricalCohort, type HistoricalFixtureManifest } from './attributable-historical-cohort'
import { rawResponseSha256, type Baseline } from './attributable-performance-evidence'
import type { AcquisitionFixture } from './attributable-performance-acquisition'

export const SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID = '8774cf25-7108-40a3-9041-d6cca21ae4de' as const

/** Retained-source index supplied by the caller. It is not an approval-store verdict. */
export type LinkedInRetainedSource = {
  record_id: string
  source_path: string
  raw_response_sha256: string
  policy_expires_at: string
  source_route: 'synthetic' | 'member_export' | 'api_response'
  impression_origin: 'linkedin_reported' | 'portfolio_derived'
  reported_impressions: number
}

export type LinkedInAcquisitionInput = {
  calendar_item_id: typeof SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID
  artifact_version: string
  content_sha256: string
  content_snapshot: unknown
  candidate: AcquisitionFixture | null
  comparables: AcquisitionFixture[]
  baselines: Baseline[]
  fixture_manifest: HistoricalFixtureManifest
  retained_sources: LinkedInRetainedSource[]
  evaluated_at: string
}

export type LinkedInAcquisitionReport = {
  contract_version: 'linkedin-attributable-acquisition-v1'
  calendar_item_id: typeof SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID
  artifact_version: string
  content_sha256: string
  evaluated_at: string
  status: 'synthetic_scored' | 'blocked'
  blockers: string[]
  comparable_count: number
  cohort_receipt_sha256: string | null
  performance_receipt_sha256: string | null
  decisions: ReturnType<typeof constructHistoricalCohort>['decisions']
  retained_sources: LinkedInRetainedSource[]
  source_authority: 'synthetic_fixture_only' | 'historical_approval_store_unverified' | 'missing'
  production_evidence_sufficient: false
  production_receipt_enabled: false
  packet_linkage_enabled: false
  preparation_rerun_enabled: false
  notification_enabled: false
  external_actions_enabled: false
  report_sha256: string
}

const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const present = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const safePath = (value: unknown) => present(value) && !value.startsWith('/') && !value.split('/').includes('..')
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => compare(a, b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/** Pure reconciliation of retained responses. No source, approval store, or calendar is queried. */
export function reconcileLinkedInAttributableEvidence(input: LinkedInAcquisitionInput): LinkedInAcquisitionReport {
  const blockers: string[] = []
  if (input.calendar_item_id !== SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID) blockers.push('Calendar item identity differs from the Phase 5L target.')
  if (!present(input.artifact_version) || !digest(input.content_sha256) || input.content_sha256 !== rawResponseSha256(input.content_snapshot)) blockers.push('Exact artifact version or content SHA-256 is missing or differs from the supplied snapshot.')
  const fixtures = input.candidate ? [input.candidate, ...input.comparables] : [...input.comparables]
  if (!input.candidate) blockers.push('Candidate retained response is missing.')
  const indexed = new Map<string, LinkedInRetainedSource[]>()
  for (const source of input.retained_sources) indexed.set(source.record_id, [...(indexed.get(source.record_id) ?? []), source])
  for (const fixture of fixtures) {
    const recordId = fixture.provenance.record_id
    const entries = indexed.get(recordId) ?? []
    if (fixture.channel !== 'linkedin' || fixture.policy.platform !== 'linkedin') blockers.push(`${recordId}: LinkedIn channel identity differs.`)
    if (entries.length !== 1) {
      blockers.push(`${recordId}: exactly one retained-source index entry is required.`)
      continue
    }
    const source = entries[0]
    if (!safePath(source.source_path) || !digest(source.raw_response_sha256) || source.raw_response_sha256 !== rawResponseSha256(fixture.raw_response)) blockers.push(`${recordId}: retained response path or SHA-256 differs.`)
    if (!present(source.policy_expires_at) || source.policy_expires_at !== fixture.policy.expires_at) blockers.push(`${recordId}: exact source-policy expiration differs.`)
    const manifestEntries = input.fixture_manifest.entries.filter((entry) => entry.record_id === recordId)
    if (manifestEntries.length !== 1 || manifestEntries[0].source_path !== source.source_path) blockers.push(`${recordId}: retained path differs from the fixture manifest.`)
    const raw = fixture.raw_response && typeof fixture.raw_response === 'object' ? fixture.raw_response as Record<string, unknown> : null
    const analytics = raw?.analytics && typeof raw.analytics === 'object' ? raw.analytics as Record<string, unknown> : null
    if (source.impression_origin !== 'linkedin_reported' || !Number.isInteger(source.reported_impressions)
      || source.reported_impressions <= 0 || source.reported_impressions !== analytics?.impressions) {
      blockers.push(`${recordId}: impressions must be directly reported by LinkedIn and match the retained response; Portfolio-derived impressions are unsupported.`)
    }
    if (source.source_route === 'api_response') blockers.push(`${recordId}: API entity mapping, response schema, and retention authority are unverified.`)
    else if (source.source_route !== 'synthetic' && source.source_route !== 'member_export') blockers.push(`${recordId}: source route is unsupported.`)
    if (manifestEntries.length === 1 && (manifestEntries[0].kind === 'synthetic') !== (source.source_route === 'synthetic')) blockers.push(`${recordId}: source route differs from fixture authority class.`)
  }
  for (const recordId of indexed.keys()) if (!fixtures.some((fixture) => fixture.provenance.record_id === recordId)) blockers.push(`${recordId}: retained-source entry has no observation.`)
  const kinds = input.fixture_manifest.entries.map((entry) => entry.kind)
  const sourceAuthority: LinkedInAcquisitionReport['source_authority'] = kinds.length === 0 ? 'missing' : kinds.every((kind) => kind === 'synthetic') ? 'synthetic_fixture_only' : 'historical_approval_store_unverified'
  if (sourceAuthority === 'historical_approval_store_unverified') blockers.push('Historical source approval and policy authority require owning-store verification.')
  if (sourceAuthority === 'missing') blockers.push('Fixture source authority is missing.')
  const cohort = input.candidate ? constructHistoricalCohort({
    candidate: input.candidate, comparables: input.comparables, baselines: input.baselines,
    fixture_manifest: input.fixture_manifest, evaluated_at: input.evaluated_at,
  }) : null
  blockers.push(...(cohort?.blockers ?? []))
  if (!cohort || cohort.status !== 'Scored') blockers.push('Five distinct qualified LinkedIn comparables and candidate evidence are required.')
  const body = {
    contract_version: 'linkedin-attributable-acquisition-v1' as const,
    calendar_item_id: SIGNALS_ALIGNMENT_MOMENTUM_CALENDAR_ID,
    artifact_version: input.artifact_version, content_sha256: input.content_sha256, evaluated_at: input.evaluated_at,
    status: blockers.length ? 'blocked' as const : 'synthetic_scored' as const,
    blockers: [...new Set(blockers)].sort(compare), comparable_count: cohort?.qualifying_comparable_count ?? 0,
    cohort_receipt_sha256: cohort?.receipt_sha256 ?? null,
    performance_receipt_sha256: cohort?.performance_receipt?.receipt_sha256 ?? null,
    decisions: cohort?.decisions ?? [], retained_sources: [...input.retained_sources].sort((a, b) => compare(a.record_id, b.record_id) || compare(stable(a), stable(b))),
    source_authority: sourceAuthority,
    production_evidence_sufficient: false as const, production_receipt_enabled: false as const,
    packet_linkage_enabled: false as const, preparation_rerun_enabled: false as const,
    notification_enabled: false as const, external_actions_enabled: false as const,
  }
  return { ...body, report_sha256: createHash('sha256').update(stable(body)).digest('hex') }
}
