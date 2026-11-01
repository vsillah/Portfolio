import { describe, expect, it } from 'vitest'
import { buildApprovedDarkCastleReceipts, DARK_CASTLE_DESCRIPTION_SHA256, DARK_CASTLE_SCRIPT_SHA256, DARK_CASTLE_STORYBOARD_SHA256 } from './dark-castle-prerequisite-recorder'
import { DARK_CASTLE_RECEIPT_UPDATED_AT, type ReceiptReviewPacket } from './dark-castle-receipt-review-packets'

const kinds = ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'] as const
const packets = kinds.map(kind => ({ kind, packet_id: `dark-castle-review-packet:${kind}:fingerprint-${kind}`,
  content_updated_at: DARK_CASTLE_RECEIPT_UPDATED_AT,
  blockers: [`${kind} reviewer decision and persisted prerequisite receipt are missing.`] })) as ReceiptReviewPacket[]
const hashes = { scriptSha256: DARK_CASTLE_SCRIPT_SHA256, storyboardSha256: DARK_CASTLE_STORYBOARD_SHA256,
  masterSha256: '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36',
  thumbnailSha256: '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0' }
const input = { packets, approvedPacketIds: packets.map(packet => packet.packet_id), reviewerId: 'reviewer-id', hashes }

describe('approved Dark Castle prerequisite receipt request', () => {
  it('binds six distinct identities, reviewer, source timestamp and every approved hash', () => {
    const result = buildApprovedDarkCastleReceipts(input)
    expect(new Set(result.map(receipt => receipt.receipt_id)).size).toBe(6)
    expect(result.every(receipt => receipt.reviewer_id === 'reviewer-id' && receipt.source_content_updated_at === DARK_CASTLE_RECEIPT_UPDATED_AT
      && receipt.artifact_hashes.description_sha256 === DARK_CASTLE_DESCRIPTION_SHA256)).toBe(true)
    expect(result.find(receipt => receipt.kind === 'visual')).toMatchObject({ asset_sha256: `sha256:${hashes.thumbnailSha256}` })
  })
  it('rejects missing, duplicate, stale, and mismatched review inputs', () => {
    expect(() => buildApprovedDarkCastleReceipts({ ...input, approvedPacketIds: input.approvedPacketIds.slice(1) })).toThrow()
    expect(() => buildApprovedDarkCastleReceipts({ ...input, approvedPacketIds: Array(6).fill(input.approvedPacketIds[0]) })).toThrow()
    expect(() => buildApprovedDarkCastleReceipts({ ...input, packets: packets.map((packet, index) => index ? packet : { ...packet, blockers: ['Stale content'] }) })).toThrow()
    expect(() => buildApprovedDarkCastleReceipts({ ...input, hashes: { ...hashes, masterSha256: 'wrong' } })).toThrow()
  })
})
