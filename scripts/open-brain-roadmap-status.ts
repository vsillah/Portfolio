#!/usr/bin/env tsx
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import {
  buildOpenBrainRoadmapStatus,
  formatOpenBrainRoadmapStatusMarkdown,
} from '../lib/open-brain-roadmap-status'

function parseArgs(argv: string[]) {
  const options = {
    json: false,
    write: null as string | null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--write' && next) {
      options.write = next
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run open-brain:roadmap-status -- [options]

Options:
  --json          Print machine-readable roadmap status.
  --write <path>  Write markdown report to a repo-relative or absolute path.
`)
      process.exit(0)
    }
  }

  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const status = buildOpenBrainRoadmapStatus()
  if (options.json) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`)
    return
  }

  const markdown = formatOpenBrainRoadmapStatusMarkdown(status)
  if (options.write) {
    const outputPath = path.isAbsolute(options.write)
      ? options.write
      : path.join(process.cwd(), options.write)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${markdown}\n`, 'utf8')
    process.stdout.write(`Wrote ${outputPath}\n`)
    return
  }

  process.stdout.write(`${markdown}\n`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-roadmap-status] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
