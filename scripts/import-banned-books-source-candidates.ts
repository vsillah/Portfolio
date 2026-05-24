#!/usr/bin/env tsx
import {
  buildBannedBooksSourceImportPlan,
  loadBannedBooksSourceImportFile,
} from '../lib/banned-books-source-importer'

export function parseArgs(argv: string[]) {
  const options = {
    input: 'data/source-protocol/banned-books-source-import-sample.json',
    json: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      const value = argv[index + 1]
      if (!value) throw new Error('--input requires a path')
      options.input = value
      index += 1
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run banned-books:source:import -- [options]

Options:
  --input <path>  Manual/public metadata export JSON file.
  --json          Print machine-readable dry-run output.
`)
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

export function formatBannedBooksSourceImportPlan(plan: ReturnType<typeof buildBannedBooksSourceImportPlan>): string {
  return [
    '# Banned Books Source Import Dry Run',
    '',
    `Generated: ${plan.generatedAt}`,
    `Source: ${plan.sourceKey}`,
    `Dry run: ${String(plan.dryRun)}`,
    '',
    '## Summary',
    '',
    `- Rows: ${plan.summary.rows}`,
    `- Existing records: ${plan.summary.existingRecords}`,
    `- Duplicate queue rows: ${plan.summary.duplicateQueueRows}`,
    `- Ready for QA: ${plan.summary.readyForQa}`,
    `- Needs evidence review: ${plan.summary.needsEvidenceReview}`,
    `- Rejected rows: ${plan.summary.rejectedRows}`,
    `- Queue append drafts: ${plan.summary.queueAppendDrafts}`,
    '',
    '## Rows',
    '',
    ...plan.rows.map((row) => `- ${row.canonicalTitle} by ${row.authors.join(', ')}: ${row.status}; ${row.reason}`),
    '',
    '## Blocked Actions',
    '',
    ...plan.blockedActions.map((action) => `- ${action}`),
  ].join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const importFile = loadBannedBooksSourceImportFile(options.input)
  const plan = buildBannedBooksSourceImportPlan(importFile)

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  console.log(formatBannedBooksSourceImportPlan(plan))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
