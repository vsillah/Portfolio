import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { proposeRepair } from './engine.mjs'
import { fixtureHash, verifySource } from './shadow-replay.mjs'

export const EXCLUSIONS = Object.freeze(['provider', 'render', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send', 'approval_mutation'])
const HASH = /^sha256:[a-f0-9]{64}$/
const COMMIT = /^[a-f0-9]{40}$/
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
const same = (a, b) => canonical(a) === canonical(b)
const exact = (v, keys) => object(v) && Object.keys(v).sort().join('|') === [...keys].sort().join('|')
const canonical = (v) => JSON.stringify(v, (_, x) => object(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x)
const sha = (v) => `sha256:${createHash('sha256').update(v).digest('hex')}`
const fail = (reason) => { throw new Error(`decision receipt: ${reason}`) }
const validSource = (v, readSource) => {
  if (!exact(v, ['path', 'sha256']) || !/^(artifacts|tools\/evidence-repair)\/[a-zA-Z0-9_./-]+$/.test(v.path) || v.path.split('/').includes('..')) fail('invalid source binding')
  verifySource(v, readSource)
}
export function receiptHash(receipt) {
  const { receipt_sha256, ...body } = receipt
  return sha(canonical(body))
}

// No I/O apart from the caller's read-only source resolver. The approval source
// must already exist and explicitly describe this exact decision.
export function captureDecisionReceipt(input, existing = [], readSource) {
  if (!exact(input, ['fixture', 'artifact', 'authority', 'decision', 'approved_scope', 'exclusions', 'privacy_rights', 'sources'])) fail('input shape')
  const { fixture, artifact, authority, decision, approved_scope: scope, exclusions, privacy_rights: clearance, sources } = input
  if (!nonempty(fixture?.case_id) || !HASH.test(fixture?.fixture_sha256) || fixtureHash(fixture) !== fixture.fixture_sha256) fail('case or fixture hash')
  if (!fixture.input || fixture.input.case_id !== fixture.case_id || fixture.input.playbook !== fixture.playbook || fixture.input.candidate?.version !== fixture.candidate_version || fixture.input.blocker?.version !== fixture.blocker_version) fail('stale case version')
  const result = proposeRepair(structuredClone(fixture.input))
  if (result.status !== 'proposed' || result.proposal?.external_actions_allowed !== false) fail('unqualified repair')
  if (!exact(artifact, ['version', 'content_path', 'content_sha256', 'artifact_path', 'artifact_sha256', 'pr_number', 'commit_sha']) || !nonempty(artifact.version) || !HASH.test(artifact.content_sha256) || !HASH.test(artifact.artifact_sha256) || !Number.isSafeInteger(artifact.pr_number) || artifact.pr_number < 1 || !COMMIT.test(artifact.commit_sha) || artifact.version !== fixture.candidate_version) fail('artifact binding')
  validSource({ path: artifact.content_path, sha256: artifact.content_sha256 }, readSource)
  validSource({ path: artifact.artifact_path, sha256: artifact.artifact_sha256 }, readSource)
  if (!exact(decision, ['kind', 'before', 'after', 'approved_change', 'rollback']) || decision.kind !== 'approved_repair' || !same(decision.before, { meaning_id: fixture.input.candidate.meaning_id, claim_ids: fixture.input.candidate.claim_ids }) || !same(decision.after, { meaning_id: fixture.input.change.meaning_id, claim_ids: fixture.input.change.claim_ids }) || !same(decision.approved_change, fixture.input.change) || !same(decision.rollback, result.proposal.rollback)) fail('decision binding')
  if (!exact(scope, ['human_qa_decision', 'reviewed_fields', 'approved_fields', 'exclusions']) || !['passed', 'not_required_for_internal_routing'].includes(scope.human_qa_decision) || (scope.human_qa_decision === 'not_required_for_internal_routing' && fixture.playbook !== 'typed_blocker_routing') || !Array.isArray(scope.reviewed_fields) || !scope.reviewed_fields.length || !Array.isArray(scope.approved_fields) || !scope.approved_fields.length || !scope.approved_fields.every((x) => scope.reviewed_fields.includes(x) && Object.hasOwn(decision.approved_change, x)) || !Array.isArray(scope.exclusions) || !scope.exclusions.every(nonempty) || new Set(scope.reviewed_fields).size !== scope.reviewed_fields.length || new Set(scope.approved_fields).size !== scope.approved_fields.length || new Set(scope.exclusions).size !== scope.exclusions.length) fail('scope binding')
  if (!Array.isArray(exclusions) || !same([...exclusions].sort(), [...EXCLUSIONS].sort())) fail('external action exclusions')
  if (!exact(clearance, ['privacy', 'rights', 'reviewed_at']) || clearance.privacy !== 'cleared' || clearance.rights !== 'cleared' || !Number.isFinite(Date.parse(clearance.reviewed_at))) fail('privacy or rights uncertainty')
  if (!Array.isArray(sources) || !sources.length || new Set(sources.map((s) => s.path)).size !== sources.length || !fixture.sources.every((s) => sources.some((x) => same(x, s)))) fail('source set')
  for (const source of sources) validSource(source, readSource)
  if (!exact(authority, ['reviewer_id', 'reviewer_role', 'approved_at', 'source']) || !nonempty(authority.reviewer_id) || authority.reviewer_role !== 'human_repair_approver' || !Number.isFinite(Date.parse(authority.approved_at)) || Date.parse(authority.approved_at) > Date.parse(fixture.as_of) || Date.parse(authority.approved_at) < Date.parse(clearance.reviewed_at)) fail('reviewer authority')
  validSource(authority.source, readSource)
  let approval
  try { approval = JSON.parse(readSource(authority.source.path)) } catch { fail('approval source unreadable') }
  const expectedApproval = { receipt_type: 'explicit_human_repair_approval', case_id: fixture.case_id, candidate_version: fixture.candidate_version, blocker_version: fixture.blocker_version, playbook: fixture.playbook, artifact, reviewer_id: authority.reviewer_id, reviewer_role: authority.reviewer_role, approved_at: authority.approved_at, decision, approved_scope: scope, privacy_rights: clearance, sources }
  if (!same(approval, expectedApproval)) fail('approval source does not bind decision')
  const receipt = { schema_version: 'evidence-repair-decision-receipt/v1', receipt_type: 'approved_evidence_repair_outcome', mode: 'review_only', case_id: fixture.case_id, fixture_sha256: fixture.fixture_sha256, candidate_version: fixture.candidate_version, blocker_version: fixture.blocker_version, playbook: fixture.playbook, artifact, authority, decision, approved_scope: scope, privacy_rights: clearance, sources, external_action_exclusions: [...EXCLUSIONS] }
  receipt.receipt_sha256 = receiptHash(receipt)
  if (!Array.isArray(existing)) fail('existing receipt set')
  for (const prior of existing) {
    if (prior.case_id !== receipt.case_id) continue
    if (!verifyDecisionReceipt(prior, readSource)) fail('existing receipt invalid')
    if (same(prior, receipt)) return { status: 'exact_replay', receipt: structuredClone(prior) }
    fail('conflicting replay for case')
  }
  return { status: 'captured', receipt }
}

export function verifyDecisionReceipt(receipt, readSource) {
  try {
    if (!exact(receipt, ['schema_version', 'receipt_type', 'mode', 'case_id', 'fixture_sha256', 'candidate_version', 'blocker_version', 'playbook', 'artifact', 'authority', 'decision', 'approved_scope', 'privacy_rights', 'sources', 'external_action_exclusions', 'receipt_sha256']) || receipt.schema_version !== 'evidence-repair-decision-receipt/v1' || receipt.receipt_type !== 'approved_evidence_repair_outcome' || receipt.mode !== 'review_only' || !nonempty(receipt.case_id) || !HASH.test(receipt.fixture_sha256) || !HASH.test(receipt.receipt_sha256) || receiptHash(receipt) !== receipt.receipt_sha256 || !Array.isArray(receipt.external_action_exclusions) || !same([...receipt.external_action_exclusions].sort(), [...EXCLUSIONS].sort())) return false
    if (receipt.artifact?.version !== receipt.candidate_version || !COMMIT.test(receipt.artifact?.commit_sha) || !Number.isSafeInteger(receipt.artifact?.pr_number) || receipt.artifact.pr_number < 1 || receipt.authority?.reviewer_role !== 'human_repair_approver' || !nonempty(receipt.authority.reviewer_id) || !Number.isFinite(Date.parse(receipt.authority.approved_at)) || receipt.privacy_rights?.privacy !== 'cleared' || receipt.privacy_rights?.rights !== 'cleared' || !Number.isFinite(Date.parse(receipt.privacy_rights.reviewed_at)) || receipt.decision?.kind !== 'approved_repair') return false
    if (!Array.isArray(receipt.sources) || !receipt.sources.length || new Set(receipt.sources.map((s) => s.path)).size !== receipt.sources.length || !Array.isArray(receipt.approved_scope?.approved_fields) || !receipt.approved_scope.approved_fields.length || !receipt.approved_scope.approved_fields.every((field) => receipt.approved_scope.reviewed_fields?.includes(field) && Object.hasOwn(receipt.decision.approved_change, field))) return false
    validSource(receipt.authority.source, readSource)
    validSource({ path: receipt.artifact.content_path, sha256: receipt.artifact.content_sha256 }, readSource)
    validSource({ path: receipt.artifact.artifact_path, sha256: receipt.artifact.artifact_sha256 }, readSource)
    for (const source of receipt.sources) validSource(source, readSource)
    const approval = JSON.parse(readSource(receipt.authority.source.path))
    return same(approval, { receipt_type: 'explicit_human_repair_approval', case_id: receipt.case_id, candidate_version: receipt.candidate_version, blocker_version: receipt.blocker_version, playbook: receipt.playbook, artifact: receipt.artifact, reviewer_id: receipt.authority.reviewer_id, reviewer_role: receipt.authority.reviewer_role, approved_at: receipt.authority.approved_at, decision: receipt.decision, approved_scope: receipt.approved_scope, privacy_rights: receipt.privacy_rights, sources: receipt.sources })
  } catch { return false }
}

// Local review archive only. The case key is hashed so case IDs cannot become paths.
// Exclusive creation is the only write path; a collision is accepted only if exact.
export function appendDecisionReceipt(directory, input, readSource) {
  if (!nonempty(directory)) fail('archive directory')
  const candidate = captureDecisionReceipt(input, [], readSource).receipt
  const path = join(directory, `${sha(candidate.case_id).slice(7)}.json`)
  mkdirSync(directory, { recursive: true })
  try {
    writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    return { status: 'captured', path, receipt: candidate }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let prior
    try { prior = JSON.parse(readFileSync(path, 'utf8')) } catch { fail('existing receipt unreadable') }
    const replay = captureDecisionReceipt(input, [prior], readSource)
    return { ...replay, path }
  }
}

// Eligibility is informational. It never writes an outcome or upgrades a label.
export function reconciliationEligibility(receipt, fixture, readSource) {
  return { status: fixture && verifyDecisionReceipt(receipt, readSource) && fixture.fixture_sha256 === fixtureHash(fixture) && fixture.case_id === receipt.case_id && fixture.fixture_sha256 === receipt.fixture_sha256 && fixture.candidate_version === receipt.candidate_version && fixture.blocker_version === receipt.blocker_version && fixture.playbook === receipt.playbook ? 'eligible_for_review' : 'ineligible', promoted: false }
}
