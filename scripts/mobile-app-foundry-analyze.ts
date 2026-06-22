#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  analyzeMobileAppFoundryBacklog,
  type MobileFoundryAnalystInput,
} from '@/lib/mobile-app-foundry-analyst'

export type MobileAppFoundryAnalyzeOptions = {
  input: string
  output?: string
}

export function parseArgs(argv: string[]): MobileAppFoundryAnalyzeOptions {
  const options: MobileAppFoundryAnalyzeOptions = {
    input: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--input' && next) {
      options.input = next
      index += 1
    } else if (arg === '--output' && next) {
      options.output = next
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!options.input) throw new Error('--input <path> is required')
  return options
}

export async function runMobileAppFoundryAnalyze(options: MobileAppFoundryAnalyzeOptions) {
  const inputPath = path.resolve(options.input)
  const raw = await readFile(inputPath, 'utf8')
  const input = JSON.parse(raw) as MobileFoundryAnalystInput
  const result = analyzeMobileAppFoundryBacklog(input)
  const serialized = `${JSON.stringify(result, null, 2)}\n`

  if (options.output) {
    const outputPath = path.resolve(options.output)
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, serialized, 'utf8')
    return { ...result, output_path: outputPath }
  }

  return result
}

function printHelp() {
  console.log(`Usage:
  npm run mobile-foundry:analyze -- --input <path> [--output <path>]

Options:
  --input <path>   JSON source packet, GitHub summary, and market evidence.
  --output <path>  Optional JSON artifact path. Omit to print JSON to stdout only.

Safety:
  This script is read-only by default and does not create work items, repos, accounts, tester outreach, store submissions, or pricing changes.
`)
}

if (require.main === module) {
  runMobileAppFoundryAnalyze(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
