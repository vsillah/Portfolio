import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/dashboard-tasks/[id]
 * Update a dashboard task's status from admin side.
 * Body: { status: 'pending' | 'in_progress' | 'complete' }
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
  const body = await request.json()
  const { status } = body

  if (!status || !['pending', 'in_progress', 'complete'].includes(status)) {
    return NextResponse.json(
      { error: 'status must be pending, in_progress, or complete' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'complete') {
    updateData.completed_at = new Date().toISOString()
  } else {
    updateData.completed_at = null
  }

  const { data, error } = await supabaseAdmin
    .from('dashboard_tasks')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating dashboard task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  return NextResponse.json({ task: data })
}
