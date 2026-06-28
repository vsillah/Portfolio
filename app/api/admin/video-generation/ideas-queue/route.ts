/**
 * GET /api/admin/video-generation/ideas-queue
 * List video ideas queue items for admin review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BASE_IDEAS_QUEUE_SELECT =
  'id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, created_at'

const SCRIPT_IDEAS_QUEUE_SELECT =
  `${BASE_IDEAS_QUEUE_SELECT}, script_template_id, script_outline, script_scorecard, research_packet_ids`

function isMissingScriptIntelligenceColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42703' && /script_template_id|script_outline|script_scorecard|research_packet_ids/.test(error.message ?? '')
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const status = request.nextUrl.searchParams.get('status') ?? 'pending'

    const query = supabaseAdmin
      .from('video_ideas_queue')
      .select(SCRIPT_IDEAS_QUEUE_SELECT)
      .eq('status', status)
      .order('created_at', { ascending: false })

    let { data: items, error } = await query

    if (isMissingScriptIntelligenceColumn(error)) {
      const fallback = await supabaseAdmin
        .from('video_ideas_queue')
        .select(BASE_IDEAS_QUEUE_SELECT)
        .eq('status', status)
        .order('created_at', { ascending: false })

      items = (fallback.data ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        script_template_id: null,
        script_outline: {},
        script_scorecard: {},
        research_packet_ids: [],
      }))
      error = fallback.error
    }

    if (error) {
      console.error('[video-generation] Ideas queue list error:', error)
      return NextResponse.json(
        { error: 'Failed to list ideas queue' },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: items ?? [] })
  } catch (error) {
    console.error('[video-generation] Ideas queue error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
