import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/lead-dashboards
 * List lead dashboards (rows where client_project_id is null).
 * Returns: array of { id, diagnostic_audit_id, client_email, access_token, created_at, last_accessed_at, url }.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('id, diagnostic_audit_id, client_email, access_token, created_at, last_accessed_at')
    .is('client_project_id', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Lead dashboards list error:', error)
    return NextResponse.json(
      { error: 'Failed to list lead dashboards' },
      { status: 500 }
    )
  }

  const origin = request.headers.get('origin') || request.nextUrl.origin
  const list = (rows || []).map((row: { access_token: string; [k: string]: unknown }) => ({
    id: row.id,
    diagnostic_audit_id: row.diagnostic_audit_id,
    client_email: row.client_email,
    access_token: row.access_token,
    created_at: row.created_at,
    last_accessed_at: row.last_accessed_at,
    url: `${origin}/client/dashboard/${row.access_token}`,
  }))

  return NextResponse.json(list)
}
