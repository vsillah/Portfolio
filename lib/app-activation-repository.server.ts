import 'server-only'

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { hashInvitationToken } from './app-activation'
import { isExactHttpsOrigin } from './app-activation-rollout.server'
import { getAuthUserPrimaryEmail } from './auth-user-email'
import type { OperatorAction, OperatorRecord, OperatorSnapshot } from './app-activation-operator'

export class ActivationError extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

export type IntakeInput = { appKey: string; adultEmail: string; consentVersion: string; consentGranted: true; idempotencyKey: string; sourceType: string; sourceReceipt: string }
export type RedeemInput = { appKey: string; token: string; authUserId: string; adultEmail: string }
export type OperatorInput = { appKey: string; recordId: string; action: OperatorAction; actor: string; reason: string; confirmation?: string }
export type AbuseKind = 'interest' | 'redeem' | 'handoff_issue' | 'handoff_exchange' | 'grant'

export interface ActivationRepository {
  intake(input: IntakeInput): Promise<void>
  redeem(input: RedeemInput): Promise<boolean>
  hasGrant(appKey: string, authUserId: string): Promise<boolean>
  hasGrantForHandle(appKey: string, handle: string): Promise<boolean>
  consumeAbuseBudget(kind: AbuseKind, clientIp: string): Promise<boolean>
  issueHandoff(appKey: string, authUserId: string): Promise<string | null>
  exchangeHandoff(appKey: string, code: string): Promise<string | null>
  revokeUndeliveredInvitation(appKey: string, interestId: string, invitationId: string, actor: string): Promise<void>
  snapshot(): Promise<OperatorSnapshot>
  operator(input: OperatorInput): Promise<{ record: OperatorRecord; deliveryToken?: string }>
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const keyPattern = /^[a-z0-9][a-z0-9-]{1,62}$/

export function activationProviderConfigured(env: Record<string, string | undefined> = process.env): boolean {
  let site: URL
  try { site = new URL(env.APP_ACTIVATION_CONVEX_SITE_URL || '') } catch { return false }
  return env.APP_ACTIVATION_PROVIDER === 'convex' && env.APP_ACTIVATION_ENABLE_WRITES === 'true'
    && site.protocol === 'https:' && /^[-a-z0-9]+\.convex\.site$/.test(site.hostname) && site.pathname === '/' && !site.search && !site.hash
    && typeof env.APP_ACTIVATION_CONVEX_BRIDGE_SECRET === 'string' && env.APP_ACTIVATION_CONVEX_BRIDGE_SECRET.length >= 32
    && !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !!env.SUPABASE_SERVICE_ROLE_KEY
    && !!env.APP_ACTIVATION_APP_ORIGINS && !!env.APP_ACTIVATION_CONSENT_VERSION
}

export function activationRuntimeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return activationProviderConfigured(env) && Object.keys(configuredAppOrigins(env)).length > 0
    && env.APP_ACTIVATION_DISTRIBUTED_ABUSE_ENABLED === 'true'
    && typeof env.APP_ACTIVATION_ABUSE_SECRET === 'string' && env.APP_ACTIVATION_ABUSE_SECRET.length >= 32
}

export function appServerSecretValid(appKey: string, supplied: string, env: Record<string, string | undefined> = process.env): boolean {
  if (env.APP_ACTIVATION_HANDOFF_ENABLED !== 'true' || !keyPattern.test(appKey) || supplied.length < 32) return false
  try {
    const secrets: unknown = JSON.parse(env.APP_ACTIVATION_APP_SECRETS || '{}')
    if (!secrets || typeof secrets !== 'object' || Array.isArray(secrets)) return false
    const expected = (secrets as Record<string, unknown>)[appKey]
    if (typeof expected !== 'string' || expected.length < 32) return false
    return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest())
  } catch { return false }
}

export function configuredAppOrigins(env: Record<string, string | undefined> = process.env): Record<string, string[]> {
  if (!activationProviderConfigured(env)) return {}
  try {
    const value: unknown = JSON.parse(env.APP_ACTIVATION_APP_ORIGINS!)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const entries = Object.entries(value)
    if (!entries.length || entries.some(([key, origins]) => !keyPattern.test(key) || !Array.isArray(origins)
      || origins.length === 0 || origins.some(origin => !isExactHttpsOrigin(origin)) || new Set(origins).size !== origins.length)) return {}
    const allOrigins = entries.flatMap(([, origins]) => origins as string[])
    if (new Set(allOrigins).size !== allOrigins.length) return {}
    return Object.fromEntries(entries) as Record<string, string[]>
  } catch { return {} }
}

export function getActivationRepository(): ActivationRepository | null {
  return activationRuntimeConfigured() ? new ConvexActivationRepository() : null
}

async function call<T>(operation: string, args: Record<string, unknown>): Promise<T> {
  if (!activationRuntimeConfigured()) throw new ActivationError('Activation provider unavailable.', 503)
  const response = await fetch(`${process.env.APP_ACTIVATION_CONVEX_SITE_URL!.replace(/\/$/, '')}/activation`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${process.env.APP_ACTIVATION_CONVEX_BRIDGE_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, args }), cache: 'no-store', signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new ActivationError('Activation provider unavailable.', 503)
  const body = await response.json() as { result: T }
  return body.result
}

