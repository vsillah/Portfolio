import type { ReceiptReviewPacket } from '@/lib/dark-castle-receipt-review-packets'

export const DARK_CASTLE_DESCRIPTION_SHA256 = '224f7d07a4d55a9de3d22028ce81a76312fe64e52f06bcf38c440da89a90817d'
export const DARK_CASTLE_SCRIPT_SHA256 = '982e17676e9125f201506cb59e38f3b813828bfe13681292bf5c23ba48ef83e0'
export const DARK_CASTLE_STORYBOARD_SHA256 = '9294ec46df24122577de4b4253f30709f50abb546ad3412be5e74bee75f82043'

export function buildApprovedDarkCastleReceipts(input: {
  packets: ReceiptReviewPacket[]
  approvedPacketIds: unknown
  reviewerId: string
  hashes: { scriptSha256: string; storyboardSha256: string; masterSha256: string; thumbnailSha256: string }
}) {
  const { packets, approvedPacketIds, reviewerId, hashes } = input
  if (!Array.isArray(approvedPacketIds) || approvedPacketIds.length !== 6 || new Set(approvedPacketIds).size !== 6
    || packets.length !== 6 || packets.some(packet => !approvedPacketIds.includes(packet.packet_id) || packet.blockers.some(blocker => !blocker.includes('reviewer decision and persisted prerequisite receipt are missing')))) {
    throw new Error('All six exact packets must be reviewed against current evidence before recording.')
  }
  if (!reviewerId || hashes.scriptSha256 !== DARK_CASTLE_SCRIPT_SHA256
    || hashes.storyboardSha256 !== DARK_CASTLE_STORYBOARD_SHA256
    || hashes.masterSha256 !== '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
    || hashes.thumbnailSha256 !== '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0') {
    throw new Error('Reviewer or approved artifact hashes are missing or mismatched.')
  }
  const artifact_hashes = {
    script_sha256: hashes.scriptSha256, storyboard_sha256: hashes.storyboardSha256,
    master_sha256: hashes.masterSha256, thumbnail_sha256: hashes.thumbnailSha256,
    description_sha256: DARK_CASTLE_DESCRIPTION_SHA256,
  }
  return packets.map(packet => ({
    kind: packet.kind, packet_id: packet.packet_id,
    receipt_id: `${packet.packet_id}:approved`,
    evidence_fingerprint: packet.packet_id.split(':').at(-1),
    status: 'approved', reviewer_id: reviewerId,
    source_content_updated_at: packet.content_updated_at,
    artifact_hashes,
    ...(packet.kind === 'visual' ? {
      asset_sha256: `sha256:${hashes.thumbnailSha256}`,
      asset_path: '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/03-accidental-success-v2.png',
    } : {}),
  }))
}
