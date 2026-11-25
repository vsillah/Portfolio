import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { syntheticCase } from './fixtures.mjs'
import { proposeRepair } from './engine.mjs'
import { fixtureHash, outcomeHash } from './shadow-replay.mjs'
import { reconcile } from './reconcile.mjs'

const sha = (x) => `sha256:${createHash('sha256').update(x).digest('hex')}`
const exclusions = ['provider', 'render', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send', 'approval_mutation']
const corpus = JSON.parse(readFileSync(new URL('./shadow-corpus.json', import.meta.url)))
const empty = JSON.stringify(readFileSync(new URL('./shadow-outcomes.json', import.meta.url)).toString())
function chain() {
  const input = syntheticCase('freshness_renewal')
  input.case_id = 'history:jev-duplicate'
  const approval = { identity: 'synthetic-human', type: 'explicit_human_repair_approval', approved_at: '2026-10-17T15:30:00Z' }
  const human_qa_scope = { decision: 'passed', reviewed_fields: Object.keys(input.change), artifact_version: input.candidate.version }
  const rollback = proposeRepair(input).proposal.rollback
  const before = { meaning_id: input.candidate.meaning_id, claim_ids: [...input.candidate.claim_ids] }
  const after = { meaning_id: input.change.meaning_id, claim_ids: [...input.change.claim_ids] }
  const sourcePath = 'artifacts/synthetic/approval.json'
  const source = { path: sourcePath, sha256: '' }
  const record = JSON.stringify({ receipt_type: 'approved_evidence_repair_outcome', case_id: input.case_id, candidate_version: input.candidate.version, blocker_version: input.blocker.version, playbook: input.playbook, approval, approved_change: input.change, human_qa_scope, before, after, sources: [sourcePath], rollback, external_action_exclusions: exclusions })
  source.sha256 = sha(record)
  const fixture = { case_id: input.case_id, playbook: input.playbook, label_kind: 'approved_outcome', as_of: '2026-10-18T00:00:00Z', candidate_version: input.candidate.version, blocker_version: input.blocker.version, sources: [source], input }
  fixture.fixture_sha256 = fixtureHash(fixture)
  const proposal = proposeRepair(input).proposal
  const outcome = { schema_version: 'approved-repair-outcome/v1', case_id: input.case_id, candidate_version: input.candidate.version, blocker_version: input.blocker.version, playbook: input.playbook, before: { meaning_id: input.candidate.meaning_id, claim_ids: [...input.candidate.claim_ids] }, after: { meaning_id: input.change.meaning_id, claim_ids: [...input.change.claim_ids] }, approved_change: structuredClone(input.change), sources: [source], approval: { ...approval, source_path: source.path, sha256: source.sha256 }, human_qa_scope, rollback: proposal.rollback, external_action_exclusions: [...exclusions] }
  outcome.outcome_sha256 = outcomeHash(outcome)
  const historical = { case_id: input.case_id, playbook: input.playbook, label_kind: 'observation', sources: [source] }
  const read = (path) => { assert.equal(path, source.path); return Buffer.from(record) }
  return { fixture, outcome, historical, read }
}
function run(x, edits = () => {}) {
  const c = structuredClone({ case_id: x.historical.case_id, fixture: x.fixture, outcome: x.outcome })
  edits(c)
  return reconcile({ version: 'phase-5b-shadow-corpus/v1', cases: [x.historical] }, [c], x.read).results[0]
}
test('historical replay stays unresolved and all source hashes verify without writing live state', () => {
  const report = reconcile(corpus)
  assert.deepEqual(report.counts, { proposed_label: 0, unresolved: 7, conflicts: 0 })
  assert.equal(report.source_inventory.length, 11)
  assert.ok(report.results.every((r) => r.missing_bindings.includes('explicit_human_repair_approval')))
  assert.equal(JSON.stringify(readFileSync(new URL('./shadow-outcomes.json', import.meta.url)).toString()), empty)
})
test('complete synthetic chain emits review-only proposed label', () => {
  const x = chain()
  assert.equal(run(x).status, 'proposed_label')
})
test('cross-version mixing, mismatched hashes, and duplicate authority remain unresolved', () => {
  const x = chain()
  assert.ok(run(x, (c) => { c.fixture.blocker_version = 'v2'; c.fixture.fixture_sha256 = fixtureHash(c.fixture) }).conflicts.includes('cross_version_mixing'))
  assert.ok(run(x, (c) => { c.outcome.sources[0].sha256 = sha('wrong'); c.outcome.outcome_sha256 = outcomeHash(c.outcome) }).conflicts.includes('historical_source_not_bound'))
  const doubled = reconcile({ version: 'phase-5b-shadow-corpus/v1', cases: [x.historical] }, [{ case_id: x.historical.case_id, fixture: x.fixture, outcome: x.outcome }, { case_id: x.historical.case_id, fixture: x.fixture, outcome: x.outcome }], x.read)
  assert.deepEqual(doubled.results[0].conflicts, ['duplicate_authority'])
})
test('general or partial approvals, missing scope and rollback fail closed', () => {
  const x = chain()
  for (const [edit, binding] of [
    [(o) => { o.approval.type = 'general_campaign_approval' }, 'missing_human_approval_authority'],
    [(o) => { o.approval.identity = '' }, 'missing_human_approval_authority'],
    [(o) => { o.human_qa_scope.reviewed_fields = [] }, 'missing_human_qa_scope'],
    [(o) => { delete o.rollback }, 'rollback_incomplete_or_mismatch'],
    [(o) => { o.external_action_exclusions.pop() }, 'all_eight_external_action_exclusions']
  ]) {
    const result = run(x, (c) => { edit(c.outcome); c.outcome.outcome_sha256 = outcomeHash(c.outcome) })
    assert.equal(result.status, 'unresolved')
    assert.ok(result.missing_bindings.includes(binding), `${binding}: ${result.missing_bindings}`)
  }
})
test('every external lock and privacy-safe source reference is enforced', () => {
  const x = chain()
  for (const lock of exclusions) {
    const result = run(x, (c) => { c.outcome.external_action_exclusions = exclusions.filter((v) => v !== lock); c.outcome.outcome_sha256 = outcomeHash(c.outcome) })
    assert.ok(result.missing_bindings.includes('all_eight_external_action_exclusions'), lock)
  }
  const bad = structuredClone(x.historical)
  bad.sources = [{ path: '/private/chat.txt', sha256: x.historical.sources[0].sha256 }]
  assert.throws(() => reconcile({ version: 'phase-5b-shadow-corpus/v1', cases: [bad] }, [], x.read), /unsafe source reference/)
})
