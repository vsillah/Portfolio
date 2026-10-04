import { CampaignProviderCertification } from './campaign-release-provider-certification'
import { AtomicCampaignRecovery } from './campaign-release-atomic-recovery'
import { AtomicCampaignAuthority } from './campaign-release-atomic-authority'
import 'server-only'
import { CampaignDispatchFence } from './campaign-release-dispatch'
import { getCampaignRelease, assertCurrentCampaignSources } from './campaign-release-store'
import { DurableCampaignExecutionStore, type CampaignJournalRpc } from './campaign-release-durable-store'
import { hydrateApprovedCampaign } from './campaign-release-activation'

/** Deliberately unregistered. A future captain-controlled service must supply the journal RPC.
 * Browser approval PATCH stays a decision only; no service-role hydration is exposed by it. */
export function bindStoredCampaignApproval(client: CampaignJournalRpc, releaseId: string, expectedHash: string, expectedVersion: number) {
  return hydrateApprovedCampaign({ releaseId, expectedHash, expectedVersion,
    source: { read: getCampaignRelease, assertCurrentSources: assertCurrentCampaignSources },
    store: new DurableCampaignExecutionStore(client), now: () => new Date() })
}

/** Server-owned readers only; no browser payload can supply canonical authority.
 * Returns an unregistered, fail-closed intent protocol, never a provider worker. */
export function storedCampaignDispatchFence(client: CampaignJournalRpc) {
  const source = { read: getCampaignRelease, assertCurrentSources: assertCurrentCampaignSources }
  return new CampaignDispatchFence(source, new DurableCampaignExecutionStore(client), new AtomicCampaignAuthority(client, source), new CampaignProviderCertification(client))
}

/** Explicit, authenticated server-only recovery. Deliberately no HTTP/worker registration. */
export function storedCampaignAtomicRecovery(client: CampaignJournalRpc, authenticatedPortfolioActor: string) {
  return new AtomicCampaignRecovery(client, authenticatedPortfolioActor)
}

/** Fresh exact-scope certification inspection; never a provider activation factory. */
export function storedCampaignProviderCertification(client: CampaignJournalRpc) {
  return new CampaignProviderCertification(client)
}
