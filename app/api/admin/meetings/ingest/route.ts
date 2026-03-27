import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/meetings/ingest
 *
 * Manually ingest a pasted transcript as a meeting_record.
 * Used for external meetings not captured by Read.ai / WF-SLK.
 * The created record can then be used with the extract-lead-fields
 * endpoint to feed the same Saraev-based outreach pipeline.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  if (!transcript) {
    return NextResponse.json({ error: 'transcript is required and must be non-empty' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const meetingDate = typeof body.meeting_date === 'string' ? body.meeting_date : new Date().toISOString()
  const attendeeName = typeof body.attendee_name === 'string' ? body.attendee_name.trim() : ''
  const attendeeEmail = typeof body.attendee_email === 'string' ? body.attendee_email.trim() : ''
  const meetingType = typeof body.meeting_type === 'string' ? body.meeting_type.trim() : 'external'

  const attendees = (attendeeName || attendeeEmail)
    ? [{ name: attendeeName || undefined, email: attendeeEmail || undefined }]
    : []

  const rawNotes = title
    ? `${title}\n\n${transcript.substring(0, 500)}`
    : transcript.substring(0, 500)

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { data, error } = await sb
    .from('meeting_records')
    .insert({
      meeting_type: meetingType,
      meeting_date: meetingDate,
      transcript,
      raw_notes: rawNotes,
      attendees: attendees.length > 0 ? attendees : null,
      structured_notes: title ? { title } : null,
    })
    .select('id, meeting_type, meeting_date, transcript, raw_notes, attendees, created_at')
    .single()

  if (error) {
    console.error('[meetings/ingest] Insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to save meeting record' }, { status: 500 })
  }

  return NextResponse.json({ meeting: data }, { status: 201 })
}
