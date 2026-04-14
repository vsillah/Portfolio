import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['meeting', 'assessment', 'lead'] as const

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
        .select('id, meeting_type, meeting_date, structured_notes, contact_submission_id, transcript')
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

      const entities = (data || []).map((m: { id: string; meeting_type: string | null; meeting_date: string | null; structured_notes: unknown; contact_submission_id: number | null; transcript: string | null }) => {
        const notes = m.structured_notes as { summary?: string } | null
        const summary = notes?.summary || ''
        const label = summary
          ? summary.substring(0, 80) + (summary.length > 80 ? '...' : '')
          : `${m.meeting_type || 'Meeting'} — ${m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : 'Unknown date'}`
        return {
          id: m.id,
          label,
          subtitle: m.meeting_date ? new Date(m.meeting_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : null,
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
