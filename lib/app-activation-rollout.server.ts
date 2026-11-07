import 'server-only'

import { hasAppGrant, type ActivationGrant } from './app-activation'

// A rollout manifest is a reviewed registration proposal. The existing
// activation_apps table and server origin configuration remain runtime authority.
export type AppRolloutManifest = {
  appKey: string
  displayName: string
  sourceAdapterCommit: string
  exactOrigins: string[]
  consentVersion: string
  authHandoff: 'portfolio-verified-adult'
  invitationDelivery: 'unconfigured' | 'approved-server-adapter'
  activationEnabled: boolean
  billingEnabled: boolean
  accessPolicy: 'activation_only' | 'activation_and_paid'
}

export const trumpetTrainerRollout: AppRolloutManifest = {
  appKey: 'trumpet-trainer',
  displayName: 'Trumpet Trainer',
  sourceAdapterCommit: '1e3f9d23d211552af5c1f42b5cd286919ef1295a',
  exactOrigins: [],
  consentVersion: 'interest-v1',
  authHandoff: 'portfolio-verified-adult',
  invitationDelivery: 'unconfigured',
  activationEnabled: false,
  billingEnabled: false,
  accessPolicy: 'activation_only',
}

export function isExactHttpsOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password
      && !url.search && !url.hash && url.hostname.length > 0
  } catch { return false }
}

export function validateRolloutManifests(manifests: readonly AppRolloutManifest[]): Map<string, AppRolloutManifest> {
  const result = new Map<string, AppRolloutManifest>()
  const seenOrigins = new Set<string>()
  for (const manifest of manifests) {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(manifest.appKey) || result.has(manifest.appKey)) throw new Error('Invalid or duplicate app key.')
    if (!manifest.displayName.trim() || manifest.displayName.length > 120) throw new Error('Invalid app display name.')
    if (!/^[a-f0-9]{40}$/.test(manifest.sourceAdapterCommit)) throw new Error('Invalid source adapter commit.')
    if (!manifest.consentVersion || manifest.consentVersion.length > 80) throw new Error('Invalid consent version.')
    if (manifest.authHandoff !== 'portfolio-verified-adult') throw new Error('Unreviewed auth handoff.')
    if (!['unconfigured', 'approved-server-adapter'].includes(manifest.invitationDelivery)) throw new Error('Invalid delivery adapter.')
    if (!['activation_only', 'activation_and_paid'].includes(manifest.accessPolicy)) throw new Error('Invalid access policy.')
    if (!Array.isArray(manifest.exactOrigins) || manifest.exactOrigins.some(origin => !isExactHttpsOrigin(origin)) || new Set(manifest.exactOrigins).size !== manifest.exactOrigins.length) throw new Error('Invalid or duplicate exact origin.')
    if (manifest.exactOrigins.some(origin => seenOrigins.has(origin))) throw new Error('Origin belongs to another app.')
    if (manifest.activationEnabled && (!manifest.exactOrigins.length || manifest.invitationDelivery === 'unconfigured')) throw new Error('Activation requires reviewed origins and delivery.')
    if (manifest.accessPolicy === 'activation_and_paid' && !manifest.billingEnabled) throw new Error('Paid policy requires a separately enabled billing gate.')
    result.set(manifest.appKey, manifest)
    manifest.exactOrigins.forEach(origin => seenOrigins.add(origin))
  }
  return result
}

// Consuming apps supply these server-side checks. No billing provider or
// entitlement store is implemented by this kit.
export type PaidEntitlement = { appKey: string; authUserId: string; status: 'active' | 'inactive' | 'revoked'; expiresAt: string | null }
export type AppAccessAdapter = {
  readActivationGrant(appKey: string, authUserId: string): Promise<ActivationGrant | null>
  readPaidEntitlement?(appKey: string, authUserId: string): Promise<PaidEntitlement | null>
}

export function decideAppAccess(input: {
  manifest: AppRolloutManifest
  appKey: string
  authUserId: string
  grant: ActivationGrant | null
  paidEntitlement: PaidEntitlement | null
  now: Date
}): boolean {
  const { manifest, appKey, authUserId, grant, paidEntitlement, now } = input
  if (!manifest.activationEnabled || manifest.appKey !== appKey || !authUserId || !grant || !hasAppGrant(grant, appKey, authUserId, now)) return false
  if (grant.expiresAt && (!Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= now.getTime())) return false
  if (manifest.accessPolicy === 'activation_only') return true
  if (!manifest.billingEnabled || !paidEntitlement) return false
  return paidEntitlement.appKey === appKey && paidEntitlement.authUserId === authUserId
    && paidEntitlement.status === 'active'
    && (!paidEntitlement.expiresAt || (Number.isFinite(Date.parse(paidEntitlement.expiresAt)) && Date.parse(paidEntitlement.expiresAt) > now.getTime()))
}

export async function checkAppAccess(manifest: AppRolloutManifest, adapter: AppAccessAdapter, appKey: string, authUserId: string, now = new Date()): Promise<boolean> {
  if (!manifest.activationEnabled || manifest.appKey !== appKey || !authUserId) return false
  try {
    const grant = await adapter.readActivationGrant(appKey, authUserId)
    if (!grant || !hasAppGrant(grant, appKey, authUserId, now)) return false
    const paidEntitlement = manifest.accessPolicy === 'activation_and_paid'
      ? await adapter.readPaidEntitlement?.(appKey, authUserId) ?? null : null
    return decideAppAccess({ manifest, appKey, authUserId, grant, paidEntitlement, now })
  } catch { return false }
}
