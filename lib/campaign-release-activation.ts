import { decideCampaignRelease, parseCampaignManifest, releaseHash, type CampaignReleaseManifest, type ReleaseRecord } from './campaign-release-manifest'
import type { CampaignTransactionStore } from './campaign-release-execution'

export type ApprovalBinding = {
  releaseId: string; manifestHash: string; approvalVersion: number; auditHash: string
  checkedAt: string; status: 'checking' | 'bound' | 'invalidated'; executionEnabled: false
}
/** Implemented only by a server-owned canonical repository, never by a request payload. */
export interface CampaignApprovalSource {
  read(releaseId: string): Promise<ReleaseRecord>
  assertCurrentSources(manifest: CampaignReleaseManifest): Promise<void>
}
export function approvalIdentity(record: ReleaseRecord, now: Date) {
  const manifest = parseCampaignManifest(record.manifest)
  if (!Number.isFinite(+now) || record.hash !== releaseHash(manifest) || record.state !== 'approved' || record.version !== record.audit.length + 1) throw new Error('Exact approved authority required.')
  let replay: ReleaseRecord = { manifest, hash: record.hash, state: 'pending', version: 1, audit: [] }
  let previous = Date.parse(manifest.createdAt)
  for (const event of record.audit) {
    const at = Date.parse(event.at)
    if (!Number.isFinite(at) || at < previous || at > +now || !/^(portfolio|slack):[^\s]+$/.test(event.actor)) throw new Error('Untrusted approval audit.')
    replay = decideCampaignRelease(replay, event.hash, event.decision, event.actor, new Date(at))
    previous = at
  }
  if (releaseHash(replay) !== releaseHash(record) || replay.state !== 'approved') throw new Error('Approval audit mismatch.')
  // Reuses the same approval window/evidence checks as the canonical decision API.
  decideCampaignRelease(record, record.hash, 'approve', record.audit.at(-1)!.actor, now)
  return { releaseId: manifest.releaseId, manifestHash: record.hash, approvalVersion: record.version, auditHash: releaseHash(record.audit) }
}
/** Internal activation boundary. No route, default DB client, worker or flag invokes it.
 * Binding records evidence, never dispatch authority. Two reads detect intervening decisions;
 * a checking/invalidated binding and ALL bound releases remain execution-disabled.
 * Live dispatch requires a future atomic canonical-authority fence, not these two reads. */
export async function hydrateApprovedCampaign(input: {
  releaseId: string; expectedHash: string; expectedVersion: number
  source: CampaignApprovalSource; store: CampaignTransactionStore; now: () => Date
}): Promise<ApprovalBinding> {
  if (typeof window !== 'undefined') throw new Error('Server-only activation boundary.')
  const record = structuredClone(await input.source.read(input.releaseId))
  const identity = approvalIdentity(record, input.now())
  if (identity.releaseId !== input.releaseId || identity.manifestHash !== input.expectedHash || identity.approvalVersion !== input.expectedVersion) throw new Error('Stale activation request.')
  await input.source.assertCurrentSources(record.manifest)
  await input.store.transaction(state => {
    const prior = state.approvalBindings?.[input.releaseId]
    const existing = state.releases[input.releaseId]
    if ((prior && releaseHash({ ...prior, checkedAt: '', status: 'checking' }) !== releaseHash({ ...identity, checkedAt: '', status: 'checking', executionEnabled: false })) || (existing && releaseHash(existing) !== releaseHash(record))) throw new Error('Journal authority conflict.')
    state.approvalBindings ??= {}
    state.releases[input.releaseId] = record
    state.approvalBindings[input.releaseId] = { ...identity, checkedAt: input.now().toISOString(), status: 'checking', executionEnabled: false }
  })
  try {
    const fresh = await input.source.read(input.releaseId)
    if (releaseHash(approvalIdentity(fresh, input.now())) !== releaseHash(identity)) throw new Error('Canonical approval changed.')
    await input.source.assertCurrentSources(fresh.manifest)
    return await input.store.transaction(state => {
      const binding = state.approvalBindings?.[input.releaseId]
      if (!binding || binding.status === 'invalidated' || releaseHash(state.releases[input.releaseId]) !== releaseHash(record)) throw new Error('Binding changed during activation.')
      binding.status = 'bound'
      return binding
    })
  } catch (error) {
    await input.store.transaction(state => {
      const binding = state.approvalBindings?.[input.releaseId]
      if (binding) binding.status = 'invalidated'
    })
    throw error
  }
}
