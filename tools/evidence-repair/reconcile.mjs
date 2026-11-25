import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, relative } from 'node:path'
import { proposeRepair } from './engine.mjs'
import { fixtureHash, outcomeHash, validateOutcome, verifySource } from './shadow-replay.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '../..')
const retained = '/Users/vambahsillah/Projects/Portfolio'
const exclusions = ['provider', 'render', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send', 'approval_mutation']
const safePath = (path) => typeof path === 'string' && /^(artifacts|tools\/evidence-repair)\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').includes('..')
const readRetained = (path) => {
  if (!safePath(path)) throw new Error('unsafe source reference')
  for (const root of [repo, retained]) {
    const target = resolve(root, path)
    if (relative(root, target).startsWith('..')) continue
    try { return readFileSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  throw new Error(`source unavailable: ${path}`)
}
const supplemental = {
  'history:jev-duplicate': ['approved_angle_review_receipt'],
  'history:production-blocker': ['version_bound_blocker', 'approved_owner_and_next_gate'],
  'history:description-review': ['qualified_replacement_candidate'],
  'history:platform-draft': ['version_bound_blocker', 'approved_owner_and_next_gate'],
  'history:dark-castle-visual': ['production_bound_asset']
}
const common = ['candidate_version', 'blocker_version', 'before_meaning_id', 'before_claim_ids', 'after_meaning_id', 'after_claim_ids', 'approved_change_and_reviewed_fields', 'explicit_human_repair_approval', 'approval_identity_type_timestamp', 'approval_source_hash_and_provenance', 'human_qa_decision_scope', 'phase_5a_matching_rollback', 'all_eight_external_action_exclusions']
const unique = (items) => [...new Set(items)].sort()

// Chains must contain a complete source-bound fixture and an explicit approval outcome.
// Historical observations alone never become labels.
export function reconcile(corpus, chains = [], readSource = readRetained) {
  if (corpus.version !== 'phase-5b-shadow-corpus/v1' || !Array.isArray(corpus.cases) || !Array.isArray(chains)) throw new Error('invalid reconciliation input')
  const ids = corpus.cases.map((c) => c.case_id)
  if (new Set(ids).size !== ids.length) throw new Error('duplicate historical case')
  if (chains.some((c) => !ids.includes(c.case_id))) throw new Error('unknown case chain')
  const sources = unique(corpus.cases.flatMap((c) => c.sources.map((s) => s.path))).map((path) => {
    if (!safePath(path)) throw new Error('unsafe source reference')
    const bindings = corpus.cases.flatMap((c) => c.sources.filter((s) => s.path === path))
    if (new Set(bindings.map((s) => s.sha256)).size !== 1) throw new Error(`conflicting source hash: ${path}`)
    const source = bindings[0]
    verifySource(source, readSource)
    return { path, sha256: source.sha256, cases: unique(corpus.cases.filter((c) => c.sources.some((s) => s.path === path)).map((c) => c.case_id)) }
  })
  const results = corpus.cases.filter((c) => c.label_kind === 'observation').map((historical) => {
    const matches = chains.filter((c) => c.case_id === historical.case_id)
    const conflicts = []
    let missing = []
    let outcome = null
    if (matches.length > 1) conflicts.push('duplicate_authority')
    else if (matches.length === 1) {
      const chain = matches[0]
      const fixture = chain.fixture
      outcome = chain.outcome
      if (!fixture || !outcome) missing.push('complete_fixture_and_outcome')
      else {
        if (fixture.case_id !== historical.case_id || fixture.playbook !== historical.playbook) conflicts.push('case_or_playbook_mismatch')
        if (![...(fixture.sources || []), ...(outcome.sources || []), { path: outcome.approval?.source_path }].every((s) => safePath(s.path))) conflicts.push('unsafe_source_reference')
        if (fixture.fixture_sha256 !== fixtureHash(fixture)) conflicts.push('fixture_hash_mismatch')
        if (fixture.candidate_version !== outcome.candidate_version || fixture.blocker_version !== outcome.blocker_version) conflicts.push('cross_version_mixing')
        if (historical.sources.some((s) => !fixture.sources?.some((x) => x.path === s.path && x.sha256 === s.sha256))) conflicts.push('historical_source_not_bound')
        if (!conflicts.length) {
          const proposal = proposeRepair(structuredClone(fixture.input || {}))
          if (proposal.status !== 'proposed') missing.push('phase_5a_qualified_proposal')
          missing.push(...validateOutcome(outcome, fixture, proposal.proposal, readSource))
          try {
            const record = JSON.parse(readSource(outcome.approval.source_path))
            const exact = (a, b) => JSON.stringify(a) === JSON.stringify(b)
            if (!exact(record.before, outcome.before) || !exact(record.after, outcome.after) || !exact(record.sources, outcome.sources.map((s) => s.path)) || !exact(record.rollback, outcome.rollback) || !exact(record.external_action_exclusions, outcome.external_action_exclusions)) missing.push('approval_receipt_incomplete_evidence_chain')
          } catch { missing.push('approval_receipt_incomplete_evidence_chain') }
          if (outcome.outcome_sha256 !== outcomeHash(outcome)) conflicts.push('outcome_hash_mismatch')
          if (!Array.isArray(outcome.external_action_exclusions) || unique(outcome.external_action_exclusions).join('|') !== unique(exclusions).join('|')) missing.push('all_eight_external_action_exclusions')
        }
      }
    } else missing = [...common, ...(supplemental[historical.case_id] || [])]
    return { case_id: historical.case_id, playbook: historical.playbook, status: !missing.length && !conflicts.length ? 'proposed_label' : 'unresolved', missing_bindings: unique(missing), conflicts: unique(conflicts), source_paths: historical.sources.map((s) => s.path).sort(), proposed_outcome: !missing.length && !conflicts.length ? outcome : undefined }
  })
  return { version: 'phase-5c-reconciliation/v1', mode: 'review_only', source_inventory: sources, results, counts: { proposed_label: results.filter((r) => r.status === 'proposed_label').length, unresolved: results.filter((r) => r.status === 'unresolved').length, conflicts: results.filter((r) => r.conflicts.length).length }, exclusions, limits: ['A proposed label is not an approved outcome or shadow replay input.', 'Read-only retained evidence and synthetic tests only; no live state changes.'] }
}
export function renderReport(report) {
  return ['# Phase 5C outcome label reconciliation', '', `Proposed labels: ${report.counts.proposed_label}; unresolved: ${report.counts.unresolved}; conflicts: ${report.counts.conflicts}.`, `Source coverage: ${report.source_inventory.length} verified files across ${report.results.length} insufficient-label cases.`, '', '## Cases', '', ...report.results.map((r) => `- ${r.case_id}: ${r.status}; missing ${r.missing_bindings.join(', ') || 'none'}; conflicts ${r.conflicts.join(', ') || 'none'}.`), '', '## Next evidence capture', '', 'Capture one immutable, case-specific approval receipt at the decision: candidate and blocker versions, before/after meaning and claim IDs, exact approved change and reviewed fields, human identity/type/time, source hashes, Human QA scope, Phase 5A rollback, and all eight external-action exclusions. Bind the receipt to the same source set and version; keep it separate from shadow-outcomes until explicit ratification.', '', '## Limits', '', ...report.limits.map((x) => `- ${x}`), ''].join('\n')
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const corpus = JSON.parse(readFileSync(new URL('./shadow-corpus.json', import.meta.url)))
  const chains = JSON.parse(readFileSync(new URL('./reconciliation-chains.json', import.meta.url)))
  if (chains.version !== 'phase-5c-evidence-chains/v1' || !Array.isArray(chains.chains)) throw new Error('invalid evidence chains')
  const report = reconcile(corpus, chains.chains)
  writeFileSync(new URL('./reconciliation-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(new URL('./reconciliation-report.md', import.meta.url), renderReport(report))
  writeFileSync(new URL('./proposed-outcomes.json', import.meta.url), `${JSON.stringify({ version: 'phase-5c-proposed-outcomes/v1', status: 'review_only_not_approved', outcomes: report.results.filter((r) => r.status === 'proposed_label').map((r) => r.proposed_outcome) }, null, 2)}\n`)
}
