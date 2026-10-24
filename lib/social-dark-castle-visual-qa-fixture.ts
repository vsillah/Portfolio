import type { SocialContentItem } from '@/lib/social-content'
import { socialCopyVersion } from '@/lib/social-copy-revision'
import { projectDeterministicVisualRender } from '@/lib/social-deterministic-visual'
import {
  approvedVisualReviewContract,
  DARK_CASTLE_COPY_APPROVED_AT,
  DARK_CASTLE_CORRECTION_CREATED_AT,
  DARK_CASTLE_EVIDENCE_FINGERPRINT,
  DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE,
  DARK_CASTLE_SOCIAL_CONTENT_ID,
  DARK_CASTLE_VISUAL_PATH,
  DARK_CASTLE_VISUAL_QA_ID,
} from '@/lib/social-approved-visual-contract'

export type DarkCastleVisualQaState = 'current' | 'missing' | 'stale' | 'mismatch'

export function darkCastleVisualQaFixtureEnabled() {
  return !process.env.VERCEL_ENV && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
}

export function darkCastleVisualQaFixture(state: DarkCastleVisualQaState = 'current'): SocialContentItem {
  const postText = 'In Explore, the player can inspect a position with e4 already listed in Notation. The screen offers Try vs computer. The next capture shows Play opening with e4 still in Notation and a Start game prompt. After Black plays e5, Move guidance names the reply and Notation records it beside the board. The three public captures show why keeping the prior move visible matters to the learning experience. They do not prove a measured learning outcome. This review candidate stays inside the public pilot boundary and is tied to two approved source identities, three cleared artifacts, and the current privacy and rights receipts.'
  const item = {
    id: DARK_CASTLE_VISUAL_QA_ID,
    status: 'draft',
    platform: 'youtube',
    post_text: postText,
    cta_text: null,
    cta_url: null,
    hashtags: [],
    image_prompt: 'Use the real gameplay state as the visual anchor, then follow the player decision, product response, and traceable learning value. Use one artifact-specific evidence path rather than a generic repeated card layout.',
    voiceover_text: postText,
    target_platforms: ['youtube'],
    youtube_title: 'Dark Castle Chess: what the artifact makes visible',
    youtube_description: 'Explore shows e4 in Notation and offers Try vs computer. Play opens with e4 still listed. After Black plays e5, Move guidance and Notation show the reply beside the board.\n\nThese public pilot captures support a product observation about keeping the prior move visible. They do not show a measured learning outcome. Corrected copy and visual remain pending review.',
    image_url: state === 'missing' ? null : DARK_CASTLE_VISUAL_PATH,
    framework_visual_type: null,
    content_format: 'single_image',
    updated_at: DARK_CASTLE_CORRECTION_CREATED_AT,
    reviewed_by: null,
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
        source_copy_approved_at: DARK_CASTLE_COPY_APPROVED_AT,
        copy_approval_state: 'pending_human_qa',
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

export function darkCastleProductionRecoveryQaFixture(): SocialContentItem {
  const fixture = darkCastleVisualQaFixture('missing')
  const item = {
    ...fixture,
    id: DARK_CASTLE_SOCIAL_CONTENT_ID,
    status: 'approved',
    post_text: 'Saved production copy is represented by a privacy-safe placeholder in this local review.',
    voiceover_text: 'Saved production copy is represented by a privacy-safe placeholder in this local review.',
    rag_context: {
      ...fixture.rag_context,
      qa_fixture: {
        id: DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE,
        kind: 'production_record_recovery_preview',
        read_only: true,
        target_record_id: DARK_CASTLE_SOCIAL_CONTENT_ID,
        reason: 'Read-only local projection of the production missing-contract state. No shared record or provider is changed.',
      },
      deterministic_visual_review_approval: undefined,
    },
  } as SocialContentItem
  item.deterministic_visual_render = projectDeterministicVisualRender({
    item,
    copyVersion: socialCopyVersion(item),
    storageAvailable: true,
    releaseLocked: false,
  })
  return item
}
