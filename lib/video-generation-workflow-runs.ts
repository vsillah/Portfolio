import { supabaseAdmin } from '@/lib/supabase'
import {
  attachAgentArtifact,
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

export type VideoGenWorkflowId = 'vgen_heygen' | 'vgen_drive'

function getWorkflowSummary(workflowId: VideoGenWorkflowId) {
  return workflowId === 'vgen_heygen' ? 'HeyGen catalog' : 'Drive scripts'
}

export async function startVideoGenRun(workflowId: VideoGenWorkflowId): Promise<{ id: string; agentRunId: string | null } | null> {
  if (!supabaseAdmin) return null

  const summary = getWorkflowSummary(workflowId)
  let agentRunId: string | null = null

  try {
    const agentRun = await startAgentRun({
      agentKey: 'content-repurposing',
      runtime: 'manual',
      kind: 'video_generation_workflow_sync',
      title: `${summary} sync`,
      status: 'running',
      subject: {
        type: 'video_generation_workflow',
        id: workflowId,
        label: summary,
      },
      triggerSource: `admin_video_generation_${workflowId}`,
      staleAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      currentStep: 'Sync started',
      metadata: {
        workflow_id: workflowId,
        legacy_table: 'video_generation_workflow_runs',
        execution_mode: 'admin_triggered_sync',
      },
    })
    agentRunId = agentRun.id
  } catch (error) {
    console.warn('[video-gen-runs] agent run start failed:', error)
  }

  const { data, error } = await supabaseAdmin
    .from('video_generation_workflow_runs')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      stages: {},
      summary,
      agent_run_id: agentRunId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.warn('[video-gen-runs] insert failed:', error?.message)
    if (agentRunId) {
      await markAgentRunFailed(agentRunId, error?.message ?? 'Failed to create video generation workflow run', {
        workflow_id: workflowId,
      }).catch(() => {})
    }
    return null
  }
  return { id: data.id as string, agentRunId }
}

export async function completeVideoGenRun(
  runId: string,
  opts: {
    success: boolean
    itemsInserted?: number
    errorMessage?: string | null
  },
): Promise<void> {
  if (!supabaseAdmin) return

  const { data, error } = await supabaseAdmin
    .from('video_generation_workflow_runs')
    .update({
      status: opts.success ? 'success' : 'failed',
      completed_at: new Date().toISOString(),
      items_inserted: opts.itemsInserted ?? 0,
      error_message: opts.success ? null : (opts.errorMessage ?? 'Failed'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select('id, workflow_id, agent_run_id, summary')
    .maybeSingle()

  if (error) {
    console.warn('[video-gen-runs] complete failed:', error.message)
    return
  }

  const row = data as {
    id: string
    workflow_id: VideoGenWorkflowId
    agent_run_id: string | null
    summary: string | null
  } | null

  if (!row?.agent_run_id) return

  try {
    const summary = row.summary ?? getWorkflowSummary(row.workflow_id)
    await recordAgentStep({
      runId: row.agent_run_id,
      stepKey: 'video_generation_sync_complete',
      name: opts.success ? 'Video generation sync completed' : 'Video generation sync failed',
      status: opts.success ? 'completed' : 'failed',
      outputSummary: opts.errorMessage ?? `${opts.itemsInserted ?? 0} item(s) synced`,
      metadata: {
        workflow_id: row.workflow_id,
        legacy_run_id: row.id,
        items_inserted: opts.itemsInserted ?? 0,
      },
      idempotencyKey: `${row.agent_run_id}:complete:${row.id}`,
    })

    if (opts.success) {
      await attachAgentArtifact({
        runId: row.agent_run_id,
        artifactType: 'video_generation_workflow_run',
        title: `${summary} sync result`,
        refType: 'video_generation_workflow_run',
        refId: row.id,
        metadata: {
          workflow_id: row.workflow_id,
          items_inserted: opts.itemsInserted ?? 0,
        },
        idempotencyKey: `${row.agent_run_id}:artifact:${row.id}`,
      })

      await endAgentRun({
        runId: row.agent_run_id,
        status: 'completed',
        currentStep: `${summary} sync complete`,
        outcome: {
          workflow_id: row.workflow_id,
          legacy_run_id: row.id,
          items_inserted: opts.itemsInserted ?? 0,
        },
      })
    } else {
      await markAgentRunFailed(row.agent_run_id, opts.errorMessage ?? 'Video generation sync failed', {
        workflow_id: row.workflow_id,
        legacy_run_id: row.id,
        items_inserted: opts.itemsInserted ?? 0,
      })
    }
  } catch (agentError) {
    console.warn('[video-gen-runs] agent run complete failed:', agentError)
  }
}
