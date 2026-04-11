import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildMeetingRecordDetail } from '@/lib/admin-meeting-record-detail'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/meetings/:id
 *
 * Returns a meeting_record in the same shape as Read.ai detail for enrich-modal import.
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

  const { data: row, error } = await supabaseAdmin
    .from('meeting_records')
    .select('id, meeting_type, meeting_date, transcript, structured_notes, action_items, key_decisions')
    .eq('id', id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Meeting record not found' }, { status: 404 })
  }

  return NextResponse.json({
    meeting: buildMeetingRecordDetail(row),
  })
}
