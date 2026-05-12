#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_SOURCE =
  '/Users/vambahsillah/Documents/Codex/2026-04-29/hey-can-you-confirm-that-i/model-ops/reports/latest-dashboard-data.json'
const DEFAULT_OUTPUT = 'data/model-ops/reports/latest-dashboard-data.json'

type JsonRecord = Record<string, unknown>

type SyncOptions = {
  source: string
  output: string
  check: boolean
  quiet: boolean
}

export function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    source: process.env.MODEL_OPS_DASHBOARD_DATA || DEFAULT_SOURCE,
    output: process.env.MODEL_OPS_PORTFOLIO_SNAPSHOT || DEFAULT_OUTPUT,
    check: false,
    quiet: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--source' && next) {
      options.source = next
      index += 1
    } else if (arg === '--output' && next) {
      options.output = next
      index += 1
    } else if (arg === '--check') {
      options.check = true
    } else if (arg === '--quiet') {
      options.quiet = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

export function sanitizeModelOpsDashboard(input: JsonRecord): JsonRecord {
  return {
    projectName: stringValue(input.projectName, 'Local LLM Model Ops & Hermes Automation'),
    generatedAt: stringValue(input.generatedAt, new Date().toISOString()),
    recommendations: pickRecord(input.recommendations),
    replyRuns: arrayValue(input.replyRuns).map((run) => sanitizeReplyRun(recordValue(run))),
    ragRuns: arrayValue(input.ragRuns).map((run) => sanitizeRagRun(recordValue(run))),
    swapRequests: arrayValue(input.swapRequests).map((request) => sanitizeSwapRequest(recordValue(request))),
  }
}

export async function syncModelOpsSnapshot(options: SyncOptions) {
  const sourcePath = path.resolve(options.source)
  const outputPath = path.resolve(options.output)
  const parsed = JSON.parse(await readFile(sourcePath, 'utf8')) as JsonRecord
  const sanitized = sanitizeModelOpsDashboard(parsed)
  const nextContent = `${JSON.stringify(sanitized, null, 2)}\n`

  let currentContent = ''
  try {
    currentContent = await readFile(outputPath, 'utf8')
  } catch {
    currentContent = ''
  }

  const changed = currentContent !== nextContent
  if (options.check) {
    if (changed) {
      throw new Error(`Model Ops snapshot is stale. Run: npm run model-ops:snapshot`)
    }
    if (!options.quiet) console.log(`Model Ops snapshot is current: ${outputPath}`)
    return { changed: false, sourcePath, outputPath }
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, nextContent, 'utf8')
  if (!options.quiet) {
    console.log(`${changed ? 'Updated' : 'Verified'} Model Ops snapshot`)
    console.log(`source: ${sourcePath}`)
    console.log(`output: ${outputPath}`)
    console.log(`replyRuns: ${arrayValue(sanitized.replyRuns).length}`)
    console.log(`ragRuns: ${arrayValue(sanitized.ragRuns).length}`)
    console.log(`swapRequests: ${arrayValue(sanitized.swapRequests).length}`)
  }
  return { changed, sourcePath, outputPath }
}

function sanitizeReplyRun(run: JsonRecord): JsonRecord {
  return pickDefined({
    file: stringOrUndefined(run.file),
    model: stringOrUndefined(run.model),
    observedModel: stringOrUndefined(run.observedModel),
    total: numberOrUndefined(run.total),
    scored: numberOrUndefined(run.scored),
    correct: numberOrUndefined(run.correct),
    accuracy: numberOrUndefined(run.accuracy),
    avgLatencyMs: numberOrUndefined(run.avgLatencyMs),
    medianLatencyMs: numberOrUndefined(run.medianLatencyMs),
    estimated200Minutes: numberOrUndefined(run.estimated200Minutes),
    status: stringOrUndefined(run.status),
    caveat: stringOrUndefined(run.caveat),
    sourceAccuracy: pickRecord(run.sourceAccuracy),
  })
}

function sanitizeRagRun(run: JsonRecord): JsonRecord {
  return pickDefined({
    file: stringOrUndefined(run.file),
    name: stringOrUndefined(run.name),
    generatedAt: stringOrUndefined(run.generatedAt),
    totalQueries: numberOrUndefined(run.totalQueries),
    overall: pickRecord(run.overall),
  })
}

function sanitizeSwapRequest(request: JsonRecord): JsonRecord {
  return pickDefined({
    title: stringOrUndefined(request.title),
    name: stringOrUndefined(request.name),
    status: stringOrUndefined(request.status),
    approvalState: stringOrUndefined(request.approvalState),
    sourcePath: stringOrUndefined(request.sourcePath),
    createdAt: stringOrUndefined(request.createdAt),
  })
}

function pickRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return JSON.parse(JSON.stringify(value)) as JsonRecord
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function numberOrUndefined(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function pickDefined(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))
}

function printHelp() {
  console.log(`Usage:
  npm run model-ops:snapshot -- [options]

Options:
  --source <path>   Source Model Ops latest-dashboard-data.json.
  --output <path>   Repo snapshot output path.
  --check           Fail if the repo snapshot is stale.
  --quiet           Suppress normal output.

Environment:
  MODEL_OPS_DASHBOARD_DATA       Default source override.
  MODEL_OPS_PORTFOLIO_SNAPSHOT   Default output override.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await syncModelOpsSnapshot(options)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
