import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { checkAppAccess, decideAppAccess, trumpetTrainerRollout, validateRolloutManifests, type AppRolloutManifest, type PaidEntitlement } from './app-activation-rollout.server'
import type { ActivationGrant } from './app-activation'

const now = new Date('2026-11-07T12:00:00.000Z')
const enabled: AppRolloutManifest = { ...trumpetTrainerRollout, exactOrigins: ['https://app.example.test'], invitationDelivery: 'approved-server-adapter', abuseControl: 'postgres-distributed', identityExchange: 'single-use-code', appSessionBinding: 'verified-adult-server-session', activationEnabled: true }
const grant: ActivationGrant = { id: 'grant-1', appKey: enabled.appKey, interestId: 'interest-1', invitationId: 'inv-1', authUserId: 'adult-1', expiresAt: '2026-12-01T00:00:00.000Z', revokedAt: null }
const paid: PaidEntitlement = { appKey: enabled.appKey, authUserId: 'adult-1', status: 'active', expiresAt: '2026-12-01T00:00:00.000Z' }
const access = (manifest: AppRolloutManifest, activeGrant: ActivationGrant | null = grant, entitlement: PaidEntitlement | null = null, appKey = enabled.appKey, authUserId = 'adult-1') =>
  decideAppAccess({ manifest, appKey, authUserId, grant: activeGrant, paidEntitlement: entitlement, now })

describe('source-only app rollout registration', () => {
  it('keeps the Trumpet Trainer reference off and bound to its adapter source', () => {
    expect(trumpetTrainerRollout.sourceAdapterCommit).toBe('1e3f9d23d211552af5c1f42b5cd286919ef1295a')
    expect(trumpetTrainerRollout.activationEnabled).toBe(false)
    expect(trumpetTrainerRollout.billingEnabled).toBe(false)
    expect(trumpetTrainerRollout.exactOrigins).toEqual([])
    expect(validateRolloutManifests([trumpetTrainerRollout]).size).toBe(1)
    expect(access(trumpetTrainerRollout)).toBe(false)
  })
  it('rejects duplicate keys and invalid, duplicate, or missing enabled origins', () => {
    expect(() => validateRolloutManifests([enabled, enabled])).toThrow(/duplicate app key/)
    for (const origin of ['http://app.example.test', 'https://app.example.test/path', 'https://app.example.test/', 'https://user@app.example.test', 'https://app.example.test?x=1'])
      expect(() => validateRolloutManifests([{ ...enabled, exactOrigins: [origin] }])).toThrow(/origin/)
    expect(() => validateRolloutManifests([{ ...enabled, exactOrigins: [] }])).toThrow(/requires reviewed origins/)
    expect(() => validateRolloutManifests([{ ...enabled, exactOrigins: ['https://app.example.test', 'https://app.example.test'] }])).toThrow(/duplicate exact origin/)
    expect(() => validateRolloutManifests([enabled, { ...enabled, appKey: 'other-app' }])).toThrow(/Origin belongs to another app/)
  })
  it('requires a reviewed delivery adapter before activation', () => {
    expect(() => validateRolloutManifests([{ ...enabled, invitationDelivery: 'unconfigured' }])).toThrow(/delivery/)
    expect(() => validateRolloutManifests([{ ...enabled, abuseControl: 'unconfigured' }])).toThrow(/abuse control/)
    expect(() => validateRolloutManifests([{ ...enabled, identityExchange: 'unconfigured' }])).toThrow(/identity exchange/)
    expect(() => validateRolloutManifests([{ ...enabled, appSessionBinding: 'unconfigured' }])).toThrow(/app session binding/)
  })
})

describe('app and account scoped access decision', () => {
  it('rejects cross-app and cross-user grants', () => {
    expect(access(enabled, grant, null, 'another-app')).toBe(false)
    expect(access(enabled, { ...grant, appKey: 'another-app' })).toBe(false)
    expect(access(enabled, grant, null, enabled.appKey, 'other-adult')).toBe(false)
  })
  it('rejects missing, revoked, expired, and malformed grants', () => {
    expect(access(enabled, null)).toBe(false)
    expect(access(enabled, { ...grant, revokedAt: now.toISOString() })).toBe(false)
    expect(access(enabled, { ...grant, expiresAt: now.toISOString() })).toBe(false)
    expect(access(enabled, { ...grant, expiresAt: 'invalid' })).toBe(false)
  })
  it('keeps activation and paid entitlement as separate, fail-closed decisions', () => {
    const both: AppRolloutManifest = { ...enabled, billingEnabled: true, accessPolicy: 'activation_and_paid' }
    expect(access(both, grant, null)).toBe(false)
    expect(access(both, null, paid)).toBe(false)
    expect(access(both, grant, { ...paid, appKey: 'another-app' })).toBe(false)
    expect(access(both, grant, { ...paid, authUserId: 'another-adult' })).toBe(false)
    expect(access(both, grant, { ...paid, status: 'revoked' })).toBe(false)
    expect(access(both, grant, { ...paid, status: 'inactive' })).toBe(false)
    expect(access(both, grant, { ...paid, expiresAt: now.toISOString() })).toBe(false)
    expect(access(both, grant, paid)).toBe(true)
    expect(() => validateRolloutManifests([{ ...both, billingEnabled: false }])).toThrow(/Paid policy/)
  })
  it('fails closed after rollback even with a valid grant and paid record', () => {
    expect(access({ ...enabled, activationEnabled: false }, grant, paid)).toBe(false)
    expect(access(enabled, grant)).toBe(true)
  })
  it('uses separate adapter reads and fails closed when either check is unavailable', async () => {
    const both: AppRolloutManifest = { ...enabled, billingEnabled: true, accessPolicy: 'activation_and_paid' }
    const readActivationGrant = vi.fn().mockResolvedValue(grant)
    const readPaidEntitlement = vi.fn().mockResolvedValue(paid)
    expect(await checkAppAccess(both, { readActivationGrant, readPaidEntitlement }, enabled.appKey, 'adult-1', now)).toBe(true)
    expect(readActivationGrant).toHaveBeenCalledWith(enabled.appKey, 'adult-1')
    expect(readPaidEntitlement).toHaveBeenCalledWith(enabled.appKey, 'adult-1')
    expect(await checkAppAccess(both, { readActivationGrant }, enabled.appKey, 'adult-1', now)).toBe(false)
    readPaidEntitlement.mockRejectedValue(new Error('unavailable'))
    expect(await checkAppAccess(both, { readActivationGrant, readPaidEntitlement }, enabled.appKey, 'adult-1', now)).toBe(false)
    expect(await checkAppAccess(trumpetTrainerRollout, { readActivationGrant }, enabled.appKey, 'adult-1', now)).toBe(false)
  })
})
