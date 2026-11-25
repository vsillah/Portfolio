import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { proposeRepair } from './engine.mjs'
import { syntheticCase, HISTORICAL_CASES } from './fixtures.mjs'
import { PLAYBOOK_IDS } from './playbooks.mjs'

export function evaluate() {
  const synthetic = PLAYBOOK_IDS.flatMap((id) => [
    { input: syntheticCase(id), expected: 'proposed' },
    { input: syntheticCase(id, 'meaning_change'), expected: 'unresolved' },
    { input: syntheticCase(id, 'hash_tamper'), expected: 'unresolved' }
  ])
  const results = synthetic.map(({ input, expected }) => {
    const actual = proposeRepair(input)
    return { case_id: input.case_id, expected, actual: actual.status, reason: actual.reason, disagreement: actual.status !== expected }
  })
  const proposals = results.filter((item) => item.actual === 'proposed')
  const trueProposals = proposals.filter((item) => item.expected === 'proposed')
  const unsupported = proposals.filter((item) => item.expected !== 'proposed')
  const historical = HISTORICAL_CASES.map((item) => {
    // A read-only historical fixture deliberately contains only observed facts.
    // The engine must reject it when the required approved receipts are absent.
    const actual = proposeRepair({ case_id: item.case_id, playbook: item.playbook, now: '2026-10-17T16:00:00Z', blocker: { type: item.playbook, version: 'historical-observation-v1' }, candidate: { id: item.case_id, version: 'historical-observation-v1', meaning_id: 'unknown', product_id: 'unknown', claim_ids: ['observed-only'] }, evidence: [], change: null })
    return { ...item, actual: actual.status, engine_reason: actual.reason, disagreement: actual.status !== item.expected }
  })
  return {
    version: 'phase-5a-evaluation/v1', mode: 'shadow_provider_free',
    metrics: { precision: proposals.length ? trueProposals.length / proposals.length : null, unsupported_change_rate: proposals.length ? unsupported.length / proposals.length : null, proposed: proposals.length, synthetic_cases: synthetic.length, historical_cases: historical.length, unresolved_cases: results.filter((item) => item.actual === 'unresolved').length + historical.length, disagreements: results.filter((item) => item.disagreement).length + historical.filter((item) => item.disagreement).length },
    synthetic: results, historical,
    limits: ['Historical recordings are observations, not approvals.', 'No approved repair outcomes are established for the retained historical corpus.', 'Synthetic precision measures rule consistency only; it is not production accuracy.']
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = evaluate()
  writeFileSync(new URL('./evaluation.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`)
  const lines = [
    '# Phase 5A shadow evaluation', '',
    `Synthetic cases: ${report.metrics.synthetic_cases}; historical observations: ${report.metrics.historical_cases}.`,
    `Precision on synthetic proposed cases: ${report.metrics.precision}; unsupported change rate: ${report.metrics.unsupported_change_rate}.`,
    `Unresolved: ${report.metrics.unresolved_cases}; disagreements: ${report.metrics.disagreements}.`, '',
    'Historical cases remain unresolved because the retained evidence does not establish approved repair outcomes:',
    ...report.historical.map((item) => `- ${item.case_id}: ${item.recorded_state}. ${item.reason}`), '',
    ...report.limits.map((item) => `- Limit: ${item}`), ''
  ]
  writeFileSync(new URL('./evaluation.md', import.meta.url), lines.join('\n'))
}
