import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'node:fs/promises'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  MODEL_OPS_REPLY_INTENT_DEFAULT_EXPORT,
  MODEL_OPS_REPLY_INTENT_EXPORT_COMMAND,
  MODEL_OPS_REPLY_INTENT_TARGET,
  buildReviewUpsertPayload,
  normalizeReviewStatus,
  type ReplyIntentEvidenceSummary,
  type OutreachReplySourceRow,
  type ReplyIntentQueueItem,
  type ReplyIntentReviewRow,
  toReplyIntentQueueItem,
} from '@/lib/model-ops-reply-intent'

export const dynamic = 'force-dynamic'

const MAX_SOURCE_ROWS = 750

type QueueResponse = {
  available: boolean
  items: ReplyIntentQueueItem[]
  summary: {
    target: number
    total_real_replies: number
    reviewed_real: number
    pending: number
    unsure: number
    skipped: number
    remaining_to_gate: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  schema?: {
    reviews_table_available: boolean
  }
  evidence: ReplyIntentEvidenceSummary
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function isMissingTableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code?: string }).code === '42P01' || (error as { code?: string }).code === 'PGRST205')
  )
}

function summarize(items: ReplyIntentQueueItem[]) {
  const reviewedReal = items.filter(
    (item) => item.review_status === 'reviewed' && typeof item.human_scheduling_intent === 'boolean'
  ).length
  return {
    target: MODEL_OPS_REPLY_INTENT_TARGET,
    total_real_replies: items.length,
    reviewed_real: reviewedReal,
    pending: items.filter((item) => item.review_status === 'pending').length,
    unsure: items.filter((item) => item.review_status === 'unsure').length,
    skipped: items.filter((item) => item.review_status === 'skipped').length,
    remaining_to_gate: Math.max(0, MODEL_OPS_REPLY_INTENT_TARGET - reviewedReal),
  }
}

function filterItems(items: ReplyIntentQueueItem[], status: string, search: string) {
  let filtered = items

  if (status !== 'all') {
    filtered = filtered.filter((item) => item.review_status === status)
  }

  const query = search.trim().toLowerCase()
  if (query) {
    filtered = filtered.filter((item) => {
      const haystack = [
        item.source_id,
        item.source_hash,
        item.channel,
        item.outreach_status,
        item.redacted_reply,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }

  return filtered
}

function mapQueueItems(sourceRows: OutreachReplySourceRow[], reviewRows: ReplyIntentReviewRow[]) {
  const reviewsBySourceId = new Map(reviewRows.map((review) => [review.source_id, review]))
  return sourceRows.map((source) => toReplyIntentQueueItem(source, reviewsBySourceId.get(source.id)))
}

function countExportedReviewedExamples(raw: string) {
  let exportedReal = 0
  let invalidLines = 0

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed) as { review?: { scheduling_intent?: unknown } }
      if (typeof parsed.review?.scheduling_intent === 'boolean') exportedReal += 1
    } catch {
      invalidLines += 1
    }
  }

  return { exportedReal, invalidLines }
}

