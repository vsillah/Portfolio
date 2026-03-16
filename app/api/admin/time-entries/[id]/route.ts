import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/time-entries/[id]
 * Stop a running timer. Calculates duration from started_at to now.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  const { data: entry } = await supabaseAdmin
    .from('time_entries')
    .select('*')
    .eq('id', id)
    .single()

  if (!entry) {
    return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
  }

  if (!entry.is_running) {
    return NextResponse.json({ error: 'Timer is not running' }, { status: 400 })
  }

  const now = new Date()
  const elapsed = Math.round((now.getTime() - new Date(entry.started_at).getTime()) / 1000)

  const { data, error } = await supabaseAdmin
    .from('time_entries')
    .update({
      is_running: false,
      stopped_at: now.toISOString(),
      duration_seconds: elapsed,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error stopping timer:', error)
    return NextResponse.json({ error: 'Failed to stop timer' }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}

/**
 * DELETE /api/admin/time-entries/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('time_entries')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting time entry:', error)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
