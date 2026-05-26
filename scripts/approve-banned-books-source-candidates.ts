#!/usr/bin/env tsx
import {
  applyEvidenceQaQueueAppends,
  buildEvidenceQaApprovalPlanFromFiles,
  type EvidenceQaApprovalPlan,
} from '../lib/banned-books-evidence-qa'

export function parseArgs(argv: string[]) {
  const options = {
    input: 'data/source-protocol/banned-books-source-import-sample.json',
    approvals: 'data/source-protocol/banned-books-evidence-qa-approvals.sample.json',
    queue: 'data/source-protocol/banned-books-source-ingestion-queue.json',
    apply: false,
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      const value = argv[index + 1]
      if (!value) throw new Error('--input requires a path')
      options.input = value
      index += 1
    } else if (arg === '--approvals') {
      const value = argv[index + 1]
      if (!value) throw new Error('--approvals requires a path')
      options.approvals = value
      index += 1
    } else if (arg === '--queue') {
      const value = argv[index + 1]
      if (!value) throw new Error('--queue requires a path')
      options.queue = value
      index += 1
    } else if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npx tsx scripts/approve-banned-books-source-candidates.ts [options]

Options:
  --input <path>      Source metadata import JSON file.
  --approvals <path>  Evidence QA approval packet JSON file.
  --queue <path>      Source ingestion queue JSON file for --apply.
  --apply             Append approved metadata-only candidates to the local queue JSON.
  --json              Print machine-readable output.
`)
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

export function formatEvidenceQaApprovalPlan(plan: EvidenceQaApprovalPlan): string {
  return [
    '# Banned Books Evidence QA Approval Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Reviewer: ${plan.reviewer}`,
    `Dry run: ${String(plan.dryRun)}`,
    '',
    '## Summary',
    '',
    `- Import rows: ${plan.summary.importRows}`,
    `- Decisions: ${plan.summary.decisions}`,
    `- Approved queue appends: ${plan.summary.approvedQueueAppends}`,
    `- Needs more evidence: ${plan.summary.needsMoreEvidence}`,
    `- Rejected: ${plan.summary.rejected}`,
    `- Blocked: ${plan.summary.blocked}`,
    `- Already queued: ${plan.summary.alreadyQueued}`,
    '',
    '## Rows',
    '',
    ...plan.rows.map((row) =>
      `- ${row.canonicalTitle} (${row.externalId}): ${row.decision}; ${row.approved ? 'append draft ready' : row.reason}`
    ),
    '',
    '## Blocked Actions',
    '',
    ...plan.blockedActions.map((action) => `- ${action}`),
  ].join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const plan = buildEvidenceQaApprovalPlanFromFiles(options.input, options.approvals, { dryRun: !options.apply })
  const applyResult = options.apply ? applyEvidenceQaQueueAppends(plan, options.queue) : null

  if (options.json) {
    console.log(JSON.stringify({ plan, applyResult }, null, 2))
    return
  }

  console.log(formatEvidenceQaApprovalPlan(plan))
  if (applyResult) {
    console.log('')
    console.log(`Applied: appended ${applyResult.appended}; skipped existing ${applyResult.skippedExisting}; queue ${applyResult.queuePath}`)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
