import type { TestStatus } from './types'

/** Fields needed to derive whether a finished run is truly “all green”. */
export type TestRunOutcomeInput = {
  status: TestStatus
  clients_spawned: number
  clients_completed: number
  clients_failed: number
}

/**
 * Run status shown in admin should mean “all spawned clients succeeded,” not merely “orchestrator stopped.”
 * Reconciles stored `status` with client counters (including legacy rows where they diverged).
 */
export function effectiveTestRunStatus(run: TestRunOutcomeInput): TestStatus {
  const { status, clients_spawned, clients_completed, clients_failed } = run
  if (status === 'pending' || status === 'running') return status
  if (status === 'cancelled') return 'cancelled'

  if (clients_spawned > 0) {
    const allSucceeded =
      clients_failed === 0 && clients_completed === clients_spawned
    return allSucceeded ? 'completed' : 'failed'
  }

  return status === 'failed' ? 'failed' : 'completed'
}
