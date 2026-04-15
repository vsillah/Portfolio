import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['meeting', 'assessment', 'lead'] as const

function parseMeetingStructuredNotes(raw: unknown): { text: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const text = summary || title
  return text ? { text } : null
}

/** Date + local time so same calendar day meetings are distinguishable. */
function formatMeetingWhen(iso: string | null): string {
  if (!iso) return 'Unknown date'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return 'Unknown date'
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * GET /api/admin/value-evidence/scope-entities?type=meeting|assessment|lead&q=search
 * Returns recent entities for the targeted-run scope picker.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const q = searchParams.get('q')?.trim() || ''
  const contactId = searchParams.get('contact_submission_id')

  if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    if (type === 'meeting') {
      let query = supabaseAdmin
        .from('meeting_records')
        .select('id, meeting_type, meeting_date, structured_notes, contact_submission_id, transcript, duration_minutes')
        .not('transcript', 'is', null)
        .order('meeting_date', { ascending: false })
        .limit(20)

      if (contactId) {
        query = query.eq('contact_submission_id', contactId)
      }
      if (q) {
        query = query.or(`meeting_type.ilike.%${q}%,transcript.ilike.%${q}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const rows =
        (data || []) as Array<{
          id: string
          meeting_type: string | null
          meeting_date: string | null
          structured_notes: unknown
          contact_submission_id: number | null
          transcript: string | null
          duration_minutes: number | null
        }>

      const contactIds = [
        ...new Set(
          rows.map(r => r.contact_submission_id).filter((id): id is number => id != null && Number.isFinite(id)),
        ),
      ]
      const contactById = new Map<number, { name: string | null; company: string | null }>()
      if (contactIds.length > 0) {
        const { data: contacts, error: contactsErr } = await supabaseAdmin
          .from('contact_submissions')
          .select('id, name, company')
          .in('id', contactIds)
        if (contactsErr) throw contactsErr
        for (const c of contacts || []) {
          const row = c as { id: number; name: string | null; company: string | null }
          contactById.set(row.id, { name: row.name, company: row.company })
        }
      }

      const entities = rows.map(m => {
        const notes = parseMeetingStructuredNotes(m.structured_notes)
        const blurb = notes?.text || ''
        const typeDisplay = (m.meeting_type || 'Meeting').replace(/_/g, ' ')
        const when = formatMeetingWhen(m.meeting_date)

        const label =
          blurb.length > 0
            ? blurb.length > 80
              ? `${blurb.slice(0, 80)}…`
              : blurb
            : `${typeDisplay} — ${when}`

        const contact = m.contact_submission_id != null ? contactById.get(m.contact_submission_id) : undefined
        const contactLine =
          contact && (contact.company || contact.name)
            ? [contact.company, contact.name].filter(Boolean).join(' · ')
            : null

        const subtitleParts: string[] = []
        if (blurb.length > 0) subtitleParts.push(when)
        if (contactLine) subtitleParts.push(contactLine)
        if (m.duration_minutes != null && Number(m.duration_minutes) > 0) {
          subtitleParts.push(`${m.duration_minutes} min`)
        }
        subtitleParts.push(`#${m.id.slice(0, 8)}`)

        return {
          id: m.id,
          label,
          subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : null,
          hasTranscript: !!m.transcript,
          contactSubmissionId: m.contact_submission_id,
        }
      })

      return NextResponse.json({ entities })
    }

    if (type === 'assessment') {
      let query = supabaseAdmin
        .from('diagnostic_audits')
        .select('id, audit_type, created_at, diagnostic_summary, contact_submission_id, status')
        .order('created_at', { ascending: false })
        .limit(20)

      if (contactId) {
        query = query.eq('contact_submission_id', contactId)
      }
      if (q) {
        query = query.or(`audit_type.ilike.%${q}%,diagnostic_summary.ilike.%${q}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const entities = (data || []).map((a: { id: string; audit_type: string | null; created_at: string | null; diagnostic_summary: unknown; contact_submission_id: number | null; status: string | null }) => {
        const summary = (a.diagnostic_summary as string) || ''
        const label = summary
          ? summary.substring(0, 80) + (summary.length > 80 ? '...' : '')
          : `${a.audit_type || 'Assessment'} — ${a.created_at ? new Date(a.created_at).toLocaleDateString() : 'Unknown date'}`
        return {
          id: a.id,
          label,
          subtitle: a.created_at ? new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : null,
          auditType: a.audit_type,
          status: a.status,
          contactSubmissionId: a.contact_submission_id,
        }
      })

      return NextResponse.json({ entities })
    }

    if (type === 'lead') {
      let query = supabaseAdmin
        .from('contact_submissions')
        .select('id, name, company, industry, rep_pain_points, company_domain')
        .order('created_at', { ascending: false })
        .limit(20)

      if (q) {
        query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,industry.ilike.%${q}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const entities = (data || []).map((c: { id: number; name: string | null; company: string | null; industry: string | null; rep_pain_points: string | null; company_domain: string | null }) => ({
        id: c.id,
        label: c.company || c.name || `Lead #${c.id}`,
        subtitle: [c.industry, c.name].filter(Boolean).join(' · ') || null,
        hasPainPoints: !!c.rep_pain_points,
      }))

      return NextResponse.json({ entities })
    }

    return NextResponse.json({ entities: [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('scope-entities error:', message)
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 })
  }
}
