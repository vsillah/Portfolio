import 'server-only'
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
