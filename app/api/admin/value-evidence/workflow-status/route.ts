import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/workflow-status
 * Returns latest run per workflow (vep001, vep002) for progress display.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: vep001 } = await supabaseAdmin
    .from('value_evidence_workflow_runs')
    .select('id, workflow_id, triggered_at, completed_at, status, stages, items_inserted, error_message')
    .eq('workflow_id', 'vep001')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: vep002 } = await supabaseAdmin
    .from('value_evidence_workflow_runs')
    .select('id, workflow_id, triggered_at, completed_at, status, stages, items_inserted, error_message')
    .eq('workflow_id', 'vep002')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    vep001: vep001 || null,
    vep002: vep002 || null,
  })
}
