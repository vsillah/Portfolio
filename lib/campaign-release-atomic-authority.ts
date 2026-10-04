import { approvalIdentity, type CampaignApprovalSource } from './campaign-release-activation'
import type { CampaignJournalRpc } from './campaign-release-durable-store'
import { campaignActionKeys, releaseHash } from './campaign-release-manifest'
import type { ExecutionAttempt } from './campaign-release-execution'

export type AtomicCampaignRequest = {
  releaseId: string; hash: string; approvalVersion: number; actionId: string
  owner: string; journalVersion: number; requestId: string; dependencyDigest: string
}
/** Only the server factory supplies this adapter. The RPC owns time, locks, keys,
 * reservation and intent creation. Its receipt is sandbox history, never a live permit. */
export class AtomicCampaignAuthority {
  constructor(private readonly client: CampaignJournalRpc, private readonly source: CampaignApprovalSource) {}
  async authorize(input: AtomicCampaignRequest): Promise<ExecutionAttempt> {
    const record = await this.source.read(input.releaseId)
    const identity = approvalIdentity(record, new Date())
    if (identity.releaseId !== input.releaseId || identity.manifestHash !== input.hash || identity.approvalVersion !== input.approvalVersion) throw new Error('Stale atomic authority request.')
    const keys = campaignActionKeys(record.manifest, input.actionId)
    const action = record.manifest.actions.find(candidate => candidate.id === input.actionId)!
    const sourceDigest = releaseHash([...record.manifest.actions.map(candidate => candidate.source), ...(record.manifest.planningSources ?? [])])
    // No retry on transport failure: the transaction may have committed. Exact requestId
    // replay is explicitly requested by the caller after inspecting persisted state.
    let response
    try {
      response = await this.client.rpc('campaign_authorize_sandbox_intent', { request: {
        ...input, record, auditHash: identity.auditHash, ...keys,
      } })
    } catch { throw new Error('Atomic authority unconfirmed. Inspect journal before exact-request replay.') }
    if (response.error) throw new Error('Atomic authority refused or unavailable. Inspect journal; providers remain disabled.')
    const result = response.data as { protocol?: string; providerEnabled?: boolean; attempt?: ExecutionAttempt } | null
    const attempt = result?.attempt, intent = attempt?.dispatchIntent
    if (result?.protocol !== 'campaign-atomic-sandbox/v1' || result.providerEnabled !== false ||
      !attempt || !intent || intent.status !== 'prepared' || intent.mode !== 'disabled' ||
      attempt.owner !== input.owner || attempt.releaseId !== input.releaseId || attempt.actionId !== input.actionId ||
      attempt.manifestHash !== input.hash || attempt.deliveryKey !== keys.deliveryKey || attempt.authorizationKey !== keys.authorizationKey || attempt.contentHash !== keys.contentHash ||
      intent.atomicRequest?.requestId !== input.requestId || releaseHash(intent.atomicRequest) !== releaseHash(input) ||
      releaseHash(intent.approval) !== releaseHash(identity) || intent.dependencyDigest !== input.dependencyDigest ||
      intent.sourceDigest !== sourceDigest || intent.reservedCents !== action.maxSpendCents || attempt.reservedCents !== action.maxSpendCents || attempt.spentCents !== 0 ||
      intent.journalVersion !== input.journalVersion + 1 || attempt.state !== 'claimed' || attempt.version !== 1 ||
      !Number.isFinite(Date.parse(attempt.leaseUntil)) || Date.parse(attempt.leaseUntil) <= Date.now()) {
      throw new Error('Atomic authority response ambiguous. Providers remain disabled.')
    }
    return structuredClone(attempt)
  }
}
