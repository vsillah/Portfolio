import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { extractLeadFieldsFromMeeting } from '@/lib/lead-from-meeting'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/meetings/:id/extract-lead-fields
 *
 * Uses AI to extract lead-creation fields (name, company, pain points, etc.)
 * from a meeting record's transcript. Returns pre-populated field values
 * for the Add Lead form.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const meetingId = params.id
  if (!meetingId) {
    return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
  }

  try {
    const { meeting, extracted } = await extractLeadFieldsFromMeeting(meetingId)

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        meeting_type: meeting.meeting_type,
        meeting_date: meeting.meeting_date,
      },
      fields: extracted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[extract-lead-fields] Error:', message)

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to extract lead fields from meeting transcript' }, { status: 500 })
  }
}
