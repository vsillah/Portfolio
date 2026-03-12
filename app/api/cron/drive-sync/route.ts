/**
 * POST /api/cron/drive-sync
 * Polls Google Drive scripts folder for changes and inserts into drive_video_queue.
 * Auth: Bearer N8N_INGEST_SECRET (for cron/n8n).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { listChangedScripts, fetchScriptChange } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.N8N_INGEST_SECRET
    const token = authHeader?.replace('Bearer ', '')

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const folderId = process.env.GOOGLE_DRIVE_SCRIPTS_FOLDER_ID
    if (!folderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_SCRIPTS_FOLDER_ID is not configured' },
        { status: 500 }
      )
    }

    const { data: syncState } = await supabaseAdmin
      .from('drive_sync_state')
      .select('last_modified')
      .eq('folder_id', folderId)
      .single()

    const modifiedAfter = syncState?.last_modified ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const files = await listChangedScripts(folderId, modifiedAfter)
    if (files.length === 0) {
      await supabaseAdmin.from('drive_sync_state').upsert(
        { folder_id: folderId, last_modified: new Date().toISOString(), last_sync_at: new Date().toISOString() },
        { onConflict: 'folder_id' }
      )
      return NextResponse.json({ ok: true, queued: 0, message: 'No changes' })
    }

    let maxModified = modifiedAfter
    const queueItems: Array<{
      drive_file_id: string
      drive_file_name: string
      script_text_prior: string | null
      script_text: string
      effective_at: string
    }> = []

    for (const file of files) {
      try {
        const change = await fetchScriptChange(file)
        queueItems.push({
          drive_file_id: change.driveFileId,
          drive_file_name: change.driveFileName,
          script_text_prior: change.scriptTextPrior,
          script_text: change.scriptText,
          effective_at: change.effectiveAt,
        })
        if (change.effectiveAt > maxModified) {
          maxModified = change.effectiveAt
        }
      } catch (err) {
        console.error('[drive-sync] Failed to fetch file:', file.id, file.name, err)
      }
    }

    if (queueItems.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('drive_video_queue').insert(
        queueItems.map(q => ({
          ...q,
          status: 'pending',
        }))
      )
      if (insertErr) {
        console.error('[drive-sync] Insert error:', insertErr)
        return NextResponse.json({ error: 'Failed to insert queue items' }, { status: 500 })
      }
    }

    await supabaseAdmin.from('drive_sync_state').upsert(
      {
        folder_id: folderId,
        last_modified: maxModified,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: 'folder_id' }
    )

    return NextResponse.json({
      ok: true,
      queued: queueItems.length,
      files: queueItems.map(q => q.drive_file_name),
    })
  } catch (error) {
    console.error('[drive-sync] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