async function getEvidenceSummary(reviewedReal: number): Promise<ReplyIntentEvidenceSummary> {
  const artifactPath = process.env.MODEL_OPS_REPLY_INTENT_EXPORT || MODEL_OPS_REPLY_INTENT_DEFAULT_EXPORT
  const base = {
    artifact_path: artifactPath,
    export_command: MODEL_OPS_REPLY_INTENT_EXPORT_COMMAND,
    exported_real: 0,
    exported_at: null,
    benchmark_actionable_real: 0,
    remaining_to_actionable_gate: MODEL_OPS_REPLY_INTENT_TARGET,
    invalid_lines: 0,
  }

  try {
    const [raw, artifactStat] = await Promise.all([readFile(artifactPath, 'utf8'), stat(artifactPath)])
    const { exportedReal, invalidLines } = countExportedReviewedExamples(raw)
    const status =
      invalidLines > 0
        ? 'invalid'
        : exportedReal >= MODEL_OPS_REPLY_INTENT_TARGET
          ? 'gate_met'
          : exportedReal < reviewedReal
            ? 'stale'
            : 'current'

    return {
      ...base,
      exported_real: exportedReal,
      exported_at: artifactStat.mtime.toISOString(),
      status,
      benchmark_actionable_real: invalidLines > 0 ? 0 : exportedReal,
      remaining_to_actionable_gate:
        invalidLines > 0 ? MODEL_OPS_REPLY_INTENT_TARGET : Math.max(0, MODEL_OPS_REPLY_INTENT_TARGET - exportedReal),
      invalid_lines: invalidLines,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      return { ...base, status: 'missing' }
    }

    console.error('Error reading reply-intent benchmark export:', error)
    return { ...base, status: 'invalid' }
  }
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = intParam(searchParams.get('page'), 1, 1, 1000)
    const limit = intParam(searchParams.get('limit'), 25, 1, 100)
    const status = normalizeReviewStatus(searchParams.get('status') || 'pending')
    const normalizedStatus = searchParams.get('status') === 'all' ? 'all' : status
    const search = searchParams.get('search') || ''

    const [{ data: sourceRows, error: sourceError }, reviewResult] = await Promise.all([
      supabaseAdmin
        .from('outreach_queue')
        .select('id,channel,sequence_step,status,replied_at,created_at,reply_content')
        .not('reply_content', 'is', null)
        .order('replied_at', { ascending: false, nullsFirst: false })
        .limit(MAX_SOURCE_ROWS),
      supabaseAdmin
        .from('model_ops_reply_intent_reviews')
        .select('*')
        .eq('source_table', 'outreach_queue')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .limit(MAX_SOURCE_ROWS),
    ])

    if (sourceError) {
      if (isMissingTableError(sourceError)) {
        const emptySummary = summarize([])
        return NextResponse.json({
          available: false,
          reason: 'Outreach queue schema has not been applied in this environment.',
          items: [],
          summary: emptySummary,
          pagination: { page, limit, total: 0, totalPages: 0 },
          evidence: await getEvidenceSummary(emptySummary.reviewed_real),
        })
      }
      console.error('Error fetching reply-intent source rows:', sourceError)
      return NextResponse.json({ error: 'Failed to fetch outreach replies' }, { status: 500 })
    }

    const reviewsTableAvailable = !isMissingTableError(reviewResult.error)
    if (reviewResult.error && reviewsTableAvailable) {
      console.error('Error fetching reply-intent review rows:', reviewResult.error)
      return NextResponse.json({ error: 'Failed to fetch reply-intent reviews' }, { status: 500 })
    }

    const allItems = mapQueueItems(
      (sourceRows || []).filter((row: OutreachReplySourceRow) => String(row.reply_content || '').trim().length >= 8),
      reviewsTableAvailable ? ((reviewResult.data || []) as ReplyIntentReviewRow[]) : []
    )
    const queueSummary = summarize(allItems)
    const evidence = await getEvidenceSummary(queueSummary.reviewed_real)
    const filtered = filterItems(allItems, normalizedStatus, search)
    const offset = (page - 1) * limit
    const items = filtered.slice(offset, offset + limit)

    const response: QueueResponse = {
      available: true,
      items,
      summary: queueSummary,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
      schema: {
        reviews_table_available: reviewsTableAvailable,
      },
      evidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Reply-intent review list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const sourceId = typeof body?.source_id === 'string' ? body.source_id.trim() : ''
    const reviewStatus = normalizeReviewStatus(body?.review_status)
    const humanSchedulingIntent = body?.human_scheduling_intent
    const notes = typeof body?.notes === 'string' ? body.notes : ''

    if (!sourceId) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
    }

    if (reviewStatus === 'pending') {
      return NextResponse.json({ error: 'review_status must be reviewed, unsure, or skipped' }, { status: 400 })
    }

    if (reviewStatus === 'reviewed' && typeof humanSchedulingIntent !== 'boolean') {
      return NextResponse.json(
        { error: 'human_scheduling_intent must be true or false when review_status is reviewed' },
        { status: 400 }
      )
    }

    const { data: source, error: sourceError } = await supabaseAdmin
      .from('outreach_queue')
      .select('id,channel,sequence_step,status,replied_at,created_at,reply_content')
      .eq('id', sourceId)
      .not('reply_content', 'is', null)
      .maybeSingle()

    if (sourceError) {
      console.error('Error fetching reply-intent source row:', sourceError)
      return NextResponse.json({ error: 'Failed to fetch outreach reply' }, { status: 500 })
    }

    if (!source || String((source as OutreachReplySourceRow).reply_content || '').trim().length < 8) {
      return NextResponse.json({ error: 'Outreach reply not found' }, { status: 404 })
    }

    const payload = buildReviewUpsertPayload({
      source: source as OutreachReplySourceRow,
      reviewStatus,
      humanSchedulingIntent: reviewStatus === 'reviewed' ? humanSchedulingIntent : null,
      notes,
      reviewedBy: authResult.user.id,
    })

    const { data: review, error: reviewError } = await supabaseAdmin
      .from('model_ops_reply_intent_reviews')
      .upsert(payload, { onConflict: 'source_table,source_id' })
      .select()
      .single()

    if (reviewError) {
      if (isMissingTableError(reviewError)) {
        return NextResponse.json(
          { error: 'Model Ops reply-intent review schema has not been applied in this environment.' },
          { status: 503 }
        )
      }
      console.error('Error saving reply-intent review:', reviewError)
      return NextResponse.json({ error: 'Failed to save reply-intent review' }, { status: 500 })
    }

    return NextResponse.json({
      review: toReplyIntentQueueItem(source as OutreachReplySourceRow, review as ReplyIntentReviewRow),
    })
  } catch (error) {
    console.error('Reply-intent review save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
