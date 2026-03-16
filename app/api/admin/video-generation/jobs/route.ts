import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/video-generation/jobs
 *
 * List video generation jobs. Query params: status, channel, limit, offset.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim()
    const channel = searchParams.get('channel')?.trim()
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0

    let query = supabaseAdmin
      .from('video_generation_jobs')
      .select('id, script_source, script_text, drive_file_name, target_type, target_id, avatar_id, voice_id, aspect_ratio, channel, heygen_video_id, heygen_status, error_message, video_url, video_record_id, broll_asset_ids, created_at, created_by', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('heygen_status', status)
    }
    if (channel) {
      query = query.eq('channel', channel)
    }

    const { data: jobs, error, count } = await query

    if (error) {
      console.error('[Video generation jobs] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({
      jobs: jobs ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[Video generation jobs] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