class ConvexActivationRepository implements ActivationRepository {
  async consumeAbuseBudget(kind: AbuseKind, clientIp: string): Promise<boolean> {
    const keyHash = createHmac('sha256', process.env.APP_ACTIVATION_ABUSE_SECRET!).update(`${kind}\0${clientIp}`).digest('hex')
    return call<boolean>('budget', { kind, keyHash })
  }
  async intake(input: IntakeInput): Promise<void> {
    await call('intake', { appKey: input.appKey, adultEmail: input.adultEmail, consentVersion: input.consentVersion, sourceType: input.sourceType, sourceReceipt: input.sourceReceipt, intakeHash: hash(`${input.appKey}\0${input.idempotencyKey}`) })
  }
  async redeem(input: RedeemInput): Promise<boolean> {
    // Supabase Auth is canonical. A stale or forged email never reaches the Convex claim.
    const currentEmail = await getAuthUserPrimaryEmail(input.authUserId)
    if (!currentEmail || currentEmail !== input.adultEmail.trim().toLowerCase()) return false
    return call<boolean>('redeem', { appKey: input.appKey, tokenHash: hashInvitationToken(input.token), externalSubject: input.authUserId, verifiedEmail: currentEmail })
  }
  async hasGrant(appKey: string, authUserId: string): Promise<boolean> {
    const email = await getAuthUserPrimaryEmail(authUserId)
    if (!email) return false
    return await call<string | null>('hasGrant', { appKey, externalSubject: authUserId }) === email
  }
  async issueHandoff(appKey: string, authUserId: string): Promise<string | null> {
    if (process.env.APP_ACTIVATION_HANDOFF_ENABLED !== 'true') return null
    const verifiedEmail = await getAuthUserPrimaryEmail(authUserId)
    if (!verifiedEmail) return null
    const code = randomBytes(32).toString('base64url')
    return await call<boolean>('issueHandoff', { appKey, externalSubject: authUserId, verifiedEmail, codeHash: hash(code) }) ? code : null
  }
  async exchangeHandoff(appKey: string, code: string): Promise<string | null> {
    if (process.env.APP_ACTIVATION_HANDOFF_ENABLED !== 'true') return null
    const codeHash = hash(code)
    const binding = await call<{ externalSubject: string; emailAtRedemption: string } | null>('resolveCode', { appKey, codeHash })
    if (!binding) return null
    const verifiedEmail = await getAuthUserPrimaryEmail(binding.externalSubject)
    if (!verifiedEmail || verifiedEmail !== binding.emailAtRedemption) return null
    const handle = randomBytes(32).toString('base64url')
    return await call<boolean>('exchangeHandoff', { appKey, codeHash, handleHash: hash(handle), externalSubject: binding.externalSubject, verifiedEmail }) ? handle : null
  }
  async hasGrantForHandle(appKey: string, handle: string): Promise<boolean> {
    const binding = await call<{ externalSubject: string; emailAtRedemption: string } | null>('resolveHandle', { appKey, handleHash: hash(handle) })
    if (!binding) return false
    // Deleted users and changed email fail closed. No profile or child identity is copied.
    return await getAuthUserPrimaryEmail(binding.externalSubject) === binding.emailAtRedemption
  }
  async revokeUndeliveredInvitation(appKey: string, interestId: string, invitationId: string, actor: string): Promise<void> {
    if (!await call<boolean>('revokeUndelivered', { appKey, interestId, invitationId, actor })) throw new ActivationError('Undelivered invitation requires operator review.', 503)
  }
  async snapshot(): Promise<OperatorSnapshot> { return call<OperatorSnapshot>('snapshot', {}) }
  async operator(input: OperatorInput): Promise<{ record: OperatorRecord; deliveryToken?: string }> {
    const raw = input.action === 'prepare_invitation' ? randomBytes(32).toString('base64url') : undefined
    const created = await call<{ invitationId: string } | null>('operator', { ...input, tokenHash: raw ? hashInvitationToken(raw) : undefined, issuanceEnabled: process.env.APP_ACTIVATION_ISSUANCE_ENABLED === 'true' })
    let record: OperatorRecord | undefined
    try { record = (await this.snapshot()).records.find(row => row.id === input.recordId && row.appKey === input.appKey) }
    catch {
      if (created?.invitationId) await this.revokeUndeliveredInvitation(input.appKey, input.recordId, created.invitationId, input.actor)
      throw new ActivationError('Operator readback failed; invitation delivery was stopped.', 503)
    }
    if (!record) {
      if (created?.invitationId) await this.revokeUndeliveredInvitation(input.appKey, input.recordId, created.invitationId, input.actor)
      throw new ActivationError('Updated record could not be read.', 503)
    }
    return { record, deliveryToken: raw }
  }
}
