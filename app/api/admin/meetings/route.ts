import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TRANSCRIPT_PREVIEW_LEN = 200

/**
 * GET /api/admin/meetings
 *
 * List meeting records so admins can attribute transcripts to a lead.
 * Used by Admin → Meetings to show all meetings and "Assign lead".
 *
 * Query params:
 *   - unlinked_only: if "true", only meetings with no contact_submission_id and no client_project_id
 *   - q: search text (matches meeting_type, transcript snippet)
 *   - limit: max results (default 50, max 100)
 *   - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const unlinkedOnly = searchParams.get('unlinked_only') === 'true'
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
  const offset = Number(searchParams.get('offset') || 0) || 0

  try {
    let query = supabaseAdmin
      .from('meeting_records')
      .select(
        'id, meeting_type, meeting_date, duration_minutes, contact_submission_id, client_project_id, transcript, structured_notes, created_at',
        { count: 'exact' }
      )
      .order('meeting_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unlinkedOnly) {
      query = query.is('contact_submission_id', null).is('client_project_id', null)
    }
    if (q) {
      query = query.or(`meeting_type.ilike.%${q}%,transcript.ilike.%${q}%`)
    }

    const { data: meetings, error, count } = await query

    if (error) {
      console.error('[admin/meetings] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
    }

    const list = meetings || []
    if (list.length === 0) {
      return NextResponse.json({ meetings: [], total: count ?? 0 })
    }

    type Row = (typeof list)[number]
    const contactIds = [...new Set(list.map((m: Row) => m.contact_submission_id).filter(Boolean))] as number[]
    const projectIds = [...new Set(list.map((m: Row) => m.client_project_id).filter(Boolean))] as string[]

    const [contactsRes, projectsRes] = await Promise.all([
      contactIds.length > 0
        ? supabaseAdmin.from('contact_submissions').select('id, name, email').in('id', contactIds)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? supabaseAdmin.from('client_projects').select('id, project_name, client_name').in('id', projectIds)
        : Promise.resolve({ data: [] }),
    ])

    const contactMap = new Map<number, { name: string | null; email: string | null }>()
    for (const c of contactsRes.data || []) {
      contactMap.set(c.id, { name: c.name ?? null, email: c.email ?? null })
    }
    const projectMap = new Map<string, { project_name: string | null; client_name: string | null }>()
    for (const p of projectsRes.data || []) {
      projectMap.set(p.id, { project_name: p.project_name ?? null, client_name: p.client_name ?? null })
    }

    const meetingsOut = list.map((m: Row) => {
      const transcript = m.transcript ?? ''
      const summary = (m.structured_notes as { summary?: string } | null)?.summary ?? null
      const lead = m.contact_submission_id ? contactMap.get(m.contact_submission_id) : null
      const project = m.client_project_id ? projectMap.get(m.client_project_id) : null
      return {
        id: m.id,
        meeting_type: m.meeting_type,
        meeting_date: m.meeting_date,
        duration_minutes: m.duration_minutes,
        contact_submission_id: m.contact_submission_id,
        client_project_id: m.client_project_id,
        transcript_preview: transcript.length > TRANSCRIPT_PREVIEW_LEN ? transcript.slice(0, TRANSCRIPT_PREVIEW_LEN) + '…' : transcript || null,
        transcript_length: transcript.length,
        summary,
        lead_name: lead?.name ?? null,
        lead_email: lead?.email ?? null,
        project_name: project?.project_name ?? null,
        client_name: project?.client_name ?? null,
        created_at: m.created_at,
      }
    })

    return NextResponse.json({ meetings: meetingsOut, total: count ?? 0 })
  } catch (err) {
    console.error('[admin/meetings] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
