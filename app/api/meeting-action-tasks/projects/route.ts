import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meeting-action-tasks/projects
 *
 * Returns client projects that have at least one meeting_action_task,
 * for use in the "filter by client" dropdown.
 * Auth: admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data: taskRows } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('client_project_id')
      .not('client_project_id', 'is', null)

    type Row = { client_project_id: string | null }
    const projectIds = [...new Set((taskRows || []).map((r: Row) => r.client_project_id).filter(Boolean))] as string[]
    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    const { data: projects, error } = await supabaseAdmin
      .from('client_projects')
      .select('id, project_name, client_name')
      .in('id', projectIds)
      .order('client_name', { ascending: true })

    if (error) {
      console.error('[Meeting action tasks projects] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type ProjectRow = { id: string; project_name: string | null; client_name: string | null }
    const list = (projects || []).map((p: ProjectRow) => ({
      id: p.id,
      project_name: p.project_name ?? null,
      client_name: p.client_name ?? null,
    }))

    return NextResponse.json({ projects: list })
  } catch (error) {
    console.error('[Meeting action tasks projects] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
