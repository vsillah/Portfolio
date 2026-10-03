import type { ReleaseRecord } from './campaign-release-manifest'
import type { SimulationState } from './campaign-release-simulation'
export type CampaignReleaseProgress = {
  mode: 'synthetic'; reservedCents: number; spentCents: number;
  actions: Array<{ actionId: string; state: 'claimed' | 'confirmed' | 'uncertain' | 'not_dispatched'; attempts: number; receiptId?: string }>
}
/** Only bounded receipt summaries cross into the client; owner tokens and event payloads stay private. */
export function campaignReleaseProgress(state: SimulationState, record: ReleaseRecord): CampaignReleaseProgress {
  const attempts = Object.values(state.attempts).flat().filter(attempt => attempt.releaseId === record.manifest.releaseId)
  return { mode: 'synthetic', reservedCents: attempts.reduce((sum, a) => sum + a.reservedCents, 0), spentCents: attempts.reduce((sum, a) => sum + a.spentCents, 0),
    actions: record.manifest.actions.flatMap(action => {
      const matching = attempts.filter(a => a.actionId === action.id), last = matching.at(-1)
      return last ? [{ actionId: action.id, state: last.state, attempts: matching.length, receiptId: last.receipt?.providerId }] : []
    }) }
}
