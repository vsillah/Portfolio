import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/time-entries/active?project_id=...
 * Returns all currently running timers, optionally filtered by project.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  let query = supabaseAdmin
    .from('time_entries')
    .select('*')
    .eq('is_running', true)
    .eq('created_by', auth.user.id)

  if (projectId) {
    query = query.eq('client_project_id', projectId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching active timers:', error)
    return NextResponse.json({ error: 'Failed to fetch active timers' }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}
