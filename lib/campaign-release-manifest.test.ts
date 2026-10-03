import { describe, expect, it } from 'vitest'
import { campaignActionBlockers, campaignActionKeys, decideCampaignRelease, sealCampaignRelease,
  type CampaignReleaseManifest, type CampaignReviewState } from './campaign-release-manifest'

function fixture(): CampaignReleaseManifest {
  return {
    schemaVersion: 'campaign-release-v1', id: 'release-1', revision: 1, class: 'broadcast_release',
    campaignRef: 'campaign-1', objective: 'Explain the reviewed product update', currency: 'USD',
    createdAt: '2026-10-03T10:00:00Z', expiresAt: '2026-10-03T12:00:00Z', maxSpendCents: 100,
    stopConditions: ['Stop on uncertain delivery'], actions: [{
      id: 'linkedin-1', operation: 'publish', platform: 'linkedin', accountRef: 'account-1',
      sourceRef: 'social-queue-1', sourceVersion: 'version-1', audience: 'Public followers', recipientRef: null,
      payload: { subject: '', body: 'Reviewed copy', metadata: { visibility: 'public', format: 'text' }, assets: [] },
      scheduledAt: '2026-10-03T10:00:00Z', maxSpendCents: 0,
      consentEvidenceRef: 'public-broadcast-policy-v1', suppressionEvidenceRef: 'review-1',
      evidenceExpiresAt: '2026-10-03T12:00:00Z', expectedReceipt: 'publication_id',
    }],
  }
}
const now = '2026-10-03T11:00:00Z'
function approved(digest: string): CampaignReviewState { return { digest, status: 'approved', actorRef: 'operator-1' } }
function context() { return { now, emergencyStopped: false, providerGateSatisfied: true,
  consentAndSuppressionCurrent: true, reservedSpendCents: 0, evidence: { state: 'untouched' as const } } }

describe('campaign manifest boundary', () => {
  it('owns and deeply freezes the approved snapshot', () => {
    const input = fixture()
    const sealed = sealCampaignRelease(input)
    input.actions[0].payload.body = 'Changed later'
    expect(sealed.manifest.actions[0].payload.body).toBe('Reviewed copy')
    expect(Object.isFrozen(sealed.manifest.actions[0].payload.metadata)).toBe(true)
    expect(() => { (sealed.manifest.actions[0].payload as { body: string }).body = 'tamper' }).toThrow()
  })
  it('hashes object keys canonically while preserving exact copy bytes', () => {
    const a = fixture(), b = fixture()
    b.actions[0].payload.metadata = { format: 'text', visibility: 'public' }
    expect(sealCampaignRelease(a).digest).toBe(sealCampaignRelease(b).digest)
    b.actions[0].payload.body += ' '
    expect(sealCampaignRelease(a).digest).not.toBe(sealCampaignRelease(b).digest)
  })
  it.each(['objective', 'expiresAt', 'revision', 'maxSpendCents'] as const)('invalidates material %s changes', field => {
    const input = fixture(), before = sealCampaignRelease(input)
    if (field === 'revision' || field === 'maxSpendCents') input[field]++
    else if (field === 'expiresAt') input[field] = '2026-10-03T13:00:00Z'
    else input[field] += ' revised'
    expect(sealCampaignRelease(input).digest).not.toBe(before.digest)
  })
  it.each(['accountRef', 'sourceVersion', 'audience', 'consentEvidenceRef', 'suppressionEvidenceRef'] as const)('binds action %s', field => {
    const input = fixture(), before = sealCampaignRelease(input)
    input.actions[0][field] += '-changed'
    expect(sealCampaignRelease(input).digest).not.toBe(before.digest)
  })
  it('changes authorization keys but retains the delivery ledger key after revision', () => {
    const input = fixture(), first = campaignActionKeys(sealCampaignRelease(input), 'linkedin-1')
    input.revision++
    input.actions[0].payload.body = 'New copy'
    const next = campaignActionKeys(sealCampaignRelease(input), 'linkedin-1')
    expect(next.idempotencyKey).not.toBe(first.idempotencyKey)
    expect(next.contentHash).not.toBe(first.contentHash)
    expect(next.deliveryKey).toBe(first.deliveryKey)
  })
  it('rejects duplicate IDs and duplicate targets even under different IDs', () => {
    const input = fixture()
    input.actions.push(structuredClone(input.actions[0]))
    expect(() => sealCampaignRelease(input)).toThrow('Duplicate action IDs')
    input.actions[1].id = 'another'
    expect(() => sealCampaignRelease(input)).toThrow('Duplicate delivery target')
  })
  it('rejects unknown fields rather than silently excluding them from approval', () => {
    expect(() => sealCampaignRelease({ ...fixture(), hiddenRecipient: 'other' })).toThrow()
  })
  it('requires exact relationship recipients and matching operation/receipts', () => {
    const input = fixture()
    input.class = 'relationship_outreach_batch'
    input.actions[0].platform = 'gmail'
    expect(() => sealCampaignRelease(input)).toThrow()
    Object.assign(input.actions[0], { recipientRef: 'recipient-1', operation: 'send', expectedReceipt: 'message_id' })
    expect(sealCampaignRelease(input).manifest.class).toBe('relationship_outreach_batch')
    input.actions[0].platform = 'youtube'
    expect(() => sealCampaignRelease(input)).toThrow()
  })
  it('rejects expired evidence, impossible schedules, and over-budget plans', () => {
    for (const change of [
      { scheduledAt: '2026-10-03T12:00:00Z' }, { evidenceExpiresAt: '2026-10-03T09:00:00Z' }, { maxSpendCents: 101 },
    ]) {
      const input = fixture()
      Object.assign(input.actions[0], change)
      expect(() => sealCampaignRelease(input)).toThrow()
    }
  })
})

