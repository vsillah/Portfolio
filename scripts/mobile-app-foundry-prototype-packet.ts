import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry-work-items'
import {
  buildMobileFoundryPrototypePacket,
  renderMobileFoundryPrototypePacketMarkdown,
} from '@/lib/mobile-app-foundry-prototype-packet'

type Args = {
  input?: string
  output?: string
  format: 'json' | 'markdown'
}

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
  console.log(`Usage: npm run --silent mobile-foundry:prototype-packet -- --input <path> [--format json|markdown] [--output <path>]

Input may be either a backlog record or an object with { "backlog_record": ... }.
The command is read-only: it only prints or writes a prototype packet artifact.`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input) {
    printHelp()
    process.exit(1)
  }

  const inputPath = resolve(args.input)
  const parsed = JSON.parse(readFileSync(inputPath, 'utf8')) as unknown
  const body = parsed && typeof parsed === 'object' && 'backlog_record' in parsed
    ? parsed as { backlog_record?: unknown }
    : { backlog_record: parsed }

  const record = parseMobileFoundryBacklogRecord(body.backlog_record)
  if (!record) {
    throw new Error('Input must include a valid backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary')
  }

  const packet = buildMobileFoundryPrototypePacket(record)
  const output = args.format === 'markdown'
    ? renderMobileFoundryPrototypePacketMarkdown(packet)
    : `${JSON.stringify(packet, null, 2)}\n`

  if (args.output) {
    writeFileSync(resolve(args.output), output, 'utf8')
    return
  }

  process.stdout.write(output)
}

main()
