/**
 * GET /api/admin/video-generation/ideas-queue
 * List video ideas queue items for admin review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const status = request.nextUrl.searchParams.get('status') ?? 'pending'

    const { data: items, error } = await supabaseAdmin
      .from('video_ideas_queue')
      .select(
        'id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, created_at'
      )
      .eq('status', status)
      .order('created_at', { ascending: false })

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
