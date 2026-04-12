/**
 * GET /api/read-ai-meeting-dedupe?read_ai_meeting_id=xxx
 *
 * Used by WF-MCH (after Extract Meeting Data) to skip AI + insert when this Read.ai
 * meeting id was already stored (Slack WF-SLK can emit multiple Slack event_ids per recap).
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
  const raw = request.nextUrl.searchParams.get('read_ai_meeting_id')?.trim() ?? ''
  if (!raw) {
    return NextResponse.json({ duplicate: false, meeting_record_id: null }, { status: 200 })
  }

  const { data, error } = await supabaseAdmin
    .from('meeting_records')
    .select('id')
    .eq('read_ai_meeting_id', raw)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('read-ai-meeting-dedupe GET error:', error)
    return NextResponse.json({ duplicate: false, meeting_record_id: null }, { status: 200 })
  }

  return NextResponse.json({
    duplicate: !!data?.id,
    meeting_record_id: data?.id ?? null,
  })
}
