import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/workflow-complete
 * Called by n8n at the end of a run.
 * Auth: Bearer N8N_INGEST_SECRET.
 * Body: { run_id?: string, workflow_id: 'vep001'|'vep002', status: 'success'|'failed', items_inserted?: number, error_message?: string }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { run_id, workflow_id, status: completionStatus, items_inserted, error_message } = body as {
      run_id?: string
      workflow_id?: string
      status?: string
      items_inserted?: number
      error_message?: string
    }

    if (!workflow_id) {
      return NextResponse.json(
        { error: 'workflow_id is required' },
        { status: 400 }
      )
    }

    const wf = workflow_id === 'WF-VEP-001' ? 'vep001' : workflow_id === 'WF-VEP-002' ? 'vep002' : workflow_id
    if (wf !== 'vep001' && wf !== 'vep002') {
      return NextResponse.json(
        { error: 'workflow_id must be vep001, vep002, WF-VEP-001, or WF-VEP-002' },
        { status: 400 }
      )
    }

    const status = completionStatus === 'failed' ? 'failed' : 'success'

    // Find run
    let run: { id: string } | null = null
    if (run_id) {
      const { data } = await supabaseAdmin
        .from('value_evidence_workflow_runs')
        .select('id')
        .eq('id', run_id)
        .single()
      run = data
    }
    if (!run) {
      const { data } = await supabaseAdmin
        .from('value_evidence_workflow_runs')
        .select('id')
        .eq('workflow_id', wf)
        .eq('status', 'running')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      run = data
    }

    if (!run) {
      return NextResponse.json(
        { error: 'No matching run found', ok: false },
        { status: 404 }
      )
    }

    const completedAt = new Date().toISOString()
    const update: Record<string, unknown> = {
      status,
      completed_at: completedAt,
      updated_at: completedAt,
    }
    if (items_inserted !== undefined && items_inserted !== null) {
      update.items_inserted = items_inserted
    }
    if (error_message !== undefined && error_message !== null) {
      update.error_message = error_message
    }

    const { error } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .update(update)
      .eq('id', run.id)

    if (error) {
      console.error('workflow-complete update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, run_id: run.id })
  } catch (err) {
    console.error('workflow-complete error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
