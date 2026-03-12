/**
 * GET /api/admin/video-generation/queue
 * List pending Drive queue items for admin review.
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
      .from('drive_video_queue')
      .select('id, drive_file_id, drive_file_name, script_text_prior, script_text, effective_at, detected_at, status, video_generation_job_id')
      .eq('status', status)
      .order('detected_at', { ascending: false })

    if (error) {
      console.error('[video-generation] Queue list error:', error)
      return NextResponse.json({ error: 'Failed to list queue' }, { status: 500 })
    }

    return NextResponse.json({ items: items ?? [] })
  } catch (error) {
    console.error('[video-generation] Queue error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
