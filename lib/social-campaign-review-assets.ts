export const SOCIAL_CAMPAIGN_REVIEW_IDS = {
  jevLinkedIn: '80618d32-7046-4abc-b2b7-8adb5526bb2e',
  jevYouTube: '939b01e3-d1af-42c8-805e-0379f09efd60',
  darkCastleLinkedIn: '9817a689-0565-48ed-8c97-c2db40c1ec45',
  darkCastleYouTube: 'c12378f2-36de-4bf7-8c5d-0ce754e727eb',
  auditLinkedIn: '0085c317-2902-42e6-81cc-c9dc8d23028f',
  auditYouTube: '3dad4cca-72b7-4705-8fb6-273bf7500ce6',
} as const

export type ReviewSource = {
  label: string
  href: string
  receipt: string
  supports: string
  limitation: string
}

export type LinkedInReviewPacket = {
  kind: 'linkedin_visual'
  channel: 'linkedin'
  socialContentId: string
  calendarItemId: string
  campaign: string
  practicalValue: string
  visual: {
    publicPath: string
    alt: string
    headline: string
    proofLine: string
    sha256: string
  }
  sources: ReviewSource[]
  externalGates: 'closed'
}

export type StoryboardBeat = {
  time: string
  beat: string
  proof: string
}

export type YouTubeReviewPacket = {
  kind: 'youtube_packaging'
  channel: 'youtube'
  socialContentId: string
  calendarItemId: string
  campaign: string
  status: 'reused_approved_pair' | 'blocked_missing_description_evidence'
  title: string
  thumbnailTeaser: string
  thumbnailConcept: string
  thumbnailPath?: string
  thumbnailReceipt?: string
  openingHook: string
  descriptionEvidence: {
    state: 'ready' | 'unscored'
    qualified: number
    required: number
    requirement: string
    attribution: ReviewSource[]
  }
  storyboard: StoryboardBeat[]
  productProof: ReviewSource[]
  conclusion: string
  spokenCta: string
  externalGates: 'closed'
}

export type SocialCampaignReviewPacket = LinkedInReviewPacket | YouTubeReviewPacket

const externalGateNote = 'No provider call, render, upload, platform draft, schedule, publication, external send, credential change, migration, or production write is enabled.'

