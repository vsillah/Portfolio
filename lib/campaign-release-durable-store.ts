import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyExecutionState, type CampaignTransactionStore, type ExecutionState } from './campaign-release-execution'

export interface CampaignCompareAndSwap {
  read(): Promise<ExecutionState | null>
  /** false means a definite version conflict; throws mean an uncertain commit. */
  commit(expectedVersion: number | null, next: ExecutionState): Promise<boolean>
}
/** One shared row is intentional: delivery keys and release budgets share one atomic boundary.
 * Callbacks are synchronous, pure and replayable. Never perform IO inside them.
 * A lost commit response is NOT retried: reload/reconcile before further execution. */
export class DurableCampaignExecutionStore implements CampaignTransactionStore {
  constructor(private readonly backend: CampaignCompareAndSwap) {}
  async snapshot(): Promise<ExecutionState> {
    const state = await this.backend.read()
    if (!state) return emptyExecutionState()
    if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.version) || state.version < 1 || !state.releases || !state.attempts || !Array.isArray(state.ledger)) throw new Error('Durable journal format invalid.')
    return structuredClone(state)
  }
  async transaction<T>(change: (state: ExecutionState) => T): Promise<T> {
    for (let retry = 0; retry < 8; retry++) {
      const state = await this.snapshot(), version = state.version
      const result = change(state)
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('Transaction callback must be synchronous.')
      if (!Number.isSafeInteger(version + 1)) throw new Error('Journal version exhausted; operator recovery required.')
      state.version = version + 1
      const detached = structuredClone(result)
      if (await this.backend.commit(version || null, state)) return detached
    }
    throw new Error('Journal contention; reload before retrying.')
  }
}

export const CAMPAIGN_EXECUTION_JOURNAL_ID = 'caca0003-0000-4000-8000-000000000001'
const kind = 'campaign_execution_journal'
/** Dormant adapter. No default client, environment import, route, worker or activation flag.
 * Existing agent_runs admin-only access must be qualified before registering this adapter.
 * Never delete/reset this row: doing so loses the global duplicate-delivery barrier. */
export function campaignDatabaseBackend(client: SupabaseClient): CampaignCompareAndSwap {
  const table = () => client.from('agent_runs')
  return {
    async read() {
      const { data, error } = await table().select('kind,metadata').eq('id', CAMPAIGN_EXECUTION_JOURNAL_ID).maybeSingle()
      if (error) throw new Error('Journal read unconfirmed.')
      if (data && data.kind !== kind) throw new Error('Journal identity conflict.')
      return data?.metadata ?? null
    },
    async commit(expectedVersion, next) {
      if (expectedVersion === null) {
        const { error } = await table().insert({ id: CAMPAIGN_EXECUTION_JOURNAL_ID, kind, runtime: 'manual', title: 'Synthetic campaign execution journal', status: 'waiting_for_approval', trigger_source: 'portfolio', idempotency_key: kind, metadata: next, outcome: { providerExecutionEnabled: false } })
        if (error?.code === '23505') return false
        if (error) throw new Error('Journal commit uncertain; reload and reconcile.')
        return true
      }
      const { data, error } = await table().update({ metadata: next }).eq('id', CAMPAIGN_EXECUTION_JOURNAL_ID).eq('kind', kind).eq('metadata->>version', String(expectedVersion)).select('id').maybeSingle()
      if (error) throw new Error('Journal commit uncertain; reload and reconcile.')
      return Boolean(data)
    },
  }
}
