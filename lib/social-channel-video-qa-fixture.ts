import darkCastlePacket from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/dark_castle_chess.json'
import darkCastleReceipt from '@/artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-provider-none-review.receipt.json'
import jevPacket from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev.json'
import jevReceipt from '@/artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.receipt.json'
import jevSocialVideoReviewPackage from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
import type { ArtifactEvidenceCategory, ArtifactEvidenceManifest } from '@/lib/artifact-evidence-manifest'

const QA_FIXTURES = {
  'f966123f-05eb-48ec-a7c2-970afce642ef': {
    packet: jevPacket,
    receipt: jevReceipt,
    videoPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.mp4',
    posterPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-customer-facing-poster.png',
    posterSha256: '7709869d1d3f6d219128d5f47d0e5c3701c39a5079c4cf9378d2f958cd124a97',
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

function artifactEvidenceManifest(input: {
  productId: string
  contentVersion: string
  inputVersion: string
  previewUrl: string
  previewAlt: string
  outputSha256: string
  musicReady: boolean
}): ArtifactEvidenceManifest {
  const manifestId = `artifact-manifest:${input.productId}:youtube-shorts:v1`
  const sourceHref = `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(`${input.productId}-artifact-video-source`)}`
  const decisionHref = `/admin/agents/coordination?proposal=${encodeURIComponent(`${input.productId}-artifact-video-review`)}`
  const privacyReceipt = `privacy:${input.productId}:public-safe-20261014`
  const rightsReceipt = `rights:${input.productId}:owned-public-assets-20261014`
  const element = (category: ArtifactEvidenceCategory, id: string, label: string, excerpt: string, options: Partial<ArtifactEvidenceManifest['elements'][number]> = {}): ArtifactEvidenceManifest['elements'][number] => ({
    id,
    category,
    label,
    input_excerpt: excerpt,
    customer_facing: true,
    review_only: false,
    redacted: false,
    source_identity: `source:${input.productId}:approved-artifact-packet`,
    source_record_type: 'portfolio_research_packet',
    authoritative_href: sourceHref,
    evidence_receipt_ids: [`source:${input.productId}:approved-composite-20261014`],
    version_hash: input.inputVersion,
    content_version: input.contentVersion,
    rights_privacy_status: 'passed',
    rights_privacy_receipt_ids: [rightsReceipt, privacyReceipt],
    transformation_step: 'Bound into the versioned channel-native review packet without provider execution.',
    ...options,
  })
  const elements = [
    element('copy_script', 'script', 'Spoken script', 'The artifact makes the evidence and decision trail visible.', { region: { x: 50, y: 50 } }),
    element('visual_field', 'visual-proof', 'Visible proof field', 'Evidence → decision → bounded next action', { region: { x: 48, y: 42 } }),
    element('product_screenshot', 'product-capture', 'Product screenshot', 'Approved product interface capture', { region: { x: 28, y: 56 } }),
    element('visual_template', 'visual-recipe', 'Visual template and recipe', 'Channel-native evidence walkthrough with restrained motion.'),
    element('presenter_avatar', 'presenter', 'Presenter/avatar', 'No generated presenter; artifact-led provider-none composition.', { customer_facing: false, review_only: true }),
    element('voice_narration', 'voice', 'Voice and narration', 'Approved narration mixed from the version-bound source track.'),
    element('music', 'music', 'Music bed', 'The Stream V2 instrumental bed.', input.musicReady ? {} : {
      rights_privacy_status: 'missing',
      rights_privacy_receipt_ids: [],
    }),
    element('thumbnail', 'thumbnail', 'Thumbnail', 'Customer-facing artifact poster.', { region: { x: 72, y: 34 } }),
    element('title', 'title', 'Title', `${input.productId}: what the artifact makes visible`, { region: { x: 48, y: 16 } }),
    element('description', 'description', 'Description', 'A practical walkthrough of the artifact, its proof, and its bounded value.'),
    element('cta', 'cta', 'Call to action', 'Inspect the receipt trail before approving the next gate.', { region: { x: 51, y: 83 } }),
    element('source_research', 'research', 'Source research', 'Approved public-safe research summary.', {
      customer_facing: false,
      review_only: true,
      redacted: true,
      input_excerpt: '[Private source withheld — approved summary only]',
      source_identity: `open-brain:memory:${input.productId}:approved-summary`,
      source_record_type: 'open_brain_approved_memory',
      authoritative_href: '/admin/agents/open-brain?view=approved',
    }),
    element('transformation', 'transform', 'Transformation recipe', 'Native source → edit timeline → privacy-safe composite → SHA-256 verification.', { customer_facing: false, review_only: true, authoritative_href: decisionHref }),
    element('final_output', 'output', 'Final MP4 output', `SHA-256 ${input.outputSha256}`, { authoritative_href: decisionHref }),
  ]
  return {
    version: 'artifact-evidence-manifest/v1',
    manifest_id: manifestId,
    manifest_hash: input.productId === 'jev'
      ? 'sha256:7e13a46b2ad2c8757c79c35b6a44e69f7d55d43c47db2c459411eefdd70c5d0e'
      : 'sha256:1c67d5f36ac30e66ca78fa075d8508197e899e3c944a4601c595ff4de70a4f7e',
    content_version: input.contentVersion,
    artifact_label: `${input.productId === 'jev' ? 'Jev' : 'Dark Castle Chess'} customer-facing video`,
    preview_url: input.previewUrl,
    preview_alt: input.previewAlt,
    final_output_hashes: [{ label: 'Final MP4', sha256: input.outputSha256 }],
    elements,
  }
}

export function channelNativeVideoQaFixture(id: ChannelNativeVideoQaFixtureId, videoPackageState: 'ready' | 'blocked' = 'ready') {
  const fixture = QA_FIXTURES[id]
  const packet = fixture.packet
  const receipt = fixture.receipt
  const shorts = packet.draft.format_adaptations.find((adaptation) => adaptation.target === 'youtube_shorts')
  if (!shorts) throw new Error(`Channel-native video QA packet ${id} is missing its YouTube Shorts adaptation.`)

  const traceabilitySummary = `Every customer-facing claim in this adaptation remains bound to ${packet.identity.source_ids.length} approved source identities, ${packet.evidence_assets.length} cleared artifact${packet.evidence_assets.length === 1 ? '' : 's'}, and the current privacy, rights, challenger, and script-quality receipts.`
  const manifest = artifactEvidenceManifest({
    productId: packet.identity.product_id,
    contentVersion: packet.generated_at,
    inputVersion: packet.input_version,
    previewUrl: `/review-assets/social-content/${fixture.posterPath.split('/').at(-1)}`,
    previewAlt: `${packet.identity.product_id === 'jev' ? 'Jev' : 'Dark Castle Chess'} customer-facing video poster with traceable evidence regions`,
    outputSha256: receipt.output.sha256,
    musicReady: videoPackageState === 'ready',
  })

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
      artifact_evidence_manifest: manifest,
      workflow_state: 'human_review_required',
      publish_gate: 'draft_only',
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      side_effects: receipt.side_effects,
      approved_video_packet: {
        status: packet.identity.product_id === 'jev' ? 'human_qa_pending' : 'human_qa_approved',
        target: receipt.target,
        provider: receipt.provider,
        video_path: fixture.videoPath,
        poster_path: fixture.posterPath,
        packet_path: `artifacts/human-qa/artifact-video-review-2026-10-14/inputs/${packet.identity.product_id === 'jev' ? 'jev' : 'dark_castle_chess'}.json`,
        receipt_path: fixture.videoPath.replace(/\.mp4$/, '.receipt.json'),
        video_sha256: receipt.output.sha256,
        poster_sha256: (receipt.output as { poster_sha256?: string }).poster_sha256 ?? fixture.posterSha256,
        render_version: receipt.version,
        motion_profile: (receipt as { composition?: { motion_profile?: string } }).composition?.motion_profile ?? null,
        duration_seconds: Number(receipt.output.probe.format.duration),
        codec: receipt.output.probe.streams[0]?.codec_name,
        width: receipt.output.probe.streams[0]?.width,
        height: receipt.output.probe.streams[0]?.height,
        fps: receipt.output.probe.streams[0]?.r_frame_rate,
        repository_commit: '6fca0c17d16dfdf34cdd584d020d73f344bcab8e',
      },
      ...(packet.identity.product_id === 'jev' ? {
        social_video_review_package: jevSocialVideoReviewPackage,
        social_video_review_source_receipt_ids: [
          'source:jev:approved-composite-20261014',
          'source:music:the-stream-v2:20261014',
        ],
        social_video_review_rights_receipt_ids: [
          'rights:jev:owned-public-assets-20261014',
          ...(videoPackageState === 'ready' ? ['rights:music:the-stream-v2:20261014'] : []),
        ],
        social_video_review_fixture_state: videoPackageState,
      } : {}),
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
