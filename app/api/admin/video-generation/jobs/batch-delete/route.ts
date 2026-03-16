import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/video-generation/jobs/batch-delete
 * Soft-delete multiple video generation jobs.
 * Body: { jobIds: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const jobIds = Array.isArray(body.jobIds) ? (body.jobIds as string[]).slice(0, 50) : []
  if (jobIds.length === 0) {
    return NextResponse.json({ error: 'No job IDs provided' }, { status: 400 })
  }

  const { error, count } = await supabaseAdmin
    .from('video_generation_jobs')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', jobIds)
    .is('deleted_at', null)

  if (error) {
    console.error('[jobs/batch-delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete jobs' }, { status: 500 })
  }

  return NextResponse.json({ deleted: count ?? jobIds.length })
}
