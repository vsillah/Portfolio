#!/usr/bin/env tsx
import { recordManuscriptChapterSummaries } from '../lib/open-brain-manuscript-summaries'

function parseArgs(argv: string[]) {
  const args = argv.includes('--') ? argv.slice(argv.indexOf('--') + 1) : argv.slice(2)
  const options: {
    write: boolean
    openBrainHome?: string
    exportDir?: string
  } = {
    write: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--write') options.write = true
    if (arg === '--open-brain-home') options.openBrainHome = args[index + 1]
    if (arg === '--export-dir') options.exportDir = args[index + 1]
  }

  return options
}

async function main() {
  const options = parseArgs(process.argv)
  const result = await recordManuscriptChapterSummaries(options)
  const output = {
    status: result.status,
    reason: result.reason,
    openBrainHome: result.openBrainHome,
    exportDir: result.exportDir,
    overview: result.overview,
    missingExports: result.missingExports,
    memories: result.memories.map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      title: memory.title,
      privacyTier: memory.privacyTier,
      sourceIds: memory.sourceIds,
      fingerprint: memory.fingerprint,
    })),
    events: result.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      title: event.title,
      privacyTier: event.privacyTier,
      sourceIds: event.sourceIds,
      fingerprint: event.fingerprint,
      metadata: event.metadata,
    })),
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  if (result.status === 'missing') process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-manuscript-summarizer] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
