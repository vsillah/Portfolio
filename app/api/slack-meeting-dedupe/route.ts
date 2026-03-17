/**
 * GET /api/slack-meeting-dedupe?event_id=xxx
 * POST /api/slack-meeting-dedupe with body { event_id: string }
 *
 * Used by WF-SLK (Slack Meeting Intake) to dedupe by Slack event_id.
 * Auth: Bearer N8N_INGEST_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function authorize(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.N8N_INGEST_SECRET
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  return !!(expected && token === expected)
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const eventId = request.nextUrl.searchParams.get('event_id')
  if (!eventId || typeof eventId !== 'string') {
    return NextResponse.json({ duplicate: false }, { status: 200 })
  }
  const { data, error } = await supabaseAdmin
    .from('slack_meeting_events_processed')
    .select('event_id')
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('slack-meeting-dedupe GET error:', error)
    return NextResponse.json({ duplicate: false }, { status: 200 })
  }
  return NextResponse.json({ duplicate: !!data })
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { event_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const eventId = body?.event_id
  if (!eventId || typeof eventId !== 'string') {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('slack_meeting_events_processed')
    .insert({ event_id: eventId })
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    console.error('slack-meeting-dedupe POST error:', error)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
