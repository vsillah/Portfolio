import type { SocialCalendarPreparationProjection } from './social-calendar-preparation'

const CAMPAIGN_ID = 'b160eab6-1a5a-478d-954a-ca59a3a10e34'
const SOURCE_ROOT = 'artifacts/social-content/accelerated-campaign-visuals-2026-11-16/review-assets/carousel-faster-output/'
const REVIEW_ASSET_ROUTE = '/api/admin/social-content/accelerated-review-assets/'

const REVIEW_ITEMS: Record<string, { calendarId: string; kind: 'single_image' | 'text_only' | 'carousel'; source: string | null }> = {
  '20d09867-24ce-4849-b03d-f877d7114d6a': { calendarId: '796d6523-d600-45cf-96bb-541058af5817', kind: 'single_image', source: `${SOURCE_ROOT}slide-01.png` },
  'd0046271-92ba-4c7f-a009-197b44562f48': { calendarId: 'af8ed285-69f4-4036-8201-1aa66827bb48', kind: 'text_only', source: null },
  '9499ecbf-0349-472a-9b12-b6d987d1939d': { calendarId: '07fa29e5-40dc-4b86-9871-a49be6349613', kind: 'carousel', source: SOURCE_ROOT },
  '34471e82-2cb4-4e06-b3ec-d48f9739bb0f': { calendarId: 'fc23411f-f756-4ed8-8e5b-40ff26cf144e', kind: 'carousel', source: SOURCE_ROOT },
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export type AcceleratedCampaignReview = {
  kind: 'single_image' | 'text_only' | 'carousel'
  calendarItemId: string
  sourceManifestSha256: string
  assetUrls: string[]
  checks: { label: string; passed: boolean }[]
  readyForHumanReview: boolean
  externalActionsLocked: boolean
}

export function isAcceleratedCampaignReviewItem(item: { id: string; rag_context?: Record<string, unknown> | null }): boolean {
  return Boolean(REVIEW_ITEMS[item.id] && text(item.rag_context?.campaign_id) === CAMPAIGN_ID)
}

export function projectAcceleratedCampaignReview(item: {
  id: string
  status: string
  post_text: string
  cta_url?: string | null
  has_unsaved_changes?: boolean
  rag_context?: Record<string, unknown> | null
  calendar_preparation?: SocialCalendarPreparationProjection | null
}): AcceleratedCampaignReview | null {
  if (!isAcceleratedCampaignReviewItem(item)) return null
  const expected = REVIEW_ITEMS[item.id]
  const calendar = item.calendar_preparation
  const metadata = record(calendar?.campaign_review_metadata)
  const binding = record(metadata.visual_asset_binding)
  const checks = record(metadata.review_checks)
  const manifest = text(binding.source_manifest_sha256)
  const assetBound = calendar?.calendar_item_id === expected.calendarId
    && calendar?.social_content_id === item.id
    && binding.kind === expected.kind
    && (binding.primary_asset ?? null) === expected.source
    && Boolean(manifest)
    && manifest === text(metadata.visual_source_manifest_sha256)
    && Boolean(text(metadata.visual_human_qa_approved_at))
  const assetUrls = assetBound && expected.kind !== 'text_only'
    ? expected.kind === 'single_image'
      ? [`${REVIEW_ASSET_ROUTE}slide-01.png`]
      : Array.from({ length: 8 }, (_, index) => `${REVIEW_ASSET_ROUTE}slide-${String(index + 1).padStart(2, '0')}.png`)
    : []
  const externalActionsLocked = item.status === 'draft'
    && item.rag_context?.external_execution_enabled === false
    && metadata.external_execution_enabled === false
    && metadata.provider_generation_enabled === false
    && metadata.upload_enabled === false
    && metadata.schedule_enabled === false
    && metadata.publish_enabled === false
    && metadata.outreach_send_enabled === false
  const reviewChecks = [
    { label: 'Copy', passed: !item.has_unsaved_changes && Boolean(item.post_text.trim()) && metadata.content_packet_status === 'human_review_ready' },
    { label: 'Source and JIT', passed: checks.source === 'pass_with_jit_refresh' && metadata.jit_refresh_status === 'passed_internal_review' && Boolean(text(metadata.jit_refresh_packet_sha256)) },
    { label: 'Privacy', passed: checks.privacy === 'pass' },
    { label: 'Originality', passed: checks.originality === 'pass' },
    { label: 'CTA', passed: Boolean(text(item.cta_url)) && text(item.cta_url) === text(metadata.primary_cta_url) },
    { label: 'Approved visual', passed: assetBound },
  ]
  return {
    kind: expected.kind,
    calendarItemId: expected.calendarId,
    sourceManifestSha256: manifest,
    assetUrls,
    checks: reviewChecks,
    readyForHumanReview: reviewChecks.every((check) => check.passed) && externalActionsLocked,
    externalActionsLocked,
  }
}
