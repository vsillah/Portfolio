import { DETERMINISTIC_VISUAL_BINDING_QA_ID, type SocialContentItem } from '@/lib/social-content'
import {
  buildDeterministicVisualAssetPatch,
  buildDeterministicVisualRecipePatch,
  DETERMINISTIC_VISUAL_RENDERER_VERSION,
  deterministicVisualCandidateHash,
  deterministicVisualRenderInputHash,
  projectDeterministicVisualRender,
  readDeterministicVisualSpec,
} from '@/lib/social-deterministic-visual'
import type { DeterministicVisualRecipeSelection } from '@/lib/social-deterministic-visual-recipe'
import { practitionerContentQaFixture } from '@/lib/social-practitioner-content-qa-fixture'
import { socialCopyVersion } from '@/lib/social-copy-revision'

export const DETERMINISTIC_VISUAL_TARGET_RECORD_ID = '52a4baec-ad2d-415d-a6fa-4436dbfd6360'
export const DETERMINISTIC_VISUAL_QA_ASSET_URL = `/qa/social-content/deterministic-visual-binding.png?renderer=${DETERMINISTIC_VISUAL_RENDERER_VERSION}`
export const DETERMINISTIC_VISUAL_QA_SOURCE_PACKET_ID = '56d34256-d196-42c6-973d-8d9af3aeff37'

export type DeterministicVisualQaState = 'ready' | 'current' | 'stale' | 'missing_candidate' | 'architecture_mismatch' | 'storage_unavailable' | 'lineage_missing'

export function deterministicVisualBindingQaFixtureEnabled() {
  if (process.env.VERCEL_ENV === 'production') return false
  return process.env.SOCIAL_DETERMINISTIC_VISUAL_QA_FIXTURE === 'true'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test'
}

export function isDeterministicVisualBindingQaFixtureId(id: string | null | undefined) {
  return deterministicVisualBindingQaFixtureEnabled() && id === DETERMINISTIC_VISUAL_BINDING_QA_ID
}

export function parseDeterministicVisualQaState(value: string | null | undefined): DeterministicVisualQaState {
  return value === 'current'
    || value === 'stale'
    || value === 'missing_candidate'
    || value === 'architecture_mismatch'
    || value === 'storage_unavailable'
    || value === 'lineage_missing'
    ? value
    : 'ready'
}

export function deterministicVisualBindingQaFixture(
  state: DeterministicVisualQaState = 'ready',
  recipe?: DeterministicVisualRecipeSelection,
): SocialContentItem {
  const base = practitionerContentQaFixture('ready')
  const baseRag = structuredClone(base.rag_context ?? {}) as Record<string, unknown>
  const practitionerQuality = baseRag.practitioner_content_quality as Record<string, unknown>
  const evidencePacket = practitionerQuality.evidence_packet as Record<string, unknown>
  if (Array.isArray(evidencePacket.source_provenance)) {
    evidencePacket.source_provenance = evidencePacket.source_provenance.map((source) => ({
      ...(source as Record<string, unknown>),
      source_id: DETERMINISTIC_VISUAL_QA_SOURCE_PACKET_ID,
      source_type: 'approved_social_content_research_packet',
      label: 'Approved staging research packet',
    }))
  }
  const item: SocialContentItem = {
    ...base,
    id: DETERMINISTIC_VISUAL_BINDING_QA_ID,
    status: 'approved',
    post_text: [
      'Every Friday, a community operations lead reconciled the same request across three work queues.',
      'The rules had to stay stable while coverage changed. One reviewed queue removed duplicate handling and kept the final decision with the person closest to the work.',
      'The immediate process improvement is visible. The longer-term outcome is still being measured.',
    ].join('\n\n'),
    cta_text: 'Where does repeated review still add burden to your workflow?',
    image_url: null,
    image_prompt: null,
    reviewed_by: 'synthetic-reviewer',
    updated_at: '2026-10-10T20:00:00.000Z',
    rag_context: {
      ...baseRag,
      source: 'social_content_calendar_authorization',
      calendar_item_id: '00000000-0000-4000-8000-000000000052',
      campaign_id: 'synthetic-deterministic-visual-review',
      campaign_name: 'Deterministic visual binding QA',
      publish_gate: 'draft_only',
      external_execution_enabled: false,
      approval_boundary: 'Synthetic production-equivalent visual review only. No provider, shared-data, platform draft, upload-to-provider, schedule, publication, or external send is available.',
      qa_fixture: {
        id: DETERMINISTIC_VISUAL_BINDING_QA_ID,
        kind: 'deterministic_visual_binding_preview',
        interactive: true,
        read_only: false,
        target_record_id: DETERMINISTIC_VISUAL_TARGET_RECORD_ID,
        reason: 'Synthetic production-equivalent fixture. The deterministic render is simulated without shared storage or database writes.',
        next_action: 'Review the render state and provider-none receipt. Use the target record only after captain-controlled deployment verification.',
      },
    },
  }

  if (recipe) {
    const patch = buildDeterministicVisualRecipePatch({ item, selection: recipe })
    item.framework_visual_type = patch.framework_visual_type
    item.rag_context = {
      ...structuredClone(item.rag_context ?? {}) as Record<string, unknown>,
      ...patch.rag_context,
    }
  }

  if (state === 'missing_candidate') {
    const rag = structuredClone(item.rag_context ?? {}) as Record<string, any>
    rag.practitioner_content_quality.deterministic_visual.candidate = {
      candidate_id: '',
      status: 'draft',
      renderer: 'html_svg',
      artifact_url: null,
    }
    item.rag_context = rag
  }

  if (state === 'architecture_mismatch') {
    const rag = structuredClone(item.rag_context ?? {}) as Record<string, any>
    rag.practitioner_content_quality.deterministic_visual.architecture.connectors = []
    item.rag_context = rag
  }

  const copyVersion = socialCopyVersion(item)
  const spec = readDeterministicVisualSpec(item.rag_context)
  if (spec && (state === 'current' || state === 'stale' || state === 'lineage_missing')) {
    const candidateHash = deterministicVisualCandidateHash(spec)
    const brandAssetHash = 'f'.repeat(64)
    const renderInputHash = deterministicVisualRenderInputHash({ copyVersion, candidateHash, visualType: item.framework_visual_type!, brandAssetHash })
    const patch = buildDeterministicVisualAssetPatch({
      item,
      copyVersion: state === 'stale' ? '0'.repeat(64) : copyVersion,
      candidateHash,
      renderInputHash,
      brandAssetHash,
      assetSha256: 'a'.repeat(64),
      assetUrl: DETERMINISTIC_VISUAL_QA_ASSET_URL,
      storagePath: `fixtures/${DETERMINISTIC_VISUAL_BINDING_QA_ID}.png`,
      actor: 'synthetic-reviewer',
      renderedAt: '2026-10-10T20:05:00.000Z',
    })
    Object.assign(item, patch)
  }

  if (state === 'lineage_missing') {
    const rag = structuredClone(item.rag_context ?? {}) as Record<string, any>
    rag.practitioner_content_quality.deterministic_visual.source_bindings = {}
    item.rag_context = rag
  }

  item.deterministic_visual_render = projectDeterministicVisualRender({
    item,
    copyVersion,
    storageAvailable: state !== 'storage_unavailable',
    releaseLocked: false,
  })
  return item
}

export function completeDeterministicVisualBindingQaFixture(recipe?: DeterministicVisualRecipeSelection): SocialContentItem {
  return deterministicVisualBindingQaFixture('current', recipe)
}
