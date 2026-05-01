import { supabaseAdmin } from '@/lib/supabase'
import type { AgentRunStatus } from '@/lib/agent-run'

export const DEFAULT_AGENT_RUN_STALE_AFTER_MS = 30 * 60 * 1000

export type StaleAgentRunCandidate = {
  id: string
  runtime: string
  kind: string
  status: AgentRunStatus
  started_at: string
  stale_after: string | null
  current_step: string | null
}

export type StaleSweepResult = {
  checked: number
  marked: number
  runIds: string[]
}

export function isAgentRunStale(
  run: Pick<StaleAgentRunCandidate, 'status' | 'started_at' | 'stale_after'>,
  now = new Date(),
  defaultStaleAfterMs = DEFAULT_AGENT_RUN_STALE_AFTER_MS,
) {
  if (run.status !== 'queued' && run.status !== 'running') return false

  const nowMs = now.getTime()
  if (run.stale_after && nowMs > new Date(run.stale_after).getTime()) return true

  return nowMs - new Date(run.started_at).getTime() > defaultStaleAfterMs
}

function db() {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  return supabaseAdmin
}

export async function sweepStaleAgentRuns(now = new Date()): Promise<StaleSweepResult> {
  const { data, error } = await db()
    .from('agent_runs')
    .select('id, runtime, kind, status, started_at, stale_after, current_step')
    .in('status', ['queued', 'running'])
    .order('started_at', { ascending: true })
    .limit(250)

  if (error) {
    throw new Error(`Failed to read active agent runs: ${error.message}`)
  }

  const candidates = (data || []) as StaleAgentRunCandidate[]
  const staleRuns = candidates.filter((run) => isAgentRunStale(run, now))
  const completedAt = now.toISOString()

  for (const run of staleRuns) {
    const outcome = {
      stale_sweep: true,
      previous_status: run.status,
      previous_step: run.current_step,
      stale_after: run.stale_after,
    }

    const { error: updateError } = await db()
      .from('agent_runs')
      .update({
        status: 'stale',
        completed_at: completedAt,
        current_step: 'stale',
        error_message: 'Marked stale by agent run sweep',
        outcome,
        updated_at: completedAt,
      })
      .eq('id', run.id)
      .in('status', ['queued', 'running'])

    if (updateError) {
      throw new Error(`Failed to mark agent run stale: ${updateError.message}`)
    }

    await db()
      .from('agent_run_events')
      .insert({
        run_id: run.id,
        event_type: 'run_marked_stale',
        severity: 'warning',
        message: 'Marked stale by agent run sweep',
        metadata: outcome,
        occurred_at: completedAt,
        idempotency_key: `${run.id}:stale:${completedAt}`,
      })
  }

  return {
    checked: candidates.length,
    marked: staleRuns.length,
    runIds: staleRuns.map((run) => run.id),
  }
}
