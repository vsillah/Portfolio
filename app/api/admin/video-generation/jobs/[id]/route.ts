import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/video-generation/jobs/[id]
 * Soft-delete a single video generation job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const jobId = params.id
  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('video_generation_jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', jobId)
    .is('deleted_at', null)

  if (error) {
    console.error('[jobs/delete] Error:', error)
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
