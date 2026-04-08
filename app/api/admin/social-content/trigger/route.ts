import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerSocialContentExtraction } from '@/lib/n8n'
import { getSocialContentPrompts } from '@/lib/system-prompts'
import { supabaseAdmin } from '@/lib/supabase'
import { extractMeetingTitle, extractMeetingSourceUrl, extractParticipants, extractMeetingSummary } from '@/lib/social-content'

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

    // Record extraction run (mirrors value_evidence_workflow_runs pattern)
    const { data: run } = await supabaseAdmin
      .from('social_content_extraction_runs')
      .insert({
        triggered_at: new Date().toISOString(),
        status: 'running',
        meeting_record_id: meeting_record_id ?? null,
      })
      .select('id')
      .single()

    const result = await triggerSocialContentExtraction({
      meetingRecordId: meeting_record_id,
      runId: run?.id,
      prompts,
    })

    // Update run status based on trigger result
    if (run?.id) {
      await supabaseAdmin
        .from('social_content_extraction_runs')
        .update({
          status: result.triggered ? 'running' : 'failed',
          error_message: result.triggered ? null : (result.message ?? null),
          ...(result.triggered ? {} : { completed_at: new Date().toISOString() }),
        })
        .eq('id', run.id)
    }

    return NextResponse.json({
      success: result.triggered,
      message: result.message,
      meeting_record_id: meeting_record_id ?? null,
      run_id: run?.id ?? null,
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
 * Returns meeting records for the extraction meeting picker.
 * Supports search (q), date range (from/to), and pagination (limit/offset).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const q = searchParams.get('q')?.trim() || ''
    const dateFrom = searchParams.get('from') || ''
    const dateTo = searchParams.get('to') || ''

    const { data: rpcRows, error } = await supabaseAdmin
      .rpc('search_meeting_records', {
        search_term: q || null,
        date_from: dateFrom || null,
        date_to: dateTo ? `${dateTo}T23:59:59` : null,
        result_limit: limit,
        result_offset: offset,
      })

    if (error) {
      console.error('Error fetching meeting records:', error)
      return NextResponse.json({ error: 'Failed to fetch meeting records' }, { status: 500 })
    }

    const meetings = rpcRows ?? []
    const count = meetings.length > 0 ? (meetings[0] as { total_count: number }).total_count : 0

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

    const enrichedMeetings = (meetings ?? []).map((m: {
      id: string; meeting_type: string; meeting_date: string; created_at: string;
      transcript: string | null; structured_notes: Record<string, unknown> | null;
      duration_minutes: number | null; raw_notes: string | null;
      meeting_data: unknown; attendees: unknown;
    }) => {
      const notes = m.structured_notes
      let meetingTitle = extractMeetingTitle(m.raw_notes, notes)
      const participants = extractParticipants(m.meeting_data, m.attendees)

      let snippet = extractMeetingSummary(m.raw_notes, notes)
      if (!snippet && m.transcript) {
        const cleaned = (m.transcript as string)
          .replace(/<[^>]+>/g, '')
          .replace(/\*[^*]+\*/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        snippet = cleaned.slice(0, 120)
      }

      if (!meetingTitle && snippet) {
        const topicPhrase = snippet
          .replace(/^The meeting (focused on|reviewed|discussed|opened with|covered)\s*/i, '')
          .replace(/,.*$/, '')
          .trim()
        const shortTopic = topicPhrase.split(/\s+/).slice(0, 7).join(' ')
        if (participants.length > 0) {
          meetingTitle = `${participants[0]} — ${shortTopic}`
        } else {
          meetingTitle = shortTopic.charAt(0).toUpperCase() + shortTopic.slice(1)
        }
      }

      return {
        id: m.id,
        meeting_type: m.meeting_type,
        meeting_date: m.meeting_date,
        created_at: m.created_at,
        duration_minutes: m.duration_minutes,
        meeting_title: meetingTitle,
        participants,
        source_url: extractMeetingSourceUrl(m.raw_notes),
        snippet: snippet || null,
        queued_count: queuedCounts.get(m.id) || 0,
        has_transcript: !!(m.transcript),
      }
    })

    return NextResponse.json({
      meetings: enrichedMeetings,
      total: count ?? enrichedMeetings.length,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content/trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
