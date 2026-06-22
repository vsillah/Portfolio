import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry-work-items'
import {
  buildMobileFoundryCommercializationPacket,
  renderMobileFoundryCommercializationPacketMarkdown,
  type MobileFoundryCommercializationInput,
  type MobileFoundryPrototypeValidationStatus,
} from '@/lib/mobile-app-foundry-commercialization-packet'

type Args = {
  input?: string
  output?: string
  format: 'json' | 'markdown'
}

const VALIDATION_STATUSES: MobileFoundryPrototypeValidationStatus[] = [
  'pending_review',
  'needs_revision',
  'validated',
]

function parseArgs(argv: string[]): Args {
  const args: Args = { format: 'json' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') args.input = argv[++index]
    else if (arg === '--output') args.output = argv[++index]
    else if (arg === '--format') {
      const format = argv[++index]
      if (format !== 'json' && format !== 'markdown') {
        throw new Error('--format must be json or markdown')
      }
      args.format = format
    }
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }
  return args
}

function printHelp() {
  console.log(`Usage: npm run --silent mobile-foundry:commercialization-packet -- --input <path> [--format json|markdown] [--output <path>]

Input may be either a backlog record or an object with:
{
  "backlog_record": { ... },
  "commercialization_input": {
    "validation_status": "pending_review" | "needs_revision" | "validated",
    "prototype_url": "...",
    "demo_evidence": []
  }
}

The command is read-only: it only prints or writes a commercialization packet artifact.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : undefined
}

function parseCommercializationInput(value: unknown): MobileFoundryCommercializationInput {
  if (!isRecord(value)) return {}
  const rawStatus = value.validation_status
  if (typeof rawStatus === 'string' && !VALIDATION_STATUSES.includes(rawStatus as MobileFoundryPrototypeValidationStatus)) {
    throw new Error('commercialization_input.validation_status must be pending_review, needs_revision, or validated')
  }

  return {
    validation_status: typeof rawStatus === 'string' ? rawStatus as MobileFoundryPrototypeValidationStatus : undefined,
    prototype_url: typeof value.prototype_url === 'string' ? value.prototype_url : null,
    demo_evidence: stringArray(value.demo_evidence),
    tester_profile: stringArray(value.tester_profile),
    privacy_notes: stringArray(value.privacy_notes),
    pricing_notes: stringArray(value.pricing_notes),
    store_notes: stringArray(value.store_notes),
    launch_notes: stringArray(value.launch_notes),
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input) {
    printHelp()
    process.exit(1)
  }

  const parsed = JSON.parse(readFileSync(resolve(args.input), 'utf8')) as unknown
  const body = isRecord(parsed) && 'backlog_record' in parsed
    ? parsed
    : { backlog_record: parsed }

  const record = parseMobileFoundryBacklogRecord(body.backlog_record)
  if (!record) {
    throw new Error('Input must include a valid backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary')
  }

  const packet = buildMobileFoundryCommercializationPacket(
    record,
    parseCommercializationInput(body.commercialization_input),
  )
  const output = args.format === 'markdown'
    ? renderMobileFoundryCommercializationPacketMarkdown(packet)
    : `${JSON.stringify(packet, null, 2)}\n`

  if (args.output) {
    writeFileSync(resolve(args.output), output, 'utf8')
    return
  }

  process.stdout.write(output)
}

main()
