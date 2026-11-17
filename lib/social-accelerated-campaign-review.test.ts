import { describe, expect, it } from 'vitest'
import { projectSocialCalendarPreparation } from './social-calendar-preparation'
import { isAcceleratedCampaignReviewItem, projectAcceleratedCampaignReview } from './social-accelerated-campaign-review'

const campaignId = 'b160eab6-1a5a-478d-954a-ca59a3a10e34'
const manifest = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'
const root = 'artifacts/social-content/accelerated-campaign-visuals-2026-11-16/review-assets/carousel-faster-output/'
const cases = [
  ['20d09867-24ce-4849-b03d-f877d7114d6a', '796d6523-d600-45cf-96bb-541058af5817', 'single_image', `${root}slide-01.png`, 1],
  ['d0046271-92ba-4c7f-a009-197b44562f48', 'af8ed285-69f4-4036-8201-1aa66827bb48', 'text_only', null, 0],
  ['9499ecbf-0349-472a-9b12-b6d987d1939d', '07fa29e5-40dc-4b86-9871-a49be6349613', 'carousel', root, 8],
  ['34471e82-2cb4-4e06-b3ec-d48f9739bb0f', 'fc23411f-f756-4ed8-8e5b-40ff26cf144e', 'carousel', root, 8],
] as const

function fixture(id: string, calendarId: string, kind: string, source: string | null) {
  const calendar_preparation = projectSocialCalendarPreparation({
    id: calendarId,
    social_content_id: id,
    authorization_status: 'authorized',
    due_status: 'upcoming',
    metadata: {
      visual_asset_binding: { kind, primary_asset: source, source_manifest_sha256: manifest },
      visual_source_manifest_sha256: manifest,
      visual_human_qa_approved_at: '2026-11-16T18:00:00Z',
      review_checks: { source: 'pass_with_jit_refresh', privacy: 'pass', originality: 'pass' },
      jit_refresh_status: 'passed_internal_review',
      jit_refresh_packet_sha256: 'jit-receipt',
      primary_cta_url: 'https://amadutown.com/accelerated',
      content_packet_status: 'human_review_ready',
      external_execution_enabled: false,
      provider_generation_enabled: false,
      upload_enabled: false,
      schedule_enabled: false,
      publish_enabled: false,
      outreach_send_enabled: false,
    },
  }, id)
  return { id, status: 'draft', post_text: 'Approved teaching copy', cta_url: 'https://amadutown.com/accelerated', rag_context: { campaign_id: campaignId, external_execution_enabled: false }, calendar_preparation }
}

describe('Accelerated campaign review routing', () => {
  it.each(cases)('uses the linked approved binding for %s', (id, calendarId, kind, source, count) => {
    const item = fixture(id, calendarId, kind, source)
    expect(isAcceleratedCampaignReviewItem(item)).toBe(true)
    const review = projectAcceleratedCampaignReview(item)!
    expect(review.readyForHumanReview).toBe(true)
    expect(review.externalActionsLocked).toBe(true)
    expect(review.assetUrls).toHaveLength(count)
    expect(review.checks.map((check) => check.label)).toEqual(['Copy', 'Source and JIT', 'Privacy', 'Originality', 'CTA', 'Approved visual'])
  })

  it('keeps practitioner records on their existing route', () => {
    const item = { ...fixture(cases[0][0], cases[0][1], cases[0][2], cases[0][3]), rag_context: { campaign_id: 'another-campaign', external_execution_enabled: false } }
    expect(isAcceleratedCampaignReviewItem(item)).toBe(false)
    expect(projectAcceleratedCampaignReview(item)).toBeNull()
  })

  it('fails closed for a changed visual, missing JIT, or enabled external action', () => {
    const original = fixture(cases[0][0], cases[0][1], cases[0][2], cases[0][3])
    const changed = structuredClone(original)
    changed.calendar_preparation!.campaign_review_metadata.visual_asset_binding = { kind: 'single_image', primary_asset: 'unapproved.svg', source_manifest_sha256: manifest }
    expect(projectAcceleratedCampaignReview(changed)?.readyForHumanReview).toBe(false)
    const missingJit = structuredClone(original)
    missingJit.calendar_preparation!.campaign_review_metadata.jit_refresh_status = null
    expect(projectAcceleratedCampaignReview(missingJit)?.readyForHumanReview).toBe(false)
    const unlocked = structuredClone(original)
    unlocked.calendar_preparation!.campaign_review_metadata.upload_enabled = true
    expect(projectAcceleratedCampaignReview(unlocked)?.externalActionsLocked).toBe(false)
    expect(projectAcceleratedCampaignReview(unlocked)?.readyForHumanReview).toBe(false)
  })
})
