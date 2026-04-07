import { supabaseAdmin } from '@/lib/supabase'

export type VideoGenWorkflowId = 'vgen_heygen' | 'vgen_drive'

export async function startVideoGenRun(workflowId: VideoGenWorkflowId): Promise<{ id: string } | null> {
  if (!supabaseAdmin) return null

  const summary =
    workflowId === 'vgen_heygen' ? 'HeyGen catalog' : 'Drive scripts'

  const { data, error } = await supabaseAdmin
    .from('video_generation_workflow_runs')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      stages: {},
      summary,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.warn('[video-gen-runs] insert failed:', error?.message)
    return null
  }
  return { id: data.id as string }
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

  const { error } = await supabaseAdmin
    .from('video_generation_workflow_runs')
    .update({
      status: opts.success ? 'success' : 'failed',
      completed_at: new Date().toISOString(),
      items_inserted: opts.itemsInserted ?? 0,
      error_message: opts.success ? null : (opts.errorMessage ?? 'Failed'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)

  if (error) {
    console.warn('[video-gen-runs] complete failed:', error.message)
  }
}
