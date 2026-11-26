import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  acquireYouTubeReadOnlyEvidence,
  YOUTUBE_EVIDENCE_CONTENT_ID,
  YOUTUBE_EVIDENCE_CALENDAR_ID,
  type YouTubeEvidenceRequest,
} from '@/lib/youtube-readonly-evidence-acquisition'

export const dynamic = 'force-dynamic'

/** Admin-only, exact-record-bound acquisition. No DB or provider mutation is reachable here. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (params.id !== YOUTUBE_EVIDENCE_CONTENT_ID) return NextResponse.json({ error: 'Outside acquisition scope.' }, { status: 404 })
  const body = await request.json().catch(() => null) as YouTubeEvidenceRequest | null
  if (!body || body.content_id !== YOUTUBE_EVIDENCE_CONTENT_ID || body.calendar_item_id !== YOUTUBE_EVIDENCE_CALENDAR_ID || typeof body.cohort_sha256 !== 'string' || typeof body.expected_content_updated_at !== 'string') {
    return NextResponse.json({ error: 'Exact acquisition binding is required.' }, { status: 400 })
  }
  try {
    // Keep all reads sequential and explicit so a test client can reject any write method.
    const content = await supabaseAdmin.from('social_content_queue').select('id, platform, updated_at').eq('id', params.id).maybeSingle()
    const calendar = await supabaseAdmin.from('social_content_calendar_items').select('id, social_content_id').eq('id', body.calendar_item_id).maybeSingle()
    const config = await supabaseAdmin.from('social_content_config').select('credentials, is_active').eq('platform', 'youtube').maybeSingle()
    if (content.error || calendar.error || config.error) return NextResponse.json({ error: 'Canonical acquisition evidence could not be read.' }, { status: 503 })
    const output = await acquireYouTubeReadOnlyEvidence({
      request: body,
      content_updated_at: content.data?.id === params.id && ['youtube', 'youtube_shorts'].includes(content.data?.platform) ? content.data.updated_at : null,
      calendar_bound: calendar.data?.id === YOUTUBE_EVIDENCE_CALENDAR_ID && calendar.data.social_content_id === params.id,
      credentials: config.data?.credentials ?? null,
      is_active: config.data?.is_active === true,
    })
    return NextResponse.json(output, { status: output.status === 'blocked' ? 409 : 200, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Read-only acquisition failed.' }, { status: 503 })
  }
}