export const SOCIAL_CAMPAIGN_REVIEW_PACKETS: Record<string, SocialCampaignReviewPacket> = {
  [SOCIAL_CAMPAIGN_REVIEW_IDS.jevLinkedIn]: {
    kind: 'linkedin_visual', channel: 'linkedin', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.jevLinkedIn,
    calendarItemId: '13d9252f-dbd1-426a-8e2e-f00dd62c2d09', campaign: 'Jev: The Model Won After the Harness Changed',
    practicalValue: 'Turns an abstract agent-governance lesson into a visible operating model: typed choices, policy thresholds, human ownership, and a retained receipt.',
    visual: {
      publicPath: '/review-assets/social-content/campaign-review/jev-linkedin-decision-system.png',
      alt: 'Jev LinkedIn visual with the operator field guide and a model, policy, human, receipt ownership chain.',
      headline: 'The model made the choice. The system owned the outcome.',
      proofLine: 'Typed probability -> policy boundary -> human owner -> receipt',
      sha256: 'sha256:5927f3b90b7895145464fb3c95d3c0d962214c2257379766bc892e43aa7bb141',
    },
    sources: [
      { label: 'Jev operator field guide', href: '/review-assets/social-content/source-proof/jev-operator-field-guide.png', receipt: 'sha256:7e123f1c11a156e86b36e0d2306ad1f42d97d3c63dac335588e804f6bc74f8e9', supports: 'Decision-only AI, policy bands, human ownership, and receipt structure.', limitation: 'Illustrative thresholds; live-provider reliability remains unproven.' },
      { label: 'Calendar review receipt', href: '#social-asset-packet-gate', receipt: '13d9252f-dbd1-426a-8e2e-f00dd62c2d09', supports: 'Review-only campaign binding and closed side-effect gates.', limitation: externalGateNote },
    ],
    externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn]: {
    kind: 'linkedin_visual', channel: 'linkedin', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn,
    calendarItemId: '433f1ee0-6764-4b95-8745-8418e6498446', campaign: 'Dark Castle Chess: Remember the Decision',
    practicalValue: 'Shows why a learning product must preserve the position, choice, consequence, and lesson instead of recording completion alone.',
    visual: {
      publicPath: '/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png',
      alt: 'Dark Castle Chess LinkedIn visual showing a real gameplay board and the position, choice, consequence, lesson learning path.',
      headline: 'A move can be right by accident. Learning needs the why.',
      proofLine: 'Position -> choice -> consequence -> retained lesson',
      sha256: 'sha256:f31f4dd07484c769c7dfd3b43c95269540facd387ca82a02fea2a15ff19c8334',
    },
    sources: [
      { label: 'Dark Castle gameplay proof', href: '/review-assets/social-content/dark-castle-customer-facing-poster.png', receipt: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78', supports: 'Owned gameplay board, decision guidance, and coaching state.', limitation: 'Product-state proof only; it does not claim learning outcomes.' },
      { label: 'Calendar review receipt', href: '#social-asset-packet-gate', receipt: '433f1ee0-6764-4b95-8745-8418e6498446', supports: 'Review-only campaign binding and closed side-effect gates.', limitation: externalGateNote },
    ],
    externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.auditLinkedIn]: {
    kind: 'linkedin_visual', channel: 'linkedin', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.auditLinkedIn,
    calendarItemId: '062a2f97-d5b8-4c3b-bbfe-5f4949b671f2', campaign: 'AI Audit Calculator: The Hidden Operating Bill',
    practicalValue: 'Moves the AI-cost conversation from license inventory to the workflow, owner, review burden, and evidence behind the investment.',
    visual: {
      publicPath: '/review-assets/social-content/campaign-review/ai-audit-linkedin-hidden-bill.png',
      alt: 'AI Audit Calculator LinkedIn visual with the real result screen and four operating-cost questions.',
      headline: 'The invoice shows the license. The workflow shows the real bill.',
      proofLine: 'Workflow | owner | review hours | evidence',
      sha256: 'sha256:73263abe49dc749383050e91cf10cab3266451eba866bf0b661d8bb88aa9efd5',
    },
    sources: [
      { label: 'AI Audit Calculator product screen', href: '/audit_calculator_img.png', receipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97', supports: 'Owned calculator result UI, captured inputs, scores, and action guidance.', limitation: 'Product UI proof only; it does not establish a customer outcome or ROI benchmark.' },
      { label: 'Calendar review receipt', href: '#social-asset-packet-gate', receipt: '062a2f97-d5b8-4c3b-bbfe-5f4949b671f2', supports: 'Review-only campaign binding and closed side-effect gates.', limitation: externalGateNote },
    ],
    externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube]: {
    kind: 'youtube_packaging', channel: 'youtube', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube,
    calendarItemId: 'bb1d68b7-cef7-44a0-b907-5e6431167a0f', campaign: 'Jev: approved complementary title-thumbnail pair', status: 'reused_approved_pair',
    title: 'AI Scored It. Who Makes the Call?', thumbnailTeaser: 'WHEN SHOULD AI STOP?',
    thumbnailConcept: 'Approved 9:16 AmaduTown composition with Vambah, one Jev product-proof object, and a short contrasting question.',
    thumbnailPath: '/review-assets/social-content/jev-youtube-short-thumbnail-v5.png',
    thumbnailReceipt: 'thumbnail:jev:youtube-shorts:20261018:v5',
    openingHook: 'A probability can inform a decision. It should not quietly become permission.',
    descriptionEvidence: {
      state: 'ready', qualified: 3, required: 3,
      requirement: 'The existing version-bound Jev description evidence gate is ready. This projection reuses the approved package and does not regenerate it.',
      attribution: [{ label: 'Approved title-thumbnail receipt', href: '/review-assets/social-content/jev-youtube-short-thumbnail-v5.png', receipt: 'thumbnail:jev:youtube-shorts:20261018:v5', supports: 'Exact complementary pair, first-party composition, and visible Unscored performance boundary.', limitation: 'Editorial hypothesis only; no comparative performance claim.' }],
    },
    storyboard: [
      { time: '0:00-0:08', beat: 'A confident score appears.', proof: 'Jev operator field guide: worked return.' },
      { time: '0:08-0:28', beat: 'The policy layer routes, reviews, or refuses.', proof: 'Approved policy-band visual.' },
      { time: '0:28-0:50', beat: 'Human ownership and receipts close the loop.', proof: 'System-ownership chain and source receipts.' },
      { time: '0:50-close', beat: 'Name the boundary and invite inspection.', proof: 'Approved conclusion and spoken CTA.' },
    ],
    productProof: [{ label: 'Jev operator field guide', href: '/review-assets/social-content/source-proof/jev-operator-field-guide.png', receipt: 'sha256:7e123f1c11a156e86b36e0d2306ad1f42d97d3c63dac335588e804f6bc74f8e9', supports: 'Visible decision system.', limitation: 'Illustrative thresholds.' }],
    conclusion: 'A model score becomes useful when the surrounding system makes authority, exceptions, and evidence visible.',
    spokenCta: 'Subscribe to AmaduTown for practical ways to govern AI decisions before they become irreversible actions.', externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube]: {
    kind: 'youtube_packaging', channel: 'youtube', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube,
    calendarItemId: '7b1b202c-eb24-4724-bc8e-313b07546884', campaign: 'Dark Castle Chess: Remember the Decision', status: 'blocked_missing_description_evidence',
    title: 'I Rebuilt the Chess Lesson Around the Decision', thumbnailTeaser: 'REMEMBER THE WHY',
    thumbnailConcept: 'Real gameplay board fills the frame. One highlighted move connects to a compact decision-path card; no generic chess stock art.',
    thumbnailPath: '/review-assets/social-content/campaign-review/dark-castle-youtube-remember-the-why.png',
    thumbnailReceipt: 'sha256:4cc752dc6e18f08611aaab68984ca4c353d02b4fb6f8e7bc4781745176659a31',
    openingHook: 'A player can land on the right square by accident. The board position alone cannot tell you whether they learned.',
    descriptionEvidence: { state: 'unscored', qualified: 0, required: 3, requirement: 'Capture three fresh, attributable, same-topic public YouTube descriptions that pass the existing outlier benchmark. Internal packet summaries and unrelated chess videos do not qualify.', attribution: [] },
    storyboard: [
      { time: '0:00-0:15', beat: 'Show the same correct move reached through guessing and understanding.', proof: 'Owned gameplay position.' },
      { time: '0:15-0:45', beat: 'Follow position, choice, and consequence.', proof: 'Decision guidance and notation.' },
      { time: '0:45-1:15', beat: 'Carry the lesson into the learning timeline.', proof: 'Retained coaching and review state.' },
      { time: '1:15-close', beat: 'Separate completion from learning evidence.', proof: 'Product-proof recap and spoken CTA.' },
    ],
    productProof: [{ label: 'Dark Castle gameplay proof', href: '/review-assets/social-content/dark-castle-customer-facing-poster.png', receipt: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78', supports: 'Real board, guidance, notation, and coaching state.', limitation: 'No claim of measured learning improvement.' }],
    conclusion: 'Completion says the move happened. Decision evidence gives the learner a pattern they can recognize again.',
    spokenCta: 'Subscribe to AmaduTown for more behind-the-build lessons from products designed to make judgment visible.', externalGates: 'closed',
  },
  [SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube]: {
    kind: 'youtube_packaging', channel: 'youtube', socialContentId: SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube,
    calendarItemId: 'c363b54c-1369-4663-b3b1-2a0dc58c0b46', campaign: 'AI Audit Calculator: The Hidden Operating Bill', status: 'blocked_missing_description_evidence',
    title: 'The AI Cost That Never Appears on the Invoice', thumbnailTeaser: 'WHO OWNS THE CLEANUP?',
    thumbnailConcept: 'Real calculator result screen beside a short chain of review, cleanup, escalation, and evidence. The thumbnail question adds tension without repeating the title.',
    thumbnailPath: '/review-assets/social-content/campaign-review/ai-audit-youtube-who-owns-the-cleanup.png',
    thumbnailReceipt: 'sha256:b9e82b81d04b4010d8574c08cf14b68691b1c3c89aa010ed4541e7f3a3229926',
    openingHook: 'The subscription price is easy to find. The expensive part is the work that appears after the tool answers.',
    descriptionEvidence: { state: 'unscored', qualified: 0, required: 3, requirement: 'Capture three fresh, attributable, same-topic public YouTube descriptions that pass the existing outlier benchmark. Pricing pages, internal summaries, and general AI-cost commentary do not qualify.', attribution: [] },
    storyboard: [
      { time: '0:00-0:15', beat: 'Put the invoice beside the hidden work.', proof: 'Review, cleanup, escalation, and duplicate-tool map.' },
      { time: '0:15-0:50', beat: 'Change the unit from licenses to accountable capacity.', proof: 'Owned calculator capture categories.' },
      { time: '0:50-1:20', beat: 'Walk one tool through workflow, owner, hours, and evidence.', proof: 'Calculator score and action guidance.' },
      { time: '1:20-close', beat: 'Name what the audit can and cannot prove.', proof: 'Product-proof boundary and spoken CTA.' },
    ],
    productProof: [{ label: 'AI Audit Calculator product screen', href: '/audit_calculator_img.png', receipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97', supports: 'Real result UI, scored dimensions, and action guidance.', limitation: 'No customer ROI or performance claim.' }],
    conclusion: 'A tool earns its place when the team can trace the work it removed, the decision it improved, and the evidence it left behind.',
    spokenCta: 'Use the AI Audit Calculator to find the work hiding behind your AI bill, then subscribe to AmaduTown for practical systems for governing AI investments.', externalGates: 'closed',
  },
}

export function getSocialCampaignReviewPacket(id: string | null | undefined): SocialCampaignReviewPacket | null {
  return id ? SOCIAL_CAMPAIGN_REVIEW_PACKETS[id] ?? null : null
}
import type { SocialContentItem } from '@/lib/social-content'

export const SOCIAL_CAMPAIGN_REVIEW_FIXTURE = 'social_campaign_review_assets_v1'


export function socialCampaignReviewQaFixture(id: string): SocialContentItem {
  const packet = getSocialCampaignReviewPacket(id)
  if (!packet) throw new Error(`Unknown social campaign review fixture: ${id}`)

  const isYouTube = packet.kind === 'youtube_packaging'
  const postText = isYouTube
    ? [packet.openingHook, ...packet.storyboard.map(({ beat }) => beat), packet.conclusion, packet.spokenCta].join('\n\n')
    : [packet.visual.headline, packet.practicalValue, packet.visual.proofLine].join('\n\n')

  return {
    id,
    meeting_record_id: null,
    platform: packet.channel,
    status: 'draft',
    post_text: postText,
    cta_text: isYouTube ? packet.spokenCta : 'Review the decision system behind the result.',
    cta_url: null,
    hashtags: [],
    image_url: packet.kind === 'linkedin_visual' ? packet.visual.publicPath : packet.thumbnailPath ?? null,
    image_prompt: isYouTube ? packet.thumbnailConcept : packet.visual.alt,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: isYouTube ? postText : null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'repository_bound_social_campaign_review',
      campaign_name: packet.campaign,
      calendar_item_id: packet.calendarItemId,
      approval_boundary: externalGateNote,
      side_effects: {
        production_read: false,
        production_write: false,
        provider_generation: false,
        rendering: false,
        upload: false,
        platform_draft: false,
        schedule: false,
        publish: false,
        external_send: false,
      },
      qa_fixture: {
        kind: 'social_campaign_review_assets',
        read_only: true,
        reason: 'Repository-bound review projection. No production record is read or changed.',
        next_action: 'Review the visual, evidence, and closed gates. Return to the captain handoff for any later integration decision.',
      },
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: [packet.channel],
    video_generation_method: 'none',
    youtube_title: isYouTube ? packet.title : null,
    youtube_description: null,
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: '2026-10-18T00:00:00.000Z',
    updated_at: '2026-10-18T00:00:00.000Z',
    publishes: [],
  }
}
