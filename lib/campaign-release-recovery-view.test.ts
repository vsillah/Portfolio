import { describe, expect, it } from 'vitest'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import type { ExecutionAttempt } from './campaign-release-execution'
import { campaignReadiness, campaignRecoveryView, syntheticExecutionProgress } from './campaign-release-recovery-view'

describe('sanitized synthetic recovery projection', () => {
  it('excludes worker fences, callbacks and raw receipt payloads before serialization', () => {
    const manifest = fixture(), record: ReleaseRecord = { manifest, hash: releaseHash(manifest), version: 1, audit: [], state: 'approved' }
    const attempt: ExecutionAttempt = { id: 'private-attempt', releaseId: manifest.releaseId, manifestHash: record.hash, actionId: manifest.actions[0].id,
      deliveryKey: 'private-key', authorizationKey: 'private-auth', contentHash: 'a'.repeat(64), owner: 'private-owner', version: 2, leaseUntil: manifest.expiresAt,
      state: 'confirmed', tryCount: 1, reservedCents: 0, spentCents: 0, events: [{ at: manifest.createdAt, kind: 'private-event' }], callbacks: { privateCallback: 'private-digest' },
      receipt: { trust: 'synthetic', provider: 'linkedin', accountId: 'private-account', actionKey: 'private-key', contentHash: 'a'.repeat(64), receiptType: 'platform_post_id', providerId: 'synthetic:step', receivedAt: manifest.createdAt } }
    const progress = syntheticExecutionProgress(record, [attempt, { ...attempt, manifestHash: 'other' }])
    expect(progress).toHaveLength(1)
    expect(JSON.stringify(progress)).not.toContain('private')
    const view = campaignRecoveryView(record, progress, Date.parse(manifest.createdAt))
    expect(view[0].state).toBe('Synthetic receipt confirmed')
    expect(view[0].detail).toContain('No provider delivery')
    delete attempt.receipt!.trust
    expect(syntheticExecutionProgress(record, [attempt])[0].state).toBe('reconciliation_required')
    expect(syntheticExecutionProgress(record, [attempt])[0].receiptId).toBeNull()
    attempt.receipt!.providerId = 'private-provider-receipt'
    expect(syntheticExecutionProgress(record, [attempt])[0].receiptId).toBeNull()
  })
})


it('separates current approval from stale persistence and disabled delivery', () => {
  const manifest = fixture(), record: ReleaseRecord = { manifest, hash: releaseHash(manifest), version: 2, audit: [], state: 'approved' }
  const binding = { releaseId: manifest.releaseId, manifestHash: record.hash, approvalVersion: 2, status: 'bound' as const, checkedAt: manifest.createdAt }
  const now = Date.parse('2026-10-03T13:00:00Z')
  expect(campaignReadiness(record, [binding], now)).toMatchObject({ approval: 'approved', persistence: 'Approval bound · review only', delivery: 'Disabled' })
  expect(campaignReadiness({ ...record, version: 3, state: 'held' }, [binding], now)).toMatchObject({ persistence: 'Binding stale / unconfirmed', nextAction: 'Prepare a fresh release packet.' })
  expect(campaignReadiness(record, [], now).persistence).toBe('Journal not connected')
  expect(campaignReadiness(record, [binding], Date.parse(manifest.expiresAt)).approval).toBe('Expired / unavailable')
})
