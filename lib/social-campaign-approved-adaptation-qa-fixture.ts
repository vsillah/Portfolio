import jevSource from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev.json'
import darkCastleSource from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/dark_castle_chess.json'
import { buildSocialVideoAdaptationPacket, evaluateSocialVideoAdaptation, type SocialVideoAdaptationInput } from '@/lib/social-video-adaptation'
import { SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE } from '@/lib/social-campaign-package-qa-fixture'
import { buildCampaignStoryboardReview, type CampaignStoryboardReviewConfig } from '@/lib/social-campaign-storyboard-review'

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
  storyboard: CampaignStoryboardReviewConfig
}) {
  const readiness = evaluateSocialVideoAdaptation(input)
  const packet = readiness.ready ? buildSocialVideoAdaptationPacket(input) : null
  const { storyboard, ...publicBindings } = bindings
  return {
    ...publicBindings,
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
    storyboard_review: buildCampaignStoryboardReview(input, storyboard),
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
    storyboard: {
      campaign_identity: 'jev',
      product_label: 'Jev',
      calendar_item_id: 'bb1d68b7-cef7-44a0-b907-5e6431167a0f',
      social_content_id: '939b01e3-d1af-42c8-805e-0379f09efd60',
      current_content_version: 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2',
      evaluated_at: '2026-10-19T20:30:00.000Z',
      title: 'AI Scored It. Who Makes the Call?',
      teaser: 'WHEN SHOULD AI STOP?',
      outlier_gate: {
        status: 'passed',
        detail: 'Three fresh, attributable Jev topic descriptions passed the existing outlier gate; the evidence remains comparison-only and supplies no composition authority.',
        receipt_ids: ['source:jev:outlier-packet-20261017'],
        observed_at: '2026-10-17T12:00:00.000Z',
        fresh_until: '2026-10-24T12:00:00.000Z',
      },
      description_gate: {
        status: 'blocked',
        detail: 'The description evidence is ready on the current Social Content record, but this repository projection has no exact receipt that binds it to the older adaptation input.',
        receipt_ids: ['source:jev:outlier-packet-20261017'],
        observed_at: '2026-10-17T12:00:00.000Z',
        fresh_until: '2026-10-24T12:00:00.000Z',
      },
      thumbnail_gate: {
        status: 'blocked',
        detail: 'The new provider-free 16:9 candidate is rendered for review, but its exact output hash has not passed topic-specific thumbnail evaluation.',
        receipt_ids: ['receipt:social-campaign-storyboard-assets:20261019:v1', 'thumbnail:jev:youtube-shorts:20261018:v5'],
        observed_at: '2026-10-19T20:30:00.000Z',
        fresh_until: null,
      },
      script_gate: {
        status: 'blocked',
        detail: 'The source script passed its original quality review, but the current content version and spoken CTA require an exact-input re-review.',
        receipt_ids: ['script-quality:jev:artifact-video-v1-20261014'],
        observed_at: '2026-10-14T09:00:12.552926Z',
        fresh_until: '2026-10-21T23:59:59.000Z',
      },
      conclusion: 'A model score becomes useful when the surrounding system makes authority, exceptions, and evidence visible.',
      spoken_cta: 'Subscribe to AmaduTown for practical ways to decide where AI should stop and people should step in.',
      recovery_href: '/admin/social-content?workflow=evidence&campaign=jev',
      value_summary: 'A source-bound storyboard turns the Jev field guide into a paced decision story: score, policy, human ownership, and a retained record. The provider-free thumbnail keeps the product proof dominant and the customer promise readable in one second.',
    },
  })
  const darkCastle = projectedAdaptation(darkCastleSource as SocialVideoAdaptationInput, {
    product_label: 'Dark Castle Chess',
    calendar_item_id: '4070755c-7c46-4c3e-ac9b-94d35921556e',
    social_content_id: '21c492c2-9279-4e08-afc9-49207935a681',
    current_content_version: 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e',
    binding_status: 'source_ready_capture_pending',
    binding_note: 'The Social Content item is bound to this exact approved adaptation input version. Product claims remain limited to the three public gameplay captures and the passed source, privacy, rights, framework, challenger, and script-quality receipts.',
    timing_audio_note: 'This source adaptation provides approved scene order and shot references, but this review projection has no current scene-timecode or audio-cue sheet. Keep timing and music/ducking unscored until an exact-input cue receipt is available.',
    storyboard: {
      campaign_identity: 'dark-castle-chess',
      product_label: 'Dark Castle Chess',
      calendar_item_id: '4070755c-7c46-4c3e-ac9b-94d35921556e',
      social_content_id: '21c492c2-9279-4e08-afc9-49207935a681',
      current_content_version: 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e',
      evaluated_at: '2026-10-19T20:30:00.000Z',
      title: 'I Rebuilt the Chess Lesson Around the Decision',
      teaser: 'REMEMBER THE WHY',
      outlier_gate: {
        status: 'passed',
        detail: 'The current chess decision-learning cohort passed the numerical topic-specific outlier rule. Public examples remain zero-weight taste guidance for this provider-free composition.',
        receipt_ids: ['decision:thumbnail:dark-castle:20261018:v5', 'cohort:youtube:chess-decision-learning:20261018:v1'],
        observed_at: '2026-10-18T00:00:00.000Z',
        fresh_until: '2026-11-01T00:00:00.000Z',
      },
      description_gate: {
        status: 'blocked',
        detail: 'No exact current outlier-description receipt is bound to this Social Content item in the repository projection.',
        receipt_ids: [],
        observed_at: null,
        fresh_until: null,
      },
      thumbnail_gate: {
        status: 'blocked',
        detail: 'The new provider-free 16:9 candidate is rendered for review, but its exact output hash has not passed topic-specific thumbnail evaluation.',
        receipt_ids: ['receipt:social-campaign-storyboard-assets:20261019:v1', 'decision:thumbnail:dark-castle:20261018:v5'],
        observed_at: '2026-10-19T20:30:00.000Z',
        fresh_until: null,
      },
      script_gate: {
        status: 'blocked',
        detail: 'The source script is current, but the storyboard adds a spoken channel CTA that still needs exact-input script review.',
        receipt_ids: ['script-quality:dark-castle-chess:artifact-video-v1-20261014'],
        observed_at: '2026-10-14T09:00:12.552926Z',
        fresh_until: '2026-10-21T23:59:59.000Z',
      },
      conclusion: 'Completion says the move happened. Decision evidence gives the learner a pattern they can recognize again.',
      spoken_cta: 'Subscribe to AmaduTown for more behind-the-build lessons from products designed to make judgment visible.',
      recovery_href: '/admin/social-content?workflow=evidence&campaign=dark-castle-chess',
      value_summary: 'A source-bound storyboard follows one chess position through exploration, transfer, response, and reflection. The provider-free thumbnail keeps the owned board as the dominant focal point and preserves a short, distinct learning promise.',
    },
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
    human_qa: { status: 'pending_human_qa', screenshots: [], mp4: null },
  }
}
