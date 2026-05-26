#!/usr/bin/env tsx
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import {
  MODEL_OPS_REPLY_INTENT_MAX_SOURCE_ROWS,
  buildPendingReviewSeedPayload,
  hasReviewableReplyContent,
  type OutreachReplySourceRow,
  type ReplyIntentReviewRow,
} from '../lib/model-ops-reply-intent'

type SyncOptions = {
  apply: boolean
  envFile: string
  limit: number
  minLength: number
}

type SyncPlan = {
  candidateReplies: number
  existingLedgerRows: number
  pendingToSeed: OutreachReplySourceRow[]
  skippedShortReplies: number
}

export function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    apply: false,
    envFile: '.env.local',
    limit: Number.parseInt(process.env.MODEL_OPS_REPLY_INTENT_SYNC_LIMIT || String(MODEL_OPS_REPLY_INTENT_MAX_SOURCE_ROWS), 10),
    minLength: Number.parseInt(process.env.MODEL_OPS_REPLY_INTENT_MIN_LENGTH || '8', 10),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--env-file' && next) {
      options.envFile = next
      index += 1
    } else if (arg === '--limit' && next) {
      options.limit = Math.max(1, Number.parseInt(next, 10))
      index += 1
    } else if (arg === '--min-length' && next) {
      options.minLength = Math.max(1, Number.parseInt(next, 10))
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 1) options.limit = MODEL_OPS_REPLY_INTENT_MAX_SOURCE_ROWS
  if (!Number.isFinite(options.minLength) || options.minLength < 1) options.minLength = 8
  return options
}

export function planReplyIntentReviewSync(
  sourceRows: OutreachReplySourceRow[],
  reviewRows: ReplyIntentReviewRow[],
  minLength = 8
): SyncPlan {
  const reviewableRows = sourceRows.filter((row) => hasReviewableReplyContent(row, minLength))
  const sourceIds = new Set(reviewableRows.map((row) => row.id))
  const reviewedSourceIds = new Set(reviewRows.map((row) => row.source_id))

  return {
    candidateReplies: reviewableRows.length,
    existingLedgerRows: reviewRows.filter((row) => sourceIds.has(row.source_id)).length,
    pendingToSeed: reviewableRows.filter((row) => !reviewedSourceIds.has(row.id)),
    skippedShortReplies: sourceRows.length - reviewableRows.length,
  }
}

function hasUsableSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
  return Boolean(url && key && !/YOUR_|your-|your_/i.test(`${url} ${key}`))
}

export async function syncReplyIntentReviewCandidates(options: SyncOptions) {
  loadDotenv({ path: path.resolve(process.cwd(), options.envFile), override: false })

  if (!hasUsableSupabaseCredentials()) {
    return {
      ok: true,
      skipped: true,
      applied: false,
      reason: 'No usable Supabase URL/service role key found.',
      source_table: 'outreach_queue',
      candidate_replies: 0,
      existing_ledger_rows: 0,
      pending_to_seed: 0,
      seeded: 0,
      skipped_short_replies: 0,
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(url!, key!, {
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

  const { data: sourceRows, error: sourceError } = await supabase
    .from('outreach_queue')
    .select('id,channel,sequence_step,status,replied_at,created_at,reply_content')
    .not('reply_content', 'is', null)
    .order('replied_at', { ascending: false, nullsFirst: false })
    .limit(options.limit)

  if (sourceError) throw new Error(`Failed to fetch outreach replies: ${sourceError.message}`)

  const sourceList = (sourceRows || []) as OutreachReplySourceRow[]
  const candidateSourceIds = sourceList
    .filter((row) => hasReviewableReplyContent(row, options.minLength))
    .map((row) => row.id)

  const { data: reviewRows, error: reviewError } =
    candidateSourceIds.length > 0
      ? await supabase
          .from('model_ops_reply_intent_reviews')
          .select(
            'source_id,source_table,source_hash,reply_hash,redacted_reply,suggested_labels,review_status,human_scheduling_intent'
          )
          .eq('source_table', 'outreach_queue')
          .in('source_id', candidateSourceIds)
      : { data: [], error: null }

  if (reviewError) throw new Error(`Failed to fetch existing reply-intent reviews: ${reviewError.message}`)

  const plan = planReplyIntentReviewSync(
    sourceList,
    (reviewRows || []) as ReplyIntentReviewRow[],
    options.minLength
  )

  if (!options.apply || plan.pendingToSeed.length === 0) {
    return {
      ok: true,
      skipped: false,
      applied: false,
      source_table: 'outreach_queue',
      candidate_replies: plan.candidateReplies,
      existing_ledger_rows: plan.existingLedgerRows,
      pending_to_seed: plan.pendingToSeed.length,
      seeded: 0,
      skipped_short_replies: plan.skippedShortReplies,
      next_command:
        plan.pendingToSeed.length > 0 ? 'npm run model-ops:reply-intent:sync -- --apply' : 'No pending seed rows.',
    }
  }

  const payloads = plan.pendingToSeed.map(buildPendingReviewSeedPayload)
  const { error: upsertError } = await supabase
    .from('model_ops_reply_intent_reviews')
    .upsert(payloads, { onConflict: 'source_table,source_id', ignoreDuplicates: true })

  if (upsertError) throw new Error(`Failed to seed reply-intent review candidates: ${upsertError.message}`)

  return {
    ok: true,
    skipped: false,
    applied: true,
    source_table: 'outreach_queue',
    candidate_replies: plan.candidateReplies,
    existing_ledger_rows: plan.existingLedgerRows,
    pending_to_seed: plan.pendingToSeed.length,
    seeded: payloads.length,
    skipped_short_replies: plan.skippedShortReplies,
  }
}

function printHelp() {
  console.log(`Usage:
  npm run model-ops:reply-intent:sync -- [options]

Options:
  --apply             Upsert missing outreach replies as pending review rows. Omit for dry-run.
  --env-file <path>   Environment file to load before querying Supabase.
  --limit <number>    Maximum source/review rows to inspect.
  --min-length <n>    Minimum reply_content length to seed.
`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncReplyIntentReviewCandidates(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
