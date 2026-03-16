/**
 * POST /api/admin/video-generation/queue/[id]/add-to-drafts
 * Copies a Drive video queue item into video_ideas_queue as a draft.
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

    const { data: driveItem, error: fetchErr } = await supabaseAdmin
      .from('drive_video_queue')
      .select('id, drive_file_id, drive_file_name, script_text, status')
      .eq('id', queueId)
      .single()

    if (fetchErr || !driveItem) {
      return NextResponse.json({ error: 'Drive queue item not found' }, { status: 404 })
    }

    if (driveItem.status !== 'pending') {
      return NextResponse.json(
        { error: `Drive queue item already ${driveItem.status}` },
        { status: 400 }
      )
    }

    const scriptText = (driveItem.script_text ?? '').trim()
    if (!scriptText) {
      return NextResponse.json({ error: 'Drive queue item has no script text' }, { status: 400 })
    }

    const { data: draft, error: insertErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .insert({
        title: driveItem.drive_file_name ?? 'Drive Script',
        script_text: scriptText,
        storyboard_json: { scenes: [] },
        source: 'drive_script',
        status: 'pending',
        custom_prompt: null,
      })
      .select('id, title')
      .single()

    if (insertErr) {
      console.error('[add-to-drafts] Insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('drive_video_queue')
      .update({ status: 'generated' })
      .eq('id', queueId)

    if (updateErr) {
      console.error('[add-to-drafts] Drive queue update error:', updateErr)
    }

    return NextResponse.json({
      draftId: draft.id,
      title: draft.title,
      driveFileId: driveItem.drive_file_id,
    })
  } catch (error) {
    console.error('[add-to-drafts] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
