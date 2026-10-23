import type { SocialContentItem } from '@/lib/social-content'
import { socialCopyVersion } from '@/lib/social-copy-revision'
import { projectDeterministicVisualRender } from '@/lib/social-deterministic-visual'
import {
  approvedVisualReviewContract,
  DARK_CASTLE_COPY_APPROVED_AT,
  DARK_CASTLE_EVIDENCE_FINGERPRINT,
  DARK_CASTLE_SOCIAL_CONTENT_ID,
  DARK_CASTLE_VISUAL_PATH,
  DARK_CASTLE_VISUAL_QA_ID,
} from '@/lib/social-approved-visual-contract'

export type DarkCastleVisualQaState = 'current' | 'missing' | 'stale' | 'mismatch'

export function darkCastleVisualQaFixtureEnabled() {
  return !process.env.VERCEL_ENV && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
}

export function darkCastleVisualQaFixture(state: DarkCastleVisualQaState = 'current'): SocialContentItem {
  const postText = 'A tutorial can teach a move and still lose the lesson when the player crosses into real play and the board resets. Explore: Inspect a position and choose a move before adding time pressure. Transfer: Carry the same board state into computer play without resetting the lesson. Meet the response: Use the reply, coaching, and notation to consider the next decision while staying inside the public pilot boundary. The sequence shows product teams how state continuity turns a disconnected tutorial into a repeatable explore, transfer, and respond learning loop. Every customer-facing claim in this adaptation remains bound to 2 approved source identities, 3 cleared artifacts, and the current privacy, rights, challenger, and script-quality receipts. State continuity is part of the learning experience, not invisible plumbing.'
  const item = {
    id: DARK_CASTLE_VISUAL_QA_ID,
    status: 'approved',
    platform: 'youtube',
    post_text: postText,
    cta_text: null,
    cta_url: null,
    hashtags: [],
    image_prompt: 'Use the real gameplay state as the visual anchor, then follow the player decision, product response, and traceable learning value. Use one artifact-specific evidence path rather than a generic repeated card layout.',
    voiceover_text: postText,
    target_platforms: ['youtube'],
    youtube_title: 'Dark Castle Chess: what the artifact makes visible',
    youtube_description: 'The sequence shows product teams how state continuity turns a disconnected tutorial into a repeatable explore, transfer, and respond learning loop.\n\nReal gameplay makes the product lesson inspectable while the pilot and outcome boundaries prevent a compelling visual from becoming an unsupported claim.',
    image_url: state === 'missing' ? null : DARK_CASTLE_VISUAL_PATH,
    framework_visual_type: null,
    content_format: 'single_image',
    updated_at: DARK_CASTLE_COPY_APPROVED_AT,
    reviewed_by: 'qa-review',
    rag_context: {
      source: 'social_content_calendar_authorization',
      calendar_item_id: '4070755c-7c46-4c3e-ac9b-94d35921556e',
      work_item_id: '2403b70a-c262-429e-8da3-964e082f5a59',
      publish_gate: 'draft_only',
      external_execution_enabled: false,
      qa_fixture: {
        id: DARK_CASTLE_VISUAL_QA_ID,
        kind: 'approved_visual_contract_preview',
        read_only: true,
        target_record_id: DARK_CASTLE_SOCIAL_CONTENT_ID,
        reason: 'Read-only production-equivalent visual review. No shared record or provider is changed.',
      },
      deterministic_visual_review_approval: {
        copy_approved_at: DARK_CASTLE_COPY_APPROVED_AT,
        evidence_fingerprint: DARK_CASTLE_EVIDENCE_FINGERPRINT,
      },
    },
  } as unknown as SocialContentItem
  const copyVersion = socialCopyVersion(item)
  const contract = approvedVisualReviewContract(state === 'stale' ? '0'.repeat(64) : copyVersion)
  if (state === 'mismatch') contract.asset_sha256 = '0'.repeat(64)
  if (state !== 'missing') item.rag_context = { ...item.rag_context, deterministic_visual_review_contract: contract }
  item.deterministic_visual_render = projectDeterministicVisualRender({ item, copyVersion, storageAvailable: true, releaseLocked: false })
  return item
}
