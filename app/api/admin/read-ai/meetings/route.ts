import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { searchMeetingsByAttendeeEmail, isReadAiConfigured } from '@/lib/read-ai'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/read-ai/meetings?email=<email>
 *
 * Returns Read.ai meetings where the given email is a participant.
 * Includes summary and action_items (no transcript — that's fetched on demand).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email query parameter is required' }, { status: 400 })
  }

  const configured = await isReadAiConfigured()
  if (!configured) {
    return NextResponse.json({ error: 'Read.ai integration is not configured' }, { status: 503 })
  }

  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const meetings = await searchMeetingsByAttendeeEmail(email, {
      maxPages: 5,
      afterMs: thirtyDaysAgo,
    })

    return NextResponse.json({
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        start_time_ms: m.start_time_ms,
        end_time_ms: m.end_time_ms,
        participants: m.participants,
        platform: m.platform,
        report_url: m.report_url,
        summary: m.summary ?? null,
        action_items: m.action_items ?? null,
      })),
      count: meetings.length,
    })
  } catch (err) {
    console.error('[read-ai/meetings] Search failed:', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch meetings'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
