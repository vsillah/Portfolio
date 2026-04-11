import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { shouldUseMatchEmailBranch, toEmailLikePattern } from '@/lib/admin-meetings-query'

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
 *   - attributed_only: if "true", only meetings that have contact_submission_id or client_project_id
 *   - contact_submission_id: filter to meetings for this lead (used by "View source transcripts" from diagnostic)
 *   - match_email: case-insensitive email — meetings linked to a lead with that email, plus unlinked rows whose transcript or raw_notes contains the email (Add Lead / Read.ai merge). Mutually exclusive with contact_submission_id, unlinked_only, attributed_only, and q.
 *   - q: search text (matches meeting_type, transcript snippet)
 *   - date_from: filter meetings on or after this date (YYYY-MM-DD)
 *   - date_to: filter meetings on or before this date (YYYY-MM-DD)
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
  const attributedOnly = searchParams.get('attributed_only') === 'true'
  const contactIdParam = searchParams.get('contact_submission_id')
  const contactSubmissionId = contactIdParam ? Number(contactIdParam) : undefined
  const matchEmail = (searchParams.get('match_email') || '').trim()
  const q = (searchParams.get('q') || '').trim()
  const dateFrom = searchParams.get('date_from') || ''
  const dateTo = searchParams.get('date_to') || ''
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
  const offset = Number(searchParams.get('offset') || 0) || 0

  try {
    const listSelect =
      'id, meeting_type, meeting_date, duration_minutes, contact_submission_id, client_project_id, transcript, structured_notes, created_at'

    // Email-based merge for Add Lead Read.ai tab: attributed + unlinked text match
    if (shouldUseMatchEmailBranch({ matchEmail, contactIdParam, unlinkedOnly, attributedOnly, q })) {
      const likePattern = toEmailLikePattern(matchEmail)

      const { data: contacts, error: contactsErr } = await supabaseAdmin
        .from('contact_submissions')
        .select('id')
        .ilike('email', matchEmail)

      if (contactsErr) {
        console.error('[admin/meetings] match_email contacts:', contactsErr)
        return NextResponse.json({ error: 'Failed to resolve contacts by email' }, { status: 500 })
      }

      const contactIds = [...new Set((contacts || []).map((c: { id: number }) => c.id))]

      const byId = new Map<
        string,
        {
          id: string
          meeting_type: string
          meeting_date: string
          duration_minutes: number | null
          contact_submission_id: number | null
          client_project_id: string | null
          transcript: string | null
          structured_notes: unknown
          created_at: string
        }
      >()

      if (contactIds.length > 0) {
        const { data: linked, error: linkedErr } = await supabaseAdmin
          .from('meeting_records')
          .select(listSelect)
          .in('contact_submission_id', contactIds)
          .order('meeting_date', { ascending: false })
          .limit(100)

        if (linkedErr) {
          console.error('[admin/meetings] match_email linked:', linkedErr)
          return NextResponse.json({ error: 'Failed to fetch linked meetings' }, { status: 500 })
        }
        for (const row of linked || []) byId.set(row.id, row)
      }

      const remaining = Math.max(0, 100 - byId.size)
      if (remaining > 0) {
        const unlinkedBase = () =>
          supabaseAdmin
            .from('meeting_records')
            .select(listSelect)
            .is('contact_submission_id', null)
            .is('client_project_id', null)
            .order('meeting_date', { ascending: false })
            .limit(remaining)

        const [tRes, rRes] = await Promise.all([
          unlinkedBase().ilike('transcript', likePattern),
          unlinkedBase().ilike('raw_notes', likePattern),
        ])

        if (tRes.error) {
          console.error('[admin/meetings] match_email unlinked transcript:', tRes.error)
          return NextResponse.json({ error: 'Failed to fetch unlinked meetings' }, { status: 500 })
        }
        if (rRes.error) {
          console.error('[admin/meetings] match_email unlinked raw_notes:', rRes.error)
          return NextResponse.json({ error: 'Failed to fetch unlinked meetings' }, { status: 500 })
        }
        for (const row of [...(tRes.data || []), ...(rRes.data || [])]) {
          if (!byId.has(row.id)) byId.set(row.id, row)
        }
      }

      const merged = [...byId.values()].sort(
        (a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
      )
      const paged = merged.slice(offset, offset + limit)
      if (paged.length === 0) {
        return NextResponse.json({ meetings: [], total: merged.length, stats: null })
      }

      type Row = (typeof paged)[number]
      const cIds = [...new Set(paged.map((m: Row) => m.contact_submission_id).filter(Boolean))] as number[]
      const pIds = [...new Set(paged.map((m: Row) => m.client_project_id).filter(Boolean))] as string[]

      const [contactsRes, projectsRes] = await Promise.all([
        cIds.length > 0
          ? supabaseAdmin.from('contact_submissions').select('id, name, email').in('id', cIds)
          : Promise.resolve({ data: [] }),
        pIds.length > 0
          ? supabaseAdmin.from('client_projects').select('id, project_name, client_name').in('id', pIds)
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

      const meetingsOut = paged.map((m: Row) => {
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
          transcript_preview:
            transcript.length > TRANSCRIPT_PREVIEW_LEN ? transcript.slice(0, TRANSCRIPT_PREVIEW_LEN) + '…' : transcript || null,
          transcript_length: transcript.length,
          summary,
          lead_name: lead?.name ?? null,
          lead_email: lead?.email ?? null,
          project_name: project?.project_name ?? null,
          client_name: project?.client_name ?? null,
          created_at: m.created_at,
        }
      })

      return NextResponse.json({ meetings: meetingsOut, total: merged.length, stats: null })
    }

    const statsPromise = Promise.all([
      supabaseAdmin.from('meeting_records').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('meeting_records').select('id', { count: 'exact', head: true })
        .is('contact_submission_id', null).is('client_project_id', null),
    ]).then(([allRes, unlinkedRes]) => ({
      total: allRes.count ?? 0,
      not_attributed: unlinkedRes.count ?? 0,
      attributed: (allRes.count ?? 0) - (unlinkedRes.count ?? 0),
    })).catch(() => ({ total: 0, not_attributed: 0, attributed: 0 }))

    let query = supabaseAdmin
      .from('meeting_records')
      .select(`${listSelect}`, { count: 'exact' })
      .order('meeting_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (contactSubmissionId != null && Number.isInteger(contactSubmissionId)) {
      query = query.eq('contact_submission_id', contactSubmissionId)
    } else if (unlinkedOnly) {
      query = query.is('contact_submission_id', null).is('client_project_id', null)
    } else if (attributedOnly) {
      query = query.or('contact_submission_id.not.is.null,client_project_id.not.is.null')
    }
    if (q) {
      query = query.or(`meeting_type.ilike.%${q}%,transcript.ilike.%${q}%`)
    }
    if (dateFrom) {
      query = query.gte('meeting_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('meeting_date', dateTo)
    }

    const [{ data: meetings, error, count }, stats] = await Promise.all([query, statsPromise])

    if (error) {
      console.error('[admin/meetings] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
    }

    const list = meetings || []
    if (list.length === 0) {
      return NextResponse.json({ meetings: [], total: count ?? 0, stats: stats ?? null })
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

    return NextResponse.json({ meetings: meetingsOut, total: count ?? 0, stats: stats ?? null })
  } catch (err) {
    console.error('[admin/meetings] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
