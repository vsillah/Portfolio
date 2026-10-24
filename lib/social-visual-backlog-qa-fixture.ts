import type { SocialContentItem } from '@/lib/social-content'
import { socialCopyVersion } from '@/lib/social-copy-revision'
import { projectDeterministicVisualRender } from '@/lib/social-deterministic-visual'
import { SOCIAL_VISUAL_BACKLOG_QA_FIXTURE, SOCIAL_VISUAL_BACKLOG_QA_ID } from '@/lib/social-visual-contract-recovery'

export function socialVisualBacklogQaFixtureEnabled(): boolean {
  return !process.env.VERCEL_ENV && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
}

export function socialVisualBacklogQaFixture(): SocialContentItem {
  const item = {
    id: SOCIAL_VISUAL_BACKLOG_QA_ID,
    status: 'approved',
    platform: 'youtube',
    content_format: 'single_image',
    post_text: 'Saved copy is represented by a privacy-safe placeholder in this local review.',
    voiceover_text: 'Saved copy is represented by a privacy-safe placeholder in this local review.',
    cta_text: null,
    cta_url: null,
    hashtags: [],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    target_platforms: ['youtube'],
    updated_at: '2026-10-24T00:00:00Z',
    rag_context: {
      source_type: 'version_bound_provider_none_mp4',
      work_item_id: 'local-qa-work-item',
      external_execution_enabled: false,
      platform_draft_enabled: false,
      qa_fixture: { kind: SOCIAL_VISUAL_BACKLOG_QA_FIXTURE, read_only: true },
    },
  } as unknown as SocialContentItem
  item.deterministic_visual_render = projectDeterministicVisualRender({
    item,
    copyVersion: socialCopyVersion(item),
    storageAvailable: true,
    releaseLocked: false,
  })
  return item
}
