import jevSource from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev.json'
import darkCastleSource from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/dark_castle_chess.json'
import { buildSocialVideoAdaptationPacket, evaluateSocialVideoAdaptation, type SocialVideoAdaptationInput } from '@/lib/social-video-adaptation'
import { SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE } from '@/lib/social-campaign-package-qa-fixture'

const PRODUCTION_EXTERNAL_GATES = {
  provider_generation: false,
  render: false,
  upload: false,
  platform_draft: false,
  schedule: false,
  publish: false,
  external_send: false,
  credential_change: false,
  spending: false,
  migration: false,
  deployment: false,
  merge: false,
}

function projectedAdaptation(input: SocialVideoAdaptationInput, bindings: {
  product_label: string
  calendar_item_id: string
  social_content_id: string
  current_content_version: string
  binding_status: 'source_ready_capture_pending' | 'human_qa_rereview_required'
  binding_note: string
  timing_audio_note: string
}) {
  const readiness = evaluateSocialVideoAdaptation(input)
  const packet = readiness.ready ? buildSocialVideoAdaptationPacket(input) : null
  return {
    ...bindings,
    adaptation_id: input.adaptation_id,
    source_input_version: input.input_version,
    source_readiness: readiness,
    status: packet ? bindings.binding_status : 'blocked_source_receipt',
    title_options: input.draft.title_options,
    formats: input.draft.format_adaptations,
    scenes: input.draft.scenes.map((scene) => ({
      ...scene,
      shots: input.draft.shot_plan.filter((shot) => shot.scene_id === scene.scene_id),
    })),
    evidence_assets: input.evidence_assets,
    receipts: Object.values(input.receipts).map((receipt) => ({
      receipt_id: receipt?.receipt_id ?? '',
      kind: receipt?.kind ?? '',
      status: receipt?.status ?? 'missing',
      input_version: receipt?.input_version ?? '',
    })),
    render_gate: 'explicit_approval_required',
    side_effects: PRODUCTION_EXTERNAL_GATES,
  }
}

export function socialCampaignApprovedAdaptationQaProjection() {
  const jev = projectedAdaptation(jevSource as SocialVideoAdaptationInput, {
    product_label: 'Jev',
    calendar_item_id: 'bb1d68b7-cef7-44a0-b907-5e6431167a0f',
    social_content_id: '939b01e3-d1af-42c8-805e-0379f09efd60',
    current_content_version: 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2',
    binding_status: 'human_qa_rereview_required',
    binding_note: 'The current Social Content description is a different content version than this approved artifact adaptation. Keep the source storyboard visible for review, but require Human QA re-review against the current description before treating the campaign as ready.',
    timing_audio_note: 'The prior 67-second motion and approved music/ducking receipts bind to the older adaptation input shown here. They do not transfer to the current Social Content hash; re-review timing, motion, and audio against the current description before any rendering decision.',
  })
  const darkCastle = projectedAdaptation(darkCastleSource as SocialVideoAdaptationInput, {
    product_label: 'Dark Castle Chess',
    calendar_item_id: '4070755c-7c46-4c3e-ac9b-94d35921556e',
    social_content_id: '21c492c2-9279-4e08-afc9-49207935a681',
    current_content_version: 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e',
    binding_status: 'source_ready_capture_pending',
    binding_note: 'The Social Content item is bound to this exact approved adaptation input version. Product claims remain limited to the three public gameplay captures and the passed source, privacy, rights, framework, challenger, and script-quality receipts.',
    timing_audio_note: 'This source adaptation provides approved scene order and shot references, but this review projection has no current scene-timecode or audio-cue sheet. Keep timing and music/ducking unscored until an exact-input cue receipt is available.',
  })
  return {
    fixture: SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE,
    review_only: true,
    external_gates: PRODUCTION_EXTERNAL_GATES,
    adaptations: [jev, darkCastle],
    blocked_items: [
      {
        calendar_item_id: 'c12378f2-36de-4bf7-8c5d-0ce754e727eb',
        label: 'Later Dark Castle Chess item',
        status: 'blocked',
        reason: 'Only 0 fresh, attributable same-topic outlier description(s) qualified; 3 are required.',
        recovery_label: 'Refresh the outlier-description evidence',
        recovery_href: '/admin/social-content?workflow=evidence',
      },
      {
        calendar_item_id: '3dad4cca-72b7-4705-8fb6-273bf7500ce6',
        label: 'AI Audit item',
        status: 'blocked',
        reason: 'Only 0 fresh, attributable same-topic outlier description(s) qualified; 3 are required.',
        recovery_label: 'Refresh the outlier-description evidence',
        recovery_href: '/admin/social-content?workflow=evidence',
      },
      {
        calendar_item_id: '21516fc8-08a5-489c-9a69-478d3f88828f',
        label: 'Agentified short',
        status: 'blocked',
        reason: 'Source, script, title, thumbnail, and final-video readiness are missing.',
        recovery_label: 'Complete source and packaging readiness',
        recovery_href: '/admin/social-content?workflow=evidence',
      },
    ],
    human_qa: { status: 'pending_new_capture_artifacts', screenshots: [], mp4: null },
  }
}
