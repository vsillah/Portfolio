import { currentEditorialReceipt, editorialInputVersion } from './video-editorial-quality'
import { archiveId } from './video-media-url'
/** Browser-safe readiness contract; no provider calls. */
export const LINKEDIN_VIDEO_BLOCKER = 'Native LinkedIn video submission is not configured: the Videos API upload/finalize adapter and author video-post permissions have not been qualified. Keep this item in internal review; do not fall back to a text or image post.'
export function reviewRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function socialVideoAssetVersion(item: { video_url?: unknown; rag_context?: unknown }): string | null {
  const asset = reviewRecord(reviewRecord(item.rag_context).reviewed_video_asset)
  if (!archiveId(item.video_url) || asset.url !== item.video_url || !asset.job_id || !asset.job_version) return null
  const editorial = currentEditorialReceipt(item)
  if (!editorial || asset.editorial_input_version !== editorialInputVersion(item) || asset.editorial_reviewed_at !== editorial.reviewed_at) return null
  return JSON.stringify([asset.editorial_input_version, asset.editorial_reviewed_at, asset.job_id, asset.job_version, asset.url, asset.thumbnail_url ?? null])
}
export function socialVideoReviewReady(item: { video_url?: unknown; rag_context?: unknown }): boolean {
  if (!item.video_url) return true
  const review = reviewRecord(reviewRecord(item.rag_context).media_review)
  const version = socialVideoAssetVersion(item)
  return Boolean(version && review.status === 'approved' && review.asset_version === version && review.approved_by && review.approved_at && review.privacy_confirmed === true)
}
