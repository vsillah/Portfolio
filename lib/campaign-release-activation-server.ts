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
  return new CampaignDispatchFence({ read: getCampaignRelease, assertCurrentSources: assertCurrentCampaignSources }, new DurableCampaignExecutionStore(client))
}
