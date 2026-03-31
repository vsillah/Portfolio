import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { extractMeetingTitle } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

const STALE_THRESHOLD_MS = 15 * 60 * 1000

/**
 * GET /api/admin/social-content/runs
 * Returns recent extraction runs with optional active-only filtering.
 * ?active=true — only running rows (for polling)
 * ?limit=N    — max rows (default 20)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    let query = supabaseAdmin
      .from('social_content_extraction_runs')
      .select('id, triggered_at, completed_at, status, items_inserted, error_message, meeting_record_id')
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (activeOnly) {
      query = query.eq('status', 'running')
    }

    const { data: runs, error } = await query

    if (error) {
      console.error('Error fetching extraction runs:', error)
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }

    const meetingIds = [...new Set((runs || []).map((r: { meeting_record_id: string | null }) => r.meeting_record_id).filter(Boolean))] as string[]
    const meetingTitleMap = new Map<string, string | null>()
    if (meetingIds.length > 0) {
      const { data: meetings } = await supabaseAdmin
        .from('meeting_records')
        .select('id, raw_notes, structured_notes')
        .in('id', meetingIds)

      for (const m of meetings || []) {
        const notes = m.structured_notes as Record<string, unknown> | null
        meetingTitleMap.set(m.id, extractMeetingTitle(m.raw_notes, notes))
      }
    }

    const now = Date.now()
    const enriched = (runs || []).map((run: {
      id: string; triggered_at: string; completed_at: string | null;
      status: string; items_inserted: number | null; error_message: string | null;
      meeting_record_id: string | null;
    }) => {
      const isStale = run.status === 'running' &&
        (now - new Date(run.triggered_at).getTime()) > STALE_THRESHOLD_MS

      return {
        ...run,
        meeting_title: run.meeting_record_id
          ? (meetingTitleMap.get(run.meeting_record_id) || null)
          : null,
        stale: isStale,
      }
    })

    return NextResponse.json({ runs: enriched })
  } catch (err) {
    console.error('Error in GET /api/admin/social-content/runs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/social-content/runs
 * Manually mark a stale run as failed.
 * Body: { run_id: string }
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { run_id } = body as { run_id?: string }

    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }

    const { data: run } = await supabaseAdmin
      .from('social_content_extraction_runs')
      .select('id, status')
      .eq('id', run_id)
      .single()

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status !== 'running') {
      return NextResponse.json({ error: 'Run is not in running state' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('social_content_extraction_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: 'Manually marked as failed (stale run)',
      })
      .eq('id', run_id)

    if (error) {
      console.error('Error marking run as failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, run_id })
  } catch (err) {
    console.error('Error in PATCH /api/admin/social-content/runs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
