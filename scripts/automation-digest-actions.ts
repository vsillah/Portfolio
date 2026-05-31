#!/usr/bin/env tsx
import { config } from 'dotenv'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { runDigestActionRouting } from '@/lib/automation-digest-actions'

const envPath = process.env.PORTFOLIO_ENV_FILE
  ?? (existsSync(path.resolve(process.cwd(), '.env.local'))
    ? path.resolve(process.cwd(), '.env.local')
    : '/Users/vambahsillah/Projects/Portfolio/.env.local')
config({ path: envPath, quiet: true })

type Options = {
  apply: boolean
  json: boolean
  digestDate: string | null
  summaryDir: string
  summaryPaths: string[]
}

function valueAfter(argv: string[], flag: string) {
  const index = argv.indexOf(flag)
  if (index === -1) return null
  return argv[index + 1] ?? null
}

function valuesAfter(argv: string[], flag: string) {
  const values: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && argv[index + 1]) values.push(argv[index + 1])
  }
  return values
}

function parseArgs(argv: string[]): Options {
  return {
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
    digestDate: valueAfter(argv, '--date'),
    summaryDir: valueAfter(argv, '--summary-dir')
      ?? '/Users/vambahsillah/.codex/automation-notifications/pending',
    summaryPaths: valuesAfter(argv, '--summary-file'),
  }
}

function summaryPaths(options: Options) {
  if (options.summaryPaths.length) return options.summaryPaths.map((item) => path.resolve(item)).sort()
  const dir = path.resolve(options.summaryDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(dir, entry))
    .sort()
}

function printText(result: Awaited<ReturnType<typeof runDigestActionRouting>>) {
  console.log(result.slackMessage)
  console.log('')
  console.log(`Mode: ${result.applied ? 'apply' : 'dry-run'}`)
  console.log(`Summaries: ${result.summaryCount}`)
  console.log(`Actions: ${result.actionCount}`)
  for (const item of result.results) {
    const suffix = item.workItemId ? ` (${item.workItemId})` : ''
    console.log(`- ${item.status}: ${item.action.title}${suffix}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const paths = summaryPaths(options)
  if (!paths.length) {
    throw new Error(`No automation digest summary JSON files found in ${options.summaryDir}.`)
  }
  const result = await runDigestActionRouting({
    summaryPaths: paths,
    digestDate: options.digestDate,
    apply: options.apply,
  })

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  printText(result)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
