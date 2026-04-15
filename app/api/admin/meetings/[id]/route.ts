import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function safeParseArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* ignore */
    }
  }
  return []
}

function normalizeNotes(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function toActionItemTexts(rawItems: unknown[]): Array<{ text: string }> {
  const out: Array<{ text: string }> = []
  for (const item of rawItems) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ text: item.trim() })
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as { text?: unknown; action?: unknown; title?: unknown }
      const t = o.text ?? o.action ?? o.title
      if (typeof t === 'string' && t.trim()) out.push({ text: t.trim() })
    }
  }
  return out
}

/**
 * GET /api/admin/meetings/:id
 *
 * Returns a meeting_record in the same shape as Read.ai detail for enrich-modal import.
 * When ?detail=true, returns the full record for the meeting detail page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const id = params.id
  if (!id) {
    return NextResponse.json({ error: 'Meeting id is required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const wantDetail = searchParams.get('detail') === 'true'

  const selectCols = wantDetail
    ? 'id, meeting_type, meeting_date, duration_minutes, transcript, structured_notes, action_items, key_decisions, open_questions, risks_identified, attendees, recording_url, contact_submission_id, client_project_id, created_at'
    : 'id, meeting_type, meeting_date, transcript, structured_notes, action_items, key_decisions'

  const { data: row, error } = await supabaseAdmin
    .from('meeting_records')
    .select(selectCols)
    .eq('id', id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Meeting record not found' }, { status: 404 })
  }

  const notes = normalizeNotes(row.structured_notes)
  const summaryFromNotes =
    (typeof notes?.summary === 'string' && notes.summary.trim()) ||
    (typeof notes?.highlights === 'string' && notes.highlights.trim()) ||
    null

  const transcript = typeof row.transcript === 'string' ? row.transcript : ''
  const summary =
    summaryFromNotes ||
    (transcript.trim() ? transcript.slice(0, 4000) : null)

  let actionParts = toActionItemTexts(safeParseArray(row.action_items))
  if (actionParts.length === 0 && notes) {
    actionParts = toActionItemTexts(safeParseArray(notes.action_items))
  }
  if (actionParts.length === 0) {
    actionParts = toActionItemTexts(safeParseArray(row.key_decisions))
  }

  const title =
    typeof row.meeting_type === 'string' && row.meeting_type.trim()
      ? row.meeting_type.replace(/_/g, ' ')
      : 'Meeting'

  const startMs = Date.parse(row.meeting_date)
  const start_time_ms = Number.isFinite(startMs) ? startMs : Date.now()

  if (wantDetail) {
    return NextResponse.json({
      meeting: {
        id: row.id,
        title,
        meeting_type: row.meeting_type,
        meeting_date: row.meeting_date,
        duration_minutes: (row as Record<string, unknown>).duration_minutes ?? null,
        start_time_ms,
        summary,
        transcript: transcript || null,
        action_items: actionParts.length > 0 ? actionParts : null,
        key_decisions: safeParseArray(row.key_decisions).map((d) =>
          typeof d === 'string' ? d : (d as { text?: string })?.text ?? String(d)
        ).filter(Boolean),
        open_questions: safeParseArray((row as Record<string, unknown>).open_questions).map((q) =>
          typeof q === 'string' ? q : (q as { text?: string })?.text ?? String(q)
        ).filter(Boolean),
        risks_identified: safeParseArray((row as Record<string, unknown>).risks_identified).map((r) =>
          typeof r === 'string' ? r : (r as { text?: string })?.text ?? String(r)
        ).filter(Boolean),
        attendees: safeParseArray((row as Record<string, unknown>).attendees),
        recording_url: (row as Record<string, unknown>).recording_url ?? null,
        contact_submission_id: (row as Record<string, unknown>).contact_submission_id ?? null,
        client_project_id: (row as Record<string, unknown>).client_project_id ?? null,
        structured_notes: notes,
      },
    })
  }

  return NextResponse.json({
    meeting: {
      id: row.id,
      title,
      start_time_ms,
      end_time_ms: null,
      participants: [] as Array<{ name: string; email: string | null }>,
      platform: 'record',
      report_url: '',
      summary,
      action_items: actionParts.length > 0 ? actionParts : null,
    },
  })
}
