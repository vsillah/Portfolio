import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerSocialContentExtraction } from '@/lib/n8n'
import { getSocialContentPrompts } from '@/lib/system-prompts'
import { supabaseAdmin } from '@/lib/supabase'
import { extractMeetingTitle, extractMeetingSourceUrl, extractParticipants, extractMeetingSummary } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

const MAX_MEETINGS_PER_TRIGGER = 10
const WEBHOOK_DELAY_MS = 500

/**
 * Resolve unprocessed meetings server-side (same logic as WF-SOC-001's
 * "Fetch Unprocessed Meetings" node): last 7 days, up to cap, minus
 * meetings already in social_content_queue.
 */
async function resolveUnprocessedMeetings(cap: number): Promise<string[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: queued } = await supabaseAdmin
    .from('social_content_queue')
    .select('meeting_record_id')
    .not('meeting_record_id', 'is', null)
  const queuedIds = new Set((queued ?? []).map((r: { meeting_record_id: string | null }) => r.meeting_record_id).filter(Boolean))

  const { data: meetings } = await supabaseAdmin
    .from('meeting_records')
    .select('id')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(cap + queuedIds.size)

  return (meetings ?? [])
    .map((m: { id: string }) => m.id)
    .filter((id: string) => !queuedIds.has(id))
    .slice(0, cap)
}

/**
 * POST /api/admin/social-content/trigger
 *
 * Per-meeting extraction: creates one run row per meeting and fires
 * n8n webhooks sequentially with a 500ms delay.
 *
 * Body variants:
 *   { meeting_record_ids: string[] }  — extract specific meetings (max 10)
 *   { meeting_record_id: string }     — single meeting (backward compat)
 *   {}                                — extract all recent unprocessed
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json().catch(() => ({}))
    const {
      meeting_record_ids: rawIds,
      meeting_record_id: singleId,
    } = body as { meeting_record_ids?: string[]; meeting_record_id?: string }

    // Normalize to array
    let meetingIds: string[]
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      meetingIds = rawIds.slice(0, MAX_MEETINGS_PER_TRIGGER)
    } else if (singleId) {
      meetingIds = [singleId]
    } else {
      meetingIds = await resolveUnprocessedMeetings(MAX_MEETINGS_PER_TRIGGER)
    }

    if (meetingIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unprocessed meetings found.',
        runs: [],
      })
    }

    // Validate all meeting IDs exist
    const { data: validMeetings, error: validErr } = await supabaseAdmin
      .from('meeting_records')
      .select('id')
      .in('id', meetingIds)
    if (validErr) {
      return NextResponse.json({ error: 'Failed to validate meetings' }, { status: 500 })
    }
    const validIds = new Set((validMeetings ?? []).map((m: { id: string }) => m.id))
    meetingIds = meetingIds.filter(id => validIds.has(id))

    if (meetingIds.length === 0) {
      return NextResponse.json({ error: 'No valid meeting records found' }, { status: 404 })
    }

    // Idempotency: skip meetings that already have a running extraction
    const { data: activeRuns } = await supabaseAdmin
      .from('social_content_extraction_runs')
      .select('id, meeting_record_id')
      .eq('status', 'running')
      .in('meeting_record_id', meetingIds)
    const alreadyRunning = new Map<string, string>()
    for (const r of activeRuns ?? []) {
      if (r.meeting_record_id) alreadyRunning.set(r.meeting_record_id, r.id)
    }

    const prompts = await getSocialContentPrompts()
    const now = new Date().toISOString()

    // Insert all run rows before firing any webhooks (claim meetings)
    const runsToCreate = meetingIds.filter(id => !alreadyRunning.has(id))

    type RunInfo = { run_id: string; meeting_record_id: string; status: 'running' | 'skipped_existing' | 'failed' }
    const runs: RunInfo[] = []

    // Add already-running runs as "skipped"
    for (const id of meetingIds) {
      if (alreadyRunning.has(id)) {
        runs.push({ run_id: alreadyRunning.get(id)!, meeting_record_id: id, status: 'skipped_existing' })
      }
    }

    // Batch-insert new run rows
    if (runsToCreate.length > 0) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('social_content_extraction_runs')
        .insert(runsToCreate.map(id => ({
          triggered_at: now,
          status: 'running' as const,
          meeting_record_id: id,
        })))
        .select('id, meeting_record_id')

      if (insertErr || !inserted) {
        console.error('Failed to insert run rows:', insertErr)
        return NextResponse.json({ error: 'Failed to create run records' }, { status: 500 })
      }

      for (const row of inserted) {
        runs.push({ run_id: row.id, meeting_record_id: row.meeting_record_id!, status: 'running' })
      }
    }

    // Fire webhooks sequentially with delay (CTO rec: avoids thundering-herd)
    const newRuns = runs.filter(r => r.status === 'running')
    let triggeredCount = 0
    let lastError: string | null = null

    for (let i = 0; i < newRuns.length; i++) {
      const run = newRuns[i]
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, WEBHOOK_DELAY_MS))
      }

      const result = await triggerSocialContentExtraction({
        meetingRecordId: run.meeting_record_id,
        runId: run.run_id,
        prompts,
      })

      if (result.triggered) {
        triggeredCount++
      } else {
        lastError = result.message
        await supabaseAdmin
          .from('social_content_extraction_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: result.message ?? 'Webhook trigger failed',
          })
          .eq('id', run.run_id)
        run.status = 'failed'

        // Short-circuit on n8n errors (e.g. 502) to avoid hammering a down service
        if (result.message?.includes('502') || result.message?.includes('503')) {
          for (let j = i + 1; j < newRuns.length; j++) {
            await supabaseAdmin
              .from('social_content_extraction_runs')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: 'Skipped — n8n unavailable',
              })
              .eq('id', newRuns[j].run_id)
            newRuns[j].status = 'failed'
          }
          break
        }
      }
    }

    const skippedCount = runs.filter(r => r.status === 'skipped_existing').length

    return NextResponse.json({
      success: triggeredCount > 0,
      message: triggeredCount > 0
        ? `${triggeredCount} extraction(s) triggered${skippedCount > 0 ? `, ${skippedCount} already running` : ''}`
        : lastError ?? 'No extractions triggered',
      runs: runs.map(r => ({ run_id: r.run_id, meeting_record_id: r.meeting_record_id, status: r.status })),
      triggered: triggeredCount,
      skipped: skippedCount,
      failed: runs.filter(r => r.status === 'failed').length,
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
