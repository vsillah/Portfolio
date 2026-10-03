import { describe, it, expect } from 'vitest'
import { actionIdempotencyKey, decideCampaignRelease, parseCampaignManifest, releaseHash, type CampaignReleaseManifest, type ReleaseRecord } from './campaign-release-manifest'

import { fixture } from './campaign-release-test-fixture'
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`
const now = new Date('2026-10-03T01:00:00Z')
function pending(manifest = fixture()): ReleaseRecord { return { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] } }
describe('bounded campaign manifest', () => {
  it('hashes equivalent object key order deterministically', () => expect(releaseHash({ b: 2, a: 1 })).toBe(releaseHash({ a: 1, b: 2 })))
  it('accepts a broadcast and an exact one-recipient relationship action', () => {
    expect(parseCampaignManifest(fixture()).class).toBe('broadcast_release')
    const input = fixture(); input.class = 'relationship_outreach_batch'
    Object.assign(input.actions[0], { provider: 'gmail', operation: 'send', expectedReceipt: 'gmail_message_id', recipients: [{ address: 'synthetic@example.invalid', consentEvidenceId: 'consent-1', suppressionEvidenceId: 'check-1' }] })
    input.actions[0].source.table = 'outreach_queue'
    expect(parseCampaignManifest(input).class).toBe('relationship_outreach_batch')
  })
  it.each(['copy', 'assets', 'accountId', 'scheduledFor', 'audience'] as const)('invalidates approval for material %s changes', field => {
    const record = pending()
    if (field === 'copy') record.manifest.actions[0].copy.body += 'changed'
    else if (field === 'assets') record.manifest.actions[0].assets.push({ ref: 'new.mp4', sha256: 'b'.repeat(64), privacyReviewId: 'new-review' })
    else record.manifest.actions[0][field] = field === 'scheduledFor' ? '2026-10-03T13:00:00Z' : 'changed'
    expect(() => decideCampaignRelease(record, record.hash, 'approve', 'actor', now)).toThrow('Manifest changed')
  })
  it('rejects duplicate targets and over-cap actions', () => {
    const m = fixture(); m.actions.push({ ...m.actions[0], id: id(5) })
    expect(() => parseCampaignManifest(m)).toThrow('Duplicate source')
    m.actions.pop(); m.actions[0].maxSpendCents = 1
    expect(() => parseCampaignManifest(m)).toThrow('exceeds')
  })
  it('rejects cycles, out-of-window schedules, unknown scope and SMS', () => {
    const m = fixture(); m.actions[0].dependsOn = [m.actions[0].id]
    expect(() => parseCampaignManifest(m)).toThrow()
    m.actions[0].dependsOn = []; m.actions[0].scheduledFor = m.expiresAt
    expect(() => parseCampaignManifest(m)).toThrow('Schedule')
    expect(() => parseCampaignManifest({ ...fixture(), blanketApproval: true })).toThrow()
    const sms = fixture(); (sms.actions[0] as { provider: string }).provider = 'sms'
    expect(() => parseCampaignManifest(sms)).toThrow()
  })
  it('stops permanently, preserves audit, and handles duplicate decisions', () => {
    const record = pending()
    const approved = decideCampaignRelease(record, record.hash, 'approve', 'actor', now)
    expect(decideCampaignRelease(approved, record.hash, 'approve', 'actor', now)).toBe(approved)
    const stopped = decideCampaignRelease(approved, record.hash, 'stop', 'actor', now)
    expect(stopped.audit).toHaveLength(2)
    expect(() => decideCampaignRelease(stopped, record.hash, 'approve', 'actor', now)).toThrow('Stopped')
  })
  it('requires fresh release after hold and rejects expired approvals', () => {
    const r = pending()
    expect(() => decideCampaignRelease(decideCampaignRelease(r, r.hash, 'hold', 'actor', now), r.hash, 'approve', 'actor', now)).toThrow('fresh')
    expect(() => decideCampaignRelease(r, r.hash, 'approve', 'actor', new Date(r.manifest.expiresAt))).toThrow('window')
  })
  it('keeps action dedupe independent of a repackaged release ID', () => {
    const a = fixture(), b = fixture(); b.releaseId = id(9)
    expect(actionIdempotencyKey(a.actions[0])).toBe(actionIdempotencyKey(b.actions[0]))
    expect(releaseHash(a)).not.toBe(releaseHash(b))
    b.actions[0].source.fingerprint = 'f'.repeat(64)
    expect(actionIdempotencyKey(a.actions[0])).toBe(actionIdempotencyKey(b.actions[0]))
  })
})
