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
      .select('id, meeting_type, meeting_date, created_at, transcript, structured_notes, duration_minutes')
      .order('meeting_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching meeting records:', error)
      return NextResponse.json({ error: 'Failed to fetch meeting records' }, { status: 500 })
    }

    const meetingIds = (meetings ?? []).map((m: { id: string }) => m.id)
    const { data: queuedItems } = meetingIds.length > 0
      ? await supabaseAdmin
          .from('social_content_queue')
          .select('meeting_record_id')
          .in('meeting_record_id', meetingIds)
      : { data: [] }

    const queuedCounts = new Map<string, number>()
    for (const item of queuedItems ?? []) {
      if (item.meeting_record_id) {
        queuedCounts.set(item.meeting_record_id, (queuedCounts.get(item.meeting_record_id) || 0) + 1)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedMeetings = (meetings ?? []).map((m: any) => {
      const notes = m.structured_notes as Record<string, unknown> | null
      const summary = notes?.summary as string | undefined
      const title = notes?.title as string | undefined

      let snippet = title || summary || ''
      if (!snippet && m.transcript) {
        const cleaned = (m.transcript as string)
          .replace(/<[^>]+>/g, '')
          .replace(/\*[^*]+\*/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        snippet = cleaned.slice(0, 80)
      }

      return {
        id: m.id,
        meeting_type: m.meeting_type,
        meeting_date: m.meeting_date,
        created_at: m.created_at,
        duration_minutes: m.duration_minutes,
        snippet: snippet || null,
        queued_count: queuedCounts.get(m.id) || 0,
      }
    })

    return NextResponse.json({
      meetings: enrichedMeetings,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content/trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
