import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/video-generation/meetings
 *
 * List meeting records for the video generation "From Meetings" picker.
 * Returns compact rows (no full transcript).
 *
 * Query params:
 *   - q: search text (matches meeting_type, structured_notes summary, transcript excerpt)
 *   - client: email filter (matches contact_submission email or client_project email)
 *   - from: ISO date string — meetings on or after this date
 *   - to: ISO date string — meetings on or before this date
 *   - limit: max results (default 20, max 50)
 *   - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const clientEmail = (searchParams.get('client') || '').trim().toLowerCase()
  const from = searchParams.get('from')?.trim()
  const to = searchParams.get('to')?.trim()
  const limit = Math.min(Number(searchParams.get('limit') || 20), 50)
  const offset = Number(searchParams.get('offset') || 0) || 0

  try {
    let query = supabaseAdmin
      .from('meeting_records')
      .select(
        'id, meeting_type, meeting_date, duration_minutes, contact_submission_id, client_project_id, structured_notes, key_decisions, transcript',
        { count: 'exact' }
      )
      .order('meeting_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (from) query = query.gte('meeting_date', from)
    if (to) query = query.lte('meeting_date', to)

    if (q) {
      query = query.or(
        `meeting_type.ilike.%${q}%,transcript.ilike.%${q}%`
      )
    }

    const { data: meetings, error, count } = await query

    if (error) {
      console.error('[video-generation/meetings] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
    }

    if (!meetings || meetings.length === 0) {
      return NextResponse.json({ meetings: [], total: count ?? 0 })
    }

    // Batch-resolve contact_submission_ids and client_project_ids
    type MeetingRow = typeof meetings[number]
    const contactIds = [...new Set(meetings.map((m: MeetingRow) => m.contact_submission_id).filter(Boolean))]
    const projectIds = [...new Set(meetings.map((m: MeetingRow) => m.client_project_id).filter(Boolean))]

    const [contactsRes, projectsRes] = await Promise.all([
      contactIds.length > 0
        ? supabaseAdmin.from('contact_submissions').select('id, name, email, company').in('id', contactIds)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? supabaseAdmin.from('client_projects').select('id, client_name, client_email, client_company').in('id', projectIds)
        : Promise.resolve({ data: [] }),
    ])

    type ContactRow = { id: string | number; name: string | null; email: string | null; company: string | null }
    type ProjectRow = { id: string; client_name: string | null; client_email: string | null; client_company: string | null }
    const contactMap = new Map((contactsRes.data as ContactRow[] ?? []).map(c => [String(c.id), c]))
    const projectMap = new Map((projectsRes.data as ProjectRow[] ?? []).map(p => [p.id, p]))

    let results = meetings.map((m: MeetingRow) => {
      const notes = m.structured_notes as Record<string, unknown> | null
      const summary = (notes?.summary as string) ?? (notes?.highlights as string) ?? null

      const contact = m.contact_submission_id ? contactMap.get(String(m.contact_submission_id)) : null
      const project = m.client_project_id ? projectMap.get(m.client_project_id) : null

      const clientName = project?.client_name ?? contact?.name ?? null
      const clientCompany = project?.client_company ?? contact?.company ?? null
      const clientEmailResolved = project?.client_email ?? contact?.email ?? null

      return {
        id: m.id,
        meeting_type: m.meeting_type,
        meeting_date: m.meeting_date,
        duration_minutes: m.duration_minutes,
        summary: summary ? (summary.length > 120 ? summary.slice(0, 120) + '...' : summary) : null,
        client_name: clientName,
        client_company: clientCompany,
        client_email: clientEmailResolved,
        has_transcript: !!m.transcript,
        key_decisions_count: Array.isArray(m.key_decisions) ? (m.key_decisions as unknown[]).length : 0,
      }
    })

    // Client email filter (post-query since it requires join resolution)
    if (clientEmail) {
      results = results.filter((r: { client_email: string | null }) => r.client_email?.toLowerCase() === clientEmail)
    }

    return NextResponse.json({
      meetings: results,
      total: clientEmail ? results.length : (count ?? 0),
    })
  } catch (error) {
    console.error('[video-generation/meetings] Error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