describe('bounded decision and recovery planning', () => {
  it('rejects stale Slack decisions and replays approval idempotently', () => {
    const release = sealCampaignRelease(fixture())
    const state: CampaignReviewState = { digest: release.digest, status: 'pending', actorRef: null }
    const decision = { digest: release.digest, decision: 'approve' as const, actorRef: 'operator-1', now }
    expect(() => decideCampaignRelease(release, state, { ...decision, digest: 'stale' })).toThrow('Manifest changed')
    const result = decideCampaignRelease(release, state, decision)
    expect(result.status).toBe('approved')
    expect(decideCampaignRelease(release, result, decision)).toBe(result)
    expect(() => decideCampaignRelease(release, state, { ...decision, now: 'invalid' })).toThrow()
    expect(() => decideCampaignRelease(release, state, { ...decision, now: '2026-10-03T12:00:00Z' })).toThrow('outside approval')
  })
  it.each(['hold', 'request_revision', 'emergency_stop'] as const)('cannot approve through %s using an old card', decision => {
    const release = sealCampaignRelease(fixture())
    const input = { digest: release.digest, decision, actorRef: 'operator-1', now }
    const result = decideCampaignRelease(release, approved(release.digest), input)
    if (decision === 'emergency_stop') {
      expect(decideCampaignRelease(release, result, { ...input, decision: 'approve' }).status).toBe('stopped')
    } else expect(() => decideCampaignRelease(release, result, { ...input, decision: 'approve' })).toThrow('Fresh manifest')
  })
  it('permits stop after expiration', () => {
    const release = sealCampaignRelease(fixture())
    expect(decideCampaignRelease(release, approved(release.digest), {
      digest: release.digest, decision: 'emergency_stop', actorRef: 'operator-1', now: '2027-01-01T00:00:00Z',
    }).status).toBe('stopped')
  })
  it.each(['claimed', 'uncertain', 'confirmed'] as const)('blocks replay of %s actions', state => {
    const release = sealCampaignRelease(fixture())
    expect(campaignActionBlockers(release, approved(release.digest), 'linkedin-1', {
      ...context(), evidence: { state },
    })).toContain('reconciliation_required')
  })
  it('requires each independent gate even with approval', () => {
    const release = sealCampaignRelease(fixture())
    expect(campaignActionBlockers(release, approved(release.digest), 'linkedin-1', context())).toEqual([])
    expect(campaignActionBlockers(release, approved(release.digest), 'linkedin-1', {
      ...context(), emergencyStopped: true, providerGateSatisfied: false, consentAndSuppressionCurrent: false,
      reservedSpendCents: 101, now: '2026-10-03T12:00:00Z',
    })).toEqual(['emergency_stop', 'outside_execution_window', 'consent_or_suppression_gate', 'provider_gate', 'spend_cap'])
  })
  it('blocks legacy receipt evidence even if labeled untouched', () => {
    const release = sealCampaignRelease(fixture())
    expect(campaignActionBlockers(release, approved(release.digest), 'linkedin-1', {
      ...context(), evidence: { state: 'untouched', providerReceiptId: 'provider-1' },
    })).toContain('reconciliation_required')
  })
  it('parks SMS despite every other gate passing', () => {
    const input = fixture()
    input.class = 'relationship_outreach_batch'
    Object.assign(input.actions[0], { platform: 'telnyx', recipientRef: 'recipient-1', operation: 'send', expectedReceipt: 'message_id' })
    const release = sealCampaignRelease(input)
    expect(campaignActionBlockers(release, approved(release.digest), 'linkedin-1', context())).toEqual(['sms_parked'])
  })
})
