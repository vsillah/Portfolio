#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import {
  MODEL_OPS_REPLY_INTENT_DEFAULT_EXPORT,
  normalizeSuggestedLabels,
  stableHash,
  type ReplyIntentReviewRow,
} from '../lib/model-ops-reply-intent'

type ExportOptions = {
  output: string
  limit: number
  envFile: string
}

type ReviewedRow = ReplyIntentReviewRow & {
  human_scheduling_intent: boolean
  reviewed_at: string
}

export function parseArgs(argv: string[]): ExportOptions {
  const options: ExportOptions = {
    output: process.env.MODEL_OPS_REPLY_INTENT_EXPORT || MODEL_OPS_REPLY_INTENT_DEFAULT_EXPORT,
    limit: Number.parseInt(process.env.MODEL_OPS_REPLY_INTENT_EXPORT_LIMIT || '1000', 10),
    envFile: '.env.local',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--output' && next) {
      options.output = next
      index += 1
    } else if (arg === '--limit' && next) {
      options.limit = Math.max(1, Number.parseInt(next, 10))
      index += 1
    } else if (arg === '--env-file' && next) {
      options.envFile = next
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) options.limit = 1000
  return options
}

export function toJsonlExample(row: ReviewedRow) {
  return {
    id: `portfolio-model-ops:${stableHash(`${row.source_table}:${row.source_id}`)}`,
    source: 'portfolio_model_ops_reply_intent_reviews',
    source_ref: {
      table: row.source_table,
      row_hash: row.source_hash,
      reply_hash: row.reply_hash,
      reviewed_at: row.reviewed_at,
      channel: row.channel || null,
      sequence_step: row.sequence_step ?? null,
    },
    text_redacted: row.redacted_reply,
    suggested_labels: normalizeSuggestedLabels(row.suggested_labels),
    review: {
      scheduling_intent: row.human_scheduling_intent,
      interested: '',
      not_interested: '',
      ooo: '',
      needs_followup: '',
      notes: row.notes || '',
    },
  }
}

export async function exportReplyIntentReviews(options: ExportOptions) {
  loadDotenv({ path: path.resolve(process.cwd(), options.envFile), override: false })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key || /YOUR_|your-|your_/i.test(`${url} ${key}`)) {
    await mkdir(path.dirname(path.resolve(options.output)), { recursive: true })
    await writeFile(path.resolve(options.output), '', 'utf8')
    return {
      ok: true,
      skipped: true,
      reason: 'No usable Supabase URL/service role key found.',
      output: path.resolve(options.output),
      count: 0,
    }
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  })

  const { data, error } = await supabase
    .from('model_ops_reply_intent_reviews')
    .select('*')
    .eq('source_table', 'outreach_queue')
    .eq('review_status', 'reviewed')
    .not('human_scheduling_intent', 'is', null)
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(options.limit)

  if (error) {
    throw new Error(`Failed to export reply-intent reviews: ${error.message}`)
  }

  const examples = ((data || []) as ReviewedRow[]).map(toJsonlExample)
  const output = path.resolve(options.output)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, examples.map((item) => JSON.stringify(item)).join('\n') + (examples.length ? '\n' : ''), 'utf8')

  return {
    ok: true,
    skipped: false,
    output,
    count: examples.length,
  }
}

function printHelp() {
  console.log(`Usage:
  npm run model-ops:reply-intent:export -- [options]

Options:
  --output <path>     JSONL output path.
  --limit <number>    Maximum reviewed rows to export.
  --env-file <path>   Environment file to load before querying Supabase.
`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  exportReplyIntentReviews(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
