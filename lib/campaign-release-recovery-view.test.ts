import { describe, expect, it } from 'vitest'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import type { ExecutionAttempt } from './campaign-release-execution'
import { campaignRecoveryView, syntheticExecutionProgress } from './campaign-release-recovery-view'

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
