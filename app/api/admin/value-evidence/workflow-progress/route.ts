import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAgentEvent, recordAgentStep } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/workflow-progress
 * Called by n8n during a run to report stage progress.
 * Auth: Bearer N8N_INGEST_SECRET.
 * Body: { run_id?: string, workflow_id: 'vep001'|'vep002', stage: string, status: 'running'|'complete'|'error'|'skipped', items_count?: number }
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
    const { run_id, agent_run_id, workflow_id, stage, status: stageStatus, items_count } = body as {
      run_id?: string
      agent_run_id?: string
      workflow_id?: string
      stage?: string
      status?: string
      items_count?: number
    }

    if (!workflow_id || !stage) {
      return NextResponse.json(
        { error: 'workflow_id and stage are required' },
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

    // Find run: by run_id, or latest running run for this workflow
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

    // Get current stages and update
    const { data: current } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .select('stages, items_inserted')
      .eq('id', run.id)
      .single()

    const stages = (current?.stages as Record<string, string>) || {}
    stages[stage] = stageStatus || 'complete'

    const patch: Record<string, unknown> = {
      stages,
      updated_at: new Date().toISOString(),
    }
    if (items_count !== undefined && items_count !== null) {
      patch.items_inserted = (current?.items_inserted || 0) + items_count
    }

    const { error } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .update(patch)
      .eq('id', run.id)

    if (error) {
      console.error('workflow-progress update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (agent_run_id) {
      const normalizedStatus = stageStatus === 'error' ? 'failed' : stageStatus === 'running' ? 'running' : 'completed'
      await recordAgentStep({
        runId: agent_run_id,
        stepKey: `n8n_${wf}_${stage}`,
        name: stage,
        status: normalizedStatus,
        outputSummary: items_count != null ? `${items_count} item(s)` : stageStatus ?? 'complete',
        metadata: {
          workflow_id: wf,
          legacy_run_id: run.id,
          items_count: items_count ?? null,
          n8n_status: stageStatus ?? null,
        },
        idempotencyKey: `${agent_run_id}:${wf}:${stage}:${stageStatus ?? 'complete'}`,
      }).catch(async (agentError) => {
        console.warn('workflow-progress agent step failed:', agentError)
        await recordAgentEvent({
          runId: agent_run_id,
          eventType: 'n8n_progress',
          severity: stageStatus === 'error' ? 'error' : 'info',
          message: stage,
          metadata: {
            workflow_id: wf,
            legacy_run_id: run.id,
            items_count: items_count ?? null,
            n8n_status: stageStatus ?? null,
          },
          idempotencyKey: `${agent_run_id}:${wf}:${stage}:event:${stageStatus ?? 'complete'}`,
        }).catch(() => {})
      })
    }

    return NextResponse.json({ ok: true, run_id: run.id, agent_run_id: agent_run_id ?? null })
  } catch (err) {
    console.error('workflow-progress error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
