import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildReviewUpsertPayload,
  hasReviewableReplyContent,
  suggestReplyIntentLabels,
  type OutreachReplySourceRow,
  type ReplyIntentReviewRow,
  toReplyIntentQueueItem,
} from '@/lib/model-ops-reply-intent'

export const dynamic = 'force-dynamic'

const MAX_BULK_ROWS = 100

function isMissingTableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code?: string }).code === '42P01' || (error as { code?: string }).code === 'PGRST205')
  )
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
    const action = typeof body?.action === 'string' ? body.action : ''
    const sourceIds = Array.isArray(body?.source_ids)
      ? Array.from(new Set(body.source_ids.filter((id: unknown) => typeof id === 'string' && id.trim()).map(String)))
      : []

    if (action !== 'accept_suggested') {
      return NextResponse.json({ error: 'Unsupported bulk action' }, { status: 400 })
    }

    if (sourceIds.length === 0) {
      return NextResponse.json({ error: 'source_ids must include at least one outreach reply id' }, { status: 400 })
    }

    if (sourceIds.length > MAX_BULK_ROWS) {
      return NextResponse.json({ error: `Bulk review is limited to ${MAX_BULK_ROWS} rows at a time` }, { status: 400 })
    }

    const { data: sourceRows, error: sourceError } = await supabaseAdmin
      .from('outreach_queue')
      .select('id,channel,sequence_step,status,replied_at,created_at,reply_content')
      .in('id', sourceIds)
      .not('reply_content', 'is', null)

    if (sourceError) {
      console.error('Error fetching bulk reply-intent source rows:', sourceError)
      return NextResponse.json({ error: 'Failed to fetch outreach replies' }, { status: 500 })
    }

    const rows = ((sourceRows || []) as OutreachReplySourceRow[]).filter((row) => hasReviewableReplyContent(row))

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No matching outreach replies found' }, { status: 404 })
    }

    const reviewedAt = new Date().toISOString()
    const payloads = rows.map((source) => {
      const labels = suggestReplyIntentLabels(source.reply_content)
      return buildReviewUpsertPayload({
        source,
        reviewStatus: 'reviewed',
        humanSchedulingIntent: labels.scheduling_intent,
        notes: 'Accepted suggested scheduling_intent via Model Ops bulk review.',
        reviewedBy: authResult.user.id,
        reviewedAt,
      })
    })

    const { data: reviews, error: reviewError } = await supabaseAdmin
      .from('model_ops_reply_intent_reviews')
      .upsert(payloads, { onConflict: 'source_table,source_id' })
      .select()

    if (reviewError) {
      if (isMissingTableError(reviewError)) {
        return NextResponse.json(
          { error: 'Model Ops reply-intent review schema has not been applied in this environment.' },
          { status: 503 }
        )
      }
      console.error('Error bulk saving reply-intent reviews:', reviewError)
      return NextResponse.json({ error: 'Failed to save reply-intent reviews' }, { status: 500 })
    }

    const reviewsBySource = new Map(((reviews || []) as ReplyIntentReviewRow[]).map((review) => [review.source_id, review]))

    return NextResponse.json({
      updated: rows.length,
      reviews: rows.map((source) => toReplyIntentQueueItem(source, reviewsBySource.get(source.id))),
    })
  } catch (error) {
    console.error('Reply-intent bulk review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
