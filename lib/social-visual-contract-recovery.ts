import type { SocialContentItem } from '@/lib/social-content'

export const SOCIAL_VISUAL_BACKLOG_QA_ID = 'f966123f-05eb-48ec-a7c2-970afce642ef'
export const SOCIAL_VISUAL_BACKLOG_QA_FIXTURE = 'social_visual_backlog_recovery'

type RecoveryItem = Pick<SocialContentItem, 'id' | 'status' | 'content_format' | 'image_url' | 'rag_context'>

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** A saved backlog packet explicitly expects provider-free, version-bound visual review. */
export function needsSavedCopyVisualRecovery(item: RecoveryItem): boolean {
  if (item.status !== 'approved' || item.content_format !== 'single_image' || item.image_url) return false
  const rag = record(item.rag_context)
  return rag.source_type === 'version_bound_provider_none_mp4'
    && typeof rag.work_item_id === 'string' && rag.work_item_id.length > 0
    && !Object.keys(record(rag.deterministic_visual_review_contract)).length
    && !Object.keys(record(rag.deterministic_visual_asset)).length
}

export function savedCopyRecoveryHref(recordId: string, qaFixture?: string): string {
  const query = new URLSearchParams({ step: 'copy' })
  if (qaFixture) query.set('qa_fixture', qaFixture)
  return `/admin/social-content/${encodeURIComponent(recordId)}?${query.toString()}#social-copy-gate`
}
