import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerOutreachGeneration } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/leads/:id/generate
 *
 * Manually trigger outreach email generation (WF-CLG-002) for an existing lead.
 * Loads the lead and any linked meeting_records to build context for the email.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const contactId = parseInt(params.id, 10)
  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { data: lead, error: leadError } = await sb
    .from('contact_submissions')
    .select('id, name, email, company, rep_pain_points, quick_wins, do_not_contact, removed_at, lead_source')
    .eq('id', contactId)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (lead.do_not_contact) {
    return NextResponse.json(
      { error: 'Lead is marked as do-not-contact' },
      { status: 400 }
    )
  }

  if (lead.removed_at) {
    return NextResponse.json(
      { error: 'Lead has been removed' },
      { status: 400 }
    )
  }

  const { data: meetings } = await sb
    .from('meeting_records')
    .select('transcript, raw_notes, structured_notes')
    .eq('contact_submission_id', contactId)
    .order('meeting_date', { ascending: false })
    .limit(1)

  let meetingSummary: string | undefined
  if (meetings && meetings.length > 0) {
    const meeting = meetings[0]
    const notes = meeting.structured_notes as Record<string, unknown> | null
    meetingSummary = (notes?.summary as string)
      || meeting.raw_notes
      || (meeting.transcript ? meeting.transcript.substring(0, 1000) : undefined)
  }

  const painPoints = lead.rep_pain_points || lead.quick_wins || undefined

  try {
    await triggerOutreachGeneration({
      contact_id: contactId,
      score_tier: 'hot',
      lead_score: 80,
      sequence_step: 1,
      is_followup: false,
      meeting_summary: meetingSummary,
      pain_points: painPoints,
    })

    return NextResponse.json({ triggered: true })
  } catch (err) {
    console.error('[generate] Outreach generation trigger failed:', err)
    return NextResponse.json(
      { error: 'Failed to trigger outreach generation' },
      { status: 500 }
    )
  }
}
