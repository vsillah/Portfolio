import { NextRequest, NextResponse } from 'next/server'
import { validateDashboardToken } from '@/lib/client-dashboard'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client/dashboard/[token]/meetings
 * Returns past meetings for the client project linked to this dashboard token.
 * Includes structured notes, action items, and key decisions — not full transcripts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { projectId, error: tokenError } = await validateDashboardToken(token)
  if (tokenError || !projectId) {
    return NextResponse.json(
      { error: tokenError || 'Invalid dashboard link' },
      { status: 401 }
    )
  }

  const { data: meetings, error } = await supabaseAdmin
    .from('meeting_records')
    .select(`
      id, meeting_type, meeting_date, duration_minutes,
      structured_notes, key_decisions, action_items, open_questions,
      recording_url
    `)
    .eq('client_project_id', projectId)
    .order('meeting_date', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }

  return NextResponse.json({ meetings: meetings || [] })
}
