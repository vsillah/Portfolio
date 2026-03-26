import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerSocialContentExtraction } from '@/lib/n8n'
import { getSocialContentPrompts } from '@/lib/system-prompts'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/trigger
 * Manually trigger the social content extraction workflow (WF-SOC-001).
 * Fetches the latest admin-editable prompts from system_prompts and sends
 * them to n8n so the workflow uses the configured versions.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json().catch(() => ({}))
    const { meeting_record_id } = body as { meeting_record_id?: string }

    if (meeting_record_id) {
      const { data: meeting, error: meetingError } = await supabaseAdmin
        .from('meeting_records')
        .select('id')
        .eq('id', meeting_record_id)
        .maybeSingle()

      if (meetingError || !meeting) {
        return NextResponse.json(
          { error: 'Meeting record not found' },
          { status: 404 }
        )
      }
    }

    const prompts = await getSocialContentPrompts()

    const result = await triggerSocialContentExtraction({
      meetingRecordId: meeting_record_id,
      prompts,
    })

    return NextResponse.json({
      success: result.triggered,
      message: result.message,
      meeting_record_id: meeting_record_id ?? null,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/social-content/trigger
 * Returns recent meeting records that can be used for extraction.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const { data: meetings, error } = await supabaseAdmin
      .from('meeting_records')
      .select('id, meeting_type, meeting_date, created_at')
      .order('meeting_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching meeting records:', error)
      return NextResponse.json({ error: 'Failed to fetch meeting records' }, { status: 500 })
    }

    return NextResponse.json({
      meetings: meetings ?? [],
    })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content/trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
