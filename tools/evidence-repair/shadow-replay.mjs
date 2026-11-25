import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, relative, isAbsolute } from 'node:path'
import { proposeRepair } from './engine.mjs'
import { PLAYBOOKS } from './playbooks.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../..')
const retained = '/Users/vambahsillah/Projects/Portfolio'
const HASH = /^sha256:[a-f0-9]{64}$/
const EXCLUSIONS = ['provider', 'render', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send', 'approval_mutation']
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const canonical = (value) => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const nonempty = (s) => typeof s === 'string' && s.trim().length > 0
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|')
const sourceRoot = (path) => {
  if (!nonempty(path) || isAbsolute(path) || path.split('/').includes('..')) throw new Error(`unsafe source path: ${path}`)
  const local = resolve(repo, path)
  const main = resolve(retained, path)
  for (const target of [local, main]) {
    if (relative(target === local ? repo : retained, target).startsWith('..')) continue
    try { return readFileSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  throw new Error(`source unavailable: ${path}`)
}
export function verifySource(source, readSource = sourceRoot) {
  if (!exactKeys(source, ['path', 'sha256']) || !HASH.test(source.sha256)) throw new Error('invalid source binding')
  if (sha(readSource(source.path)) !== source.sha256) throw new Error(`source hash mismatch: ${source.path}`)
}
const fields = (object, keys) => keys.filter((key) => !nonempty(object?.[key]))
const meaning = (value) => exactKeys(value, ['meaning_id', 'claim_ids']) && nonempty(value.meaning_id) && Array.isArray(value.claim_ids) && value.claim_ids.length && value.claim_ids.every(nonempty) && new Set(value.claim_ids).size === value.claim_ids.length

// The digest excludes its own field; every other byte-equivalent value is bound.
export function outcomeHash(outcome) {
  const { outcome_sha256, ...body } = outcome
  return sha(canonical(body))
}
export function validateOutcome(outcome, fixture, proposal, readSource = sourceRoot) {
  if (!outcome) return ['missing_explicit_approved_outcome']
  const errors = []
  const required = ['schema_version', 'case_id', 'candidate_version', 'blocker_version', 'playbook', 'before', 'after', 'approved_change', 'sources', 'approval', 'human_qa_scope', 'rollback', 'external_action_exclusions', 'outcome_sha256']
  if (!exactKeys(outcome, required) || outcome.schema_version !== 'approved-repair-outcome/v1') errors.push('outcome_schema')
  if (!HASH.test(outcome.outcome_sha256) || outcomeHash(outcome) !== outcome.outcome_sha256) errors.push('outcome_hash')
  for (const key of ['case_id', 'playbook']) if (outcome[key] !== fixture[key]) errors.push(`${key}_mismatch`)
  if (outcome.candidate_version !== fixture.input?.candidate?.version) errors.push('candidate_version_mismatch')
  if (outcome.blocker_version !== fixture.input?.blocker?.version) errors.push('blocker_version_mismatch')
  if (!meaning(outcome.before) || !meaning(outcome.after)) errors.push('meaning_schema')
  if (!outcome.approved_change || typeof outcome.approved_change !== 'object' || Array.isArray(outcome.approved_change)) errors.push('approved_change_schema')
  if (!same(outcome.before, { meaning_id: fixture.input?.candidate?.meaning_id, claim_ids: fixture.input?.candidate?.claim_ids })) errors.push('before_meaning_or_claim_mismatch')
  if (!same(outcome.after, { meaning_id: outcome.approved_change?.meaning_id, claim_ids: outcome.approved_change?.claim_ids })) errors.push('after_meaning_or_claim_mismatch')
  if (!Array.isArray(outcome.sources) || !outcome.sources.length || new Set(outcome.sources.map((s) => s.path)).size !== outcome.sources.length) errors.push('source_binding')
  else for (const source of outcome.sources) { try { verifySource(source, readSource) } catch (error) { errors.push(error.message) } }
  if (!fixture.sources.every((source) => outcome.sources?.some((bound) => same(source, bound)))) errors.push('fixture_sources_not_bound')
  if (!exactKeys(outcome.approval, ['identity', 'type', 'approved_at', 'source_path', 'sha256']) || !nonempty(outcome.approval.identity) || outcome.approval.type !== 'explicit_human_repair_approval' || !Number.isFinite(Date.parse(outcome.approval.approved_at))) errors.push('missing_human_approval_authority')
  else {
    const approvalSource = { path: outcome.approval.source_path, sha256: outcome.approval.sha256 }
    try {
      verifySource(approvalSource, readSource)
      const record = JSON.parse(readSource(approvalSource.path))
      if (record.receipt_type !== 'approved_evidence_repair_outcome' || record.case_id !== outcome.case_id || record.candidate_version !== outcome.candidate_version || record.blocker_version !== outcome.blocker_version || record.playbook !== outcome.playbook || record.approval?.identity !== outcome.approval.identity || record.approval?.type !== outcome.approval.type || record.approval?.approved_at !== outcome.approval.approved_at || !same(record.approved_change, outcome.approved_change) || !same(record.human_qa_scope, outcome.human_qa_scope)) errors.push('approval_receipt_not_explicitly_bound')
    } catch (error) { errors.push(error.message) }
    if (!outcome.sources.some((s) => same(s, approvalSource))) errors.push('approval_provenance_not_bound')
    if (Number.isFinite(Date.parse(fixture.as_of)) && Date.parse(outcome.approval.approved_at) > Date.parse(fixture.as_of)) errors.push('approval_after_replay_cutoff')
  }
  const scope = outcome.human_qa_scope
  const reviewed = scope?.reviewed_fields
  if (!exactKeys(scope, ['decision', 'reviewed_fields', 'artifact_version']) || !['passed', 'not_required_for_internal_routing'].includes(scope.decision) || !Array.isArray(reviewed) || reviewed.length > 16 || reviewed.some((field) => !nonempty(field)) || new Set(reviewed).size !== reviewed.length || (scope.decision === 'passed' && reviewed.length === 0) || !nonempty(scope.artifact_version) || (scope.decision === 'not_required_for_internal_routing' && fixture.playbook !== 'typed_blocker_routing')) errors.push('missing_human_qa_scope')
  if (!proposal || !same(outcome.rollback, proposal.rollback)) errors.push('rollback_incomplete_or_mismatch')
  if (!Array.isArray(outcome.external_action_exclusions) || !same([...outcome.external_action_exclusions].sort(), [...EXCLUSIONS].sort())) errors.push('external_action_exclusions_incomplete')
  if (proposal && (!proposal.rollback?.previous_state_hash || proposal.external_actions_allowed !== false || proposal.mode !== 'shadow_review_only')) errors.push('unsafe_proposal')
  return [...new Set(errors)]
}
const flatten = (value, prefix = '') => Object.entries(value || {}).flatMap(([key, item]) => item && typeof item === 'object' && !Array.isArray(item) ? flatten(item, `${prefix}${key}.`) : [[`${prefix}${key}`, item]])
export function compareOutcome(proposal, outcome) {
  const actual = Object.fromEntries(flatten({ after: { meaning_id: proposal.proposed_change.meaning_id, claim_ids: proposal.proposed_change.claim_ids }, change: proposal.proposed_change }))
  const expected = Object.fromEntries(flatten({ after: outcome.after, change: outcome.approved_change || {} }))
  const disagreements = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].filter((key) => !same(actual[key], expected[key])).sort()
  if (!disagreements.length) return { classification: 'exact_match', disagreements }
  const protectedField = disagreements.some((key) => key.startsWith('after.') || key === 'change.meaning_id' || key === 'change.claim_ids' || key === 'change.product_id')
  return { classification: protectedField ? 'unsupported_change' : 'bounded_disagreement', disagreements }
}
export function fixtureHash(fixture) { const { fixture_sha256, ...body } = fixture; return sha(canonical(body)) }
export function replayCase(fixture, outcomes = [], readSource = sourceRoot) {
  if (!nonempty(fixture.case_id) || !PLAYBOOKS[fixture.playbook] || !['approved_outcome', 'expected_unresolved', 'observation'].includes(fixture.label_kind)) throw new Error(`invalid fixture: ${fixture.case_id}`)
  if (!HASH.test(fixture.fixture_sha256) || fixtureHash(fixture) !== fixture.fixture_sha256) throw new Error(`fixture hash mismatch: ${fixture.case_id}`)
  for (const source of fixture.sources) verifySource(source, readSource)
  const labels = outcomes.filter((outcome) => outcome.case_id === fixture.case_id)
  if (labels.length > 1) return { case_id: fixture.case_id, classification: 'insufficient_label', missing_bindings: ['duplicate_approved_outcomes'], disagreements: [] }
  const input = fixture.input ? structuredClone(fixture.input) : { case_id: fixture.case_id, playbook: fixture.playbook, now: fixture.as_of, blocker: { type: fixture.playbook, version: fixture.blocker_version }, candidate: { id: fixture.case_id, version: fixture.candidate_version, meaning_id: 'unknown', product_id: 'unknown', claim_ids: ['observed-only'] }, evidence: [], change: null }
  const before = JSON.stringify(input)
  const result = proposeRepair(input)
  if (JSON.stringify(input) !== before) throw new Error(`candidate mutated: ${fixture.case_id}`)
  if (result.proposal && result.proposal.external_actions_allowed !== false) throw new Error(`external execution enabled: ${fixture.case_id}`)
  if (fixture.label_kind === 'expected_unresolved' && !labels.length && result.status === 'unresolved') return { case_id: fixture.case_id, classification: 'expected_unresolved', missing_bindings: [], disagreements: [], engine_reason: result.reason }
  const outcome = labels[0]
  const missing = outcome ? validateOutcome(outcome, fixture, result.proposal, readSource) : fixture.missing_bindings || ['missing_explicit_approved_outcome']
  if (missing.length) return { case_id: fixture.case_id, classification: 'insufficient_label', missing_bindings: missing, disagreements: [], engine_reason: result.reason }
  if (result.status !== 'proposed') return { case_id: fixture.case_id, classification: 'bounded_disagreement', missing_bindings: [], disagreements: ['proposal.status'], engine_reason: result.reason }
  return { case_id: fixture.case_id, ...compareOutcome(result.proposal, outcome), missing_bindings: [] }
}
export function replay(corpus, outcomes = [], readSource = sourceRoot) {
  if (corpus.version !== 'phase-5b-shadow-corpus/v1' || !Array.isArray(corpus.cases)) throw new Error('invalid corpus')
  const ids = corpus.cases.map((item) => item.case_id)
  if (new Set(ids).size !== ids.length) throw new Error('duplicate fixture case')
  if (outcomes.some((outcome) => !ids.includes(outcome.case_id))) throw new Error('approved outcome has no fixture')
  const results = corpus.cases.map((fixture) => replayCase(fixture, outcomes, readSource))
  const counts = Object.fromEntries(['exact_match', 'bounded_disagreement', 'unsupported_change', 'expected_unresolved', 'insufficient_label'].map((key) => [key, results.filter((r) => r.classification === key).length]))
  const labeled = counts.exact_match + counts.bounded_disagreement + counts.unsupported_change
  const proposed = labeled
  const disagreement_by_field = {}
  for (const result of results) for (const key of result.disagreements) disagreement_by_field[key] = (disagreement_by_field[key] || 0) + 1
  return { version: 'phase-5b-shadow-replay/v1', mode: 'shadow_provider_free_read_only', metrics: { cases: results.length, labeled_cases: labeled, unlabeled_cases: results.length - labeled, labeled_case_precision: proposed ? counts.exact_match / proposed : null, unsupported_change_rate: proposed ? counts.unsupported_change / proposed : null, counts, disagreement_by_field, playbook_coverage: [...new Set(corpus.cases.map((c) => c.playbook))].sort(), source_categories: [...new Set(corpus.cases.map((c) => c.category))].sort() }, results, limits: ['Historical observations and passing review states do not establish repair approval.', 'Precision and unsupported-change rate are null until explicit version-bound approved outcomes are verified.', 'Source verification is local and read-only; no provider or production state is queried.'] }
}
export function renderMarkdown(report) {
  const m = report.metrics
  return ['# Phase 5B shadow replay', '', `Cases: ${m.cases}; labeled: ${m.labeled_cases}; unlabeled: ${m.unlabeled_cases}.`, `Labeled-case precision: ${m.labeled_case_precision ?? 'unavailable'}; unsupported-change rate: ${m.unsupported_change_rate ?? 'unavailable'}.`, `Classifications: ${Object.entries(m.counts).map(([k, v]) => `${k} ${v}`).join(', ')}.`, `Playbook coverage: ${m.playbook_coverage.join(', ')}.`, `Source categories: ${m.source_categories.join(', ')}.`, '', '## Cases', '', ...report.results.map((r) => `- ${r.case_id}: ${r.classification}${r.missing_bindings.length ? `; missing ${r.missing_bindings.join(', ')}` : ''}${r.disagreements.length ? `; disagreement ${r.disagreements.join(', ')}` : ''}.`), '', '## Limits', '', ...report.limits.map((l) => `- ${l}`), ''].join('\n')
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const corpus = JSON.parse(readFileSync(new URL('./shadow-corpus.json', import.meta.url)))
  const approved = JSON.parse(readFileSync(new URL('./shadow-outcomes.json', import.meta.url)))
  if (approved.version !== 'phase-5b-approved-outcomes/v1' || !Array.isArray(approved.outcomes)) throw new Error('invalid approved outcomes package')
  const report = replay(corpus, approved.outcomes)
  writeFileSync(new URL('./shadow-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(new URL('./shadow-report.md', import.meta.url), renderMarkdown(report))
}
