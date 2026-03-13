/**
 * POST /api/admin/video-generation/ideas-queue/[id]/dismiss
 * Mark an ideas queue item as dismissed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const queueId = params.id

    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .select('id, status')
      .eq('id', queueId)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json(
        { error: 'Ideas queue item not found' },
        { status: 404 }
      )
    }
    if (queueItem.status !== 'pending') {
      return NextResponse.json(
        { error: `Ideas queue item already ${queueItem.status}` },
        { status: 400 }
      )
    }

    const { error: updateErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .update({ status: 'dismissed' })
      .eq('id', queueId)

    if (updateErr) {
      console.error('[Video generation] Ideas queue dismiss error:', updateErr)
      return NextResponse.json(
        { error: 'Failed to dismiss' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, status: 'dismissed' })
  } catch (error) {
    console.error('[Video generation] Ideas queue dismiss error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
