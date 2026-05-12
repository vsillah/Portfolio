#!/usr/bin/env tsx
import {
  buildBannedBooksCorpusProjection,
  formatBannedBooksCorpusReport,
} from '../lib/banned-books-corpus'

export function parseArgs(argv: string[]) {
  const options = {
    json: false,
  }

  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run banned-books:report -- [options]

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

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const projection = buildBannedBooksCorpusProjection()

  if (options.json) {
    console.log(JSON.stringify(projection, null, 2))
    return
  }

  console.log(formatBannedBooksCorpusReport(projection))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
