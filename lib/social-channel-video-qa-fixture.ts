import darkCastlePacket from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/dark_castle_chess.json'
import darkCastleReceipt from '@/artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-provider-none-review.receipt.json'
import jevPacket from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev.json'
import jevReceipt from '@/artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.receipt.json'

const QA_FIXTURES = {
  'f966123f-05eb-48ec-a7c2-970afce642ef': {
    packet: jevPacket,
    receipt: jevReceipt,
    videoPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.mp4',
    posterPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-customer-facing-poster.png',
    posterSha256: '437b739edad19e95427ff7c8e1d660a34363a531ac64c879c5e6d038d0306fa0',
  },
  '21c492c2-9279-4e08-afc9-49207935a681': {
    packet: darkCastlePacket,
    receipt: darkCastleReceipt,
    videoPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-provider-none-review.mp4',
    posterPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-customer-facing-poster.png',
    posterSha256: 'e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78',
  },
} as const

export type ChannelNativeVideoQaFixtureId = keyof typeof QA_FIXTURES

export function isChannelNativeVideoQaFixtureId(id: string): id is ChannelNativeVideoQaFixtureId {
  return Object.prototype.hasOwnProperty.call(QA_FIXTURES, id)
}

export function channelNativeVideoQaFixture(id: ChannelNativeVideoQaFixtureId) {
  const fixture = QA_FIXTURES[id]
  const packet = fixture.packet
  const receipt = fixture.receipt
  const shorts = packet.draft.format_adaptations.find((adaptation) => adaptation.target === 'youtube_shorts')
  if (!shorts) throw new Error(`Channel-native video QA packet ${id} is missing its YouTube Shorts adaptation.`)

  const traceabilitySummary = `Every customer-facing claim in this adaptation remains bound to ${packet.identity.source_ids.length} approved source identities, ${packet.evidence_assets.length} cleared artifact${packet.evidence_assets.length === 1 ? '' : 's'}, and the current privacy, rights, challenger, and script-quality receipts.`

  return {
    id,
    meeting_record_id: null,
    platform: 'youtube' as const,
    status: 'draft' as const,
    post_text: shorts.full_spoken_script,
    cta_text: null,
    cta_url: null,
    hashtags: [],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: shorts.full_spoken_script,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'human_qa_approved_artifact_video_packet',
      source_type: 'version_bound_provider_none_mp4',
      campaign_id: packet.identity.campaign_id,
      work_item_id: packet.identity.channel_packet_ids.find((value) => value.startsWith('work-item:'))?.slice('work-item:'.length) ?? null,
      product_id: packet.identity.product_id,
      topic_id: packet.identity.topic_id,
      source_ids: packet.identity.source_ids,
      channel_packet_ids: packet.identity.channel_packet_ids,
      artifact_video_adaptation_id: packet.adaptation_id,
      input_version: packet.input_version,
      claims: packet.claims,
      evidence_assets: packet.evidence_assets,
      receipts: packet.receipts,
      approved_title_options: packet.draft.title_options,
      approved_description: {
        practical_value: packet.draft.practical_value,
        why_artifact_matters: packet.draft.why_artifact_matters,
      },
      approved_thumbnail_brief: packet.draft.thumbnail_brief,
      traceability_summary: traceabilitySummary,
      workflow_state: 'human_review_required',
      publish_gate: 'draft_only',
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      side_effects: receipt.side_effects,
      approved_video_packet: {
        status: 'human_qa_approved',
        target: receipt.target,
        provider: receipt.provider,
        video_path: fixture.videoPath,
        poster_path: fixture.posterPath,
        packet_path: `artifacts/human-qa/artifact-video-review-2026-10-14/inputs/${packet.identity.product_id === 'jev' ? 'jev' : 'dark_castle_chess'}.json`,
        receipt_path: fixture.videoPath.replace(/\.mp4$/, '.receipt.json'),
        video_sha256: receipt.output.sha256,
        poster_sha256: fixture.posterSha256,
        duration_seconds: Number(receipt.output.probe.format.duration),
        codec: receipt.output.probe.streams[0]?.codec_name,
        width: receipt.output.probe.streams[0]?.width,
        height: receipt.output.probe.streams[0]?.height,
        fps: receipt.output.probe.streams[0]?.r_frame_rate,
        repository_commit: '6fca0c17d16dfdf34cdd584d020d73f344bcab8e',
      },
      qa_fixture: {
        kind: 'channel_native_video_review',
        read_only: true,
        reason: 'Production-equivalent, repository-bound video review fixture.',
        next_action: 'Use the canonical Decision Queue for any internal decision. Provider, upload, platform-draft, schedule, publish, credential, privacy, and external-send gates remain closed.',
      },
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: ['youtube' as const],
    video_generation_method: 'none' as const,
    youtube_title: null,
    youtube_description: null,
    content_format: 'single_image' as const,
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: packet.generated_at,
    updated_at: packet.generated_at,
    publishes: [],
  }
}
