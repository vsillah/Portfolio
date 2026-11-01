import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import masterReceipt from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/receipts.json'
import selection from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-selection-receipt-v1.json'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'

export const DARK_CASTLE_MASTER_SHA256 = '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
export const DARK_CASTLE_THUMBNAIL_SHA256 = '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0'
export const DARK_CASTLE_MASTER_PATH = '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/dark-castle-youtube-master.mp4'
export const DARK_CASTLE_THUMBNAIL_PATH = '/review-assets/social-content/dark-castle-youtube-master-2026-10-29/03-accidental-success-v2.png'

export async function verifiedDarkCastleApprovedArtifacts() {
  if (masterReceipt.canonicalRecord !== DARK_CASTLE_COPY_CONTENT_ID
    || selection.social_content_id !== DARK_CASTLE_COPY_CONTENT_ID
    || masterReceipt.contentVersion !== selection.content_version
    || masterReceipt.finalMediaReceipt.sha256 !== DARK_CASTLE_MASTER_SHA256
    || selection.selected_asset_sha256 !== DARK_CASTLE_THUMBNAIL_SHA256
    || selection.selected_asset_path !== DARK_CASTLE_THUMBNAIL_PATH
    || selection.selected_direction !== 'C'
    || selection.status !== 'human_qa_approved'
    || !selection.receipt_id
    || !masterReceipt.descriptionReceipt
    || !masterReceipt.evidenceReceipt.identity
    || Object.values(masterReceipt.externalGates).some(Boolean)) {
    throw new Error('Approved artifact receipt identities are missing or mismatched.')
  }
  const root = path.join(process.cwd(), 'public')
  const [master, thumbnail] = await Promise.all([
    readFile(path.join(root, DARK_CASTLE_MASTER_PATH)),
    readFile(path.join(root, DARK_CASTLE_THUMBNAIL_PATH)),
  ])
  const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex')
  if (sha(master) !== DARK_CASTLE_MASTER_SHA256 || sha(thumbnail) !== DARK_CASTLE_THUMBNAIL_SHA256) {
    throw new Error('Approved media file hash mismatch.')
  }
  return {
    contentVersion: masterReceipt.contentVersion,
    masterSha256: DARK_CASTLE_MASTER_SHA256,
    masterPath: DARK_CASTLE_MASTER_PATH,
    thumbnailSha256: DARK_CASTLE_THUMBNAIL_SHA256,
    thumbnailPath: DARK_CASTLE_THUMBNAIL_PATH,
    thumbnailDirection: selection.selected_direction,
    selectionReceiptId: selection.receipt_id,
    descriptionReceiptId: masterReceipt.descriptionReceipt,
    evidenceReceiptId: masterReceipt.evidenceReceipt.identity,
  }
}
