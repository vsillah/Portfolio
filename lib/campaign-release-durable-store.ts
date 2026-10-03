import { type CampaignTransactionStore, type ExecutionState } from './campaign-release-execution'

/** Narrow injected RPC boundary. No credentials, provider imports or production registration. */
export interface CampaignJournalRpc {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}
function decode(value: unknown): ExecutionState {
  const state = value as ExecutionState
  if (!state || state.schemaVersion !== 1 || !Number.isSafeInteger(state.version) || state.version < 0 || !state.releases || !state.attempts || !Array.isArray(state.ledger)) throw new Error('Invalid durable execution snapshot.')
  return structuredClone(state)
}
/** One global journal preserves delivery-key uniqueness across release IDs.
 * CAS commits decisions, claims, fences, receipts and reservations together.
 * Transition callbacks may be replayed ONLY following a definite CAS conflict.
 * Transport errors are uncertain: never replay a possibly committed mutation.
 * Synthetic qualification only; do not register a provider worker with this store.
 */
export class DurableCampaignExecutionStore implements CampaignTransactionStore {
  constructor(private readonly client: CampaignJournalRpc) {}
  async snapshot(): Promise<ExecutionState> {
    const { data, error } = await this.client.rpc('campaign_execution_snapshot')
    if (error) throw new Error('Execution snapshot unavailable.')
    return decode(data)
  }
  async transaction<T>(change: (state: ExecutionState) => T): Promise<T> {
    for (let retry = 0; retry < 5; retry++) {
      const state = await this.snapshot(), expectedVersion = state.version
      const result = change(state)
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('Transaction callback must be synchronous.')
      state.version = expectedVersion + 1
      const detachedResult = structuredClone(result)
      let response
      try { response = await this.client.rpc('campaign_execution_commit', { expected_version: expectedVersion, next_state: state }) }
      catch { throw new Error('Execution commit uncertain. Reload and reconcile before retrying.') }
      const { data, error } = response
      if (error) throw new Error('Execution commit uncertain. Reload and reconcile before retrying.')
      if (data === true) return detachedResult
      if (data !== false) throw new Error('Execution commit unconfirmed. Reload before retrying.')
    }
    throw new Error('Execution contention limit reached. Reload before retrying.')
  }
}
