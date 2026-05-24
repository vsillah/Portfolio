#!/usr/bin/env tsx
import { buildBannedBooksSourceIngestionProjection } from '../lib/banned-books-corpus'

export function parseArgs(argv: string[]) {
  const options = {
    json: false,
  }

  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run banned-books:ingestion:report -- [options]

Options:
  --json  Print machine-readable output.
`)
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

export function formatBannedBooksSourceIngestionReport(
  projection = buildBannedBooksSourceIngestionProjection()
): string {
  return [
    '# Banned Books Source Ingestion Queue',
    '',
    `Generated: ${projection.generatedAt}`,
    `Mode: ${projection.mode}`,
    `Policy: ${projection.policy}`,
    '',
    '## Summary',
    '',
    `- Sources queued: ${projection.summary.sourceCount}`,
    `- Discovery candidates: ${projection.summary.candidateCount}`,
    `- Existing record matches: ${projection.summary.existingRecordMatches}`,
    `- Stageable candidates: ${projection.summary.stageableCandidates}`,
    `- Evidence review required: ${projection.summary.evidenceReviewRequired}`,
    `- Blocked full-text actions: ${projection.summary.blockedFullTextActions}`,
    '',
    '## Sources',
    '',
    ...projection.sources.map((source) =>
      `- ${source.name} (${source.key}): refresh every ${source.refreshCadenceDays} days via ${source.fetchMode}`
    ),
    '',
    '## Candidates',
    '',
    ...projection.candidates.map((candidate) =>
      `- ${candidate.canonicalTitle} by ${candidate.authors.join(', ')}: ${candidate.status}; ${candidate.nextAction}`
    ),
    '',
    '## Blocked Actions',
    '',
    ...projection.blockedActions.map((action) => `- ${action}`),
  ].join('\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const projection = buildBannedBooksSourceIngestionProjection()

  if (options.json) {
    console.log(JSON.stringify(projection, null, 2))
    return
  }

  console.log(formatBannedBooksSourceIngestionReport(projection))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
