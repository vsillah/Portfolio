/**
 * POST /api/cron/gamma-stuck-cleanup
 * Marks gamma_reports stuck in `generating` (older than threshold) as failed.
 * Auth: Bearer N8N_INGEST_SECRET (n8n schedule or manual curl).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STUCK_MINUTES = 10
const CLEANUP_MESSAGE = 'Stuck in generating — cleaned up by scheduled job'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.N8N_INGEST_SECRET
    const token = authHeader?.replace(/^Bearer\s+/i, '')

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString()

    const { data: stuck, error: selectErr } = await supabaseAdmin
      .from('gamma_reports')
      .select('id')
      .eq('status', 'generating')
      .lt('created_at', cutoff)

    if (selectErr) {
      console.error('[gamma-stuck-cleanup] select error:', selectErr)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const ids = (stuck ?? []).map((r: { id: string }) => r.id).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        ids: [],
        message: 'No stuck rows',
      })
    }

    const now = new Date().toISOString()
    const { error: updateErr } = await supabaseAdmin
      .from('gamma_reports')
      .update({
        status: 'failed',
        error_message: CLEANUP_MESSAGE,
        updated_at: now,
      })
      .in('id', ids)

    if (updateErr) {
      console.error('[gamma-stuck-cleanup] update error:', updateErr)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    console.info('[gamma-stuck-cleanup] marked failed:', ids.length, ids)

    return NextResponse.json({
      ok: true,
      updated: ids.length,
      ids,
      message: `Marked ${ids.length} row(s) as failed`,
    })
  } catch (e) {
    console.error('[gamma-stuck-cleanup]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
