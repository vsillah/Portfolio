export type AgenticContentReviewSurface = 'social' | 'video' | 'content'
export type AgenticContentReviewDecision = 'approve_next_gate' | 'send_back_for_repair' | 'hold_for_human'

export type AgenticContentReviewPacket = {
  assetId: string
  priority: 'P0' | 'P1' | 'P2'
  title: string
  channel: string
  output: string
  sourceComponent: string
  packetPath: string
  draftSource: string
  challengerAgent: 'Amina'
  challengerStatus: 'passed'
  passToHuman: true
  approvalStatus: 'human_review_ready'
  humanReview: string
  nextGate: string
  decisionPrompt: string
  approveMeaning: string
  sendBackMeaning: string
  targetSurface: AgenticContentReviewSurface
  launchDraftPath?: string
}

const SALES_OUTREACH_LAUNCH_DRAFT_PATH = 'docs/agentic-content-linkedin-drafts/2026-06-04-sales-outreach-launch-drafts.md'

export const AGENTIC_CONTENT_REVIEW_PACKETS: AgenticContentReviewPacket[] = [
  {
    assetId: 'p0-linkedin-flagship-agentic-operating-system',
    priority: 'P0',
    title: 'Flagship post: Anyone can launch an agent now',
    channel: 'LinkedIn',
    output: 'Text post',
    sourceComponent: 'Core message',
    packetPath: 'docs/agentic-content-review-packets/p0-challenger-review-packets.md',
    draftSource: 'docs/agentic-enterprise-value-map.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; publishing still gated.',
    nextGate: 'Social Content approval before scheduling or publishing.',
    decisionPrompt: 'Decide whether this LinkedIn post is ready to become a Social Content draft approval.',
    approveMeaning: 'Open the Social Content approval gate, inspect the draft, then approve or publish only from that governed draft screen.',
    sendBackMeaning: 'Route a repair task if the claim, voice, source support, or channel fit is not ready for public review.',
    targetSurface: 'social',
    launchDraftPath: SALES_OUTREACH_LAUNCH_DRAFT_PATH,
  },
  {
    assetId: 'p0-carousel-seven-things-after-agent-demo',
    priority: 'P0',
    title: 'Carousel: 7 things your enterprise agent needs after the demo',
    channel: 'LinkedIn',
    output: 'Slide outline',
    sourceComponent: 'Component library',
    packetPath: 'docs/agentic-content-review-packets/p0-challenger-review-packets.md',
    draftSource: 'docs/agentic-value-communications-plan.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; visual build and publishing still gated.',
    nextGate: 'Visual build review, then Social Content approval before publishing.',
    decisionPrompt: 'Decide whether this carousel outline is ready for visual build review.',
    approveMeaning: 'Open the Social Content approval path after reviewing the outline; visual build and publishing remain separate gates.',
    sendBackMeaning: 'Route a repair task if the slide story, evidence, or sequence needs another challenger pass.',
    targetSurface: 'social',
    launchDraftPath: SALES_OUTREACH_LAUNCH_DRAFT_PATH,
  },
  {
    assetId: 'p1-linkedin-scope-safety-model',
    priority: 'P1',
    title: 'Post: Scope is the safety model',
    channel: 'LinkedIn',
    output: 'Text post',
    sourceComponent: 'Scope',
    packetPath: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; publishing still gated.',
    nextGate: 'Social Content approval before scheduling or publishing.',
    decisionPrompt: 'Decide whether this LinkedIn post is ready to become a Social Content draft approval.',
    approveMeaning: 'Open the Social Content approval gate, inspect the draft, then approve or publish only from that governed draft screen.',
    sendBackMeaning: 'Route a repair task if the scope claim, safety framing, source support, or voice needs revision.',
    targetSurface: 'social',
    launchDraftPath: SALES_OUTREACH_LAUNCH_DRAFT_PATH,
  },
  {
    assetId: 'p1-linkedin-agent-qa-scorecards',
    priority: 'P1',
    title: 'Post: Agent QA needs scorecards',
    channel: 'LinkedIn',
    output: 'Text post',
    sourceComponent: 'QA loop',
    packetPath: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; publishing still gated.',
    nextGate: 'Social Content approval before scheduling or publishing.',
    decisionPrompt: 'Decide whether this LinkedIn post is ready to become a Social Content draft approval.',
    approveMeaning: 'Open the Social Content approval gate, inspect the draft, then approve or publish only from that governed draft screen.',
    sendBackMeaning: 'Route a repair task if the QA claim, scorecard framing, source support, or voice needs revision.',
    targetSurface: 'social',
    launchDraftPath: SALES_OUTREACH_LAUNCH_DRAFT_PATH,
  },
  {
    assetId: 'p0-youtube-agentic-ai-teams-skip',
    priority: 'P0',
    title: 'YouTube script: The Part of Agentic AI Most Teams Skip',
    channel: 'YouTube',
    output: '6-10 minute script',
    sourceComponent: 'Full lifecycle',
    packetPath: 'docs/agentic-content-review-packets/p0-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-video-scripts/wave-1-youtube-scripts.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; render and provider work still gated.',
    nextGate: 'Render-readiness packet before HeyGen, ElevenLabs, Remotion, HyperFrames, or publishing.',
    decisionPrompt: 'Decide whether this script is ready for render-readiness review.',
    approveMeaning: 'Open the video review surface and approve only the next render-readiness step; provider work remains gated.',
    sendBackMeaning: 'Route a repair task if the script, claims, evidence, or delivery shape needs revision.',
    targetSurface: 'video',
  },
  {
    assetId: 'p1-short-agent-needs-receipt',
    priority: 'P1',
    title: 'Short: The agent needs a receipt',
    channel: 'TikTok/Reels/Shorts',
    output: '45-second script',
    sourceComponent: 'Observability',
    packetPath: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; render and provider work still gated.',
    nextGate: 'Render-readiness packet before HeyGen, ElevenLabs, Remotion, HyperFrames, or publishing.',
    decisionPrompt: 'Decide whether this short script is ready for render-readiness review.',
    approveMeaning: 'Open the video review surface and approve only the next render-readiness step; provider work remains gated.',
    sendBackMeaning: 'Route a repair task if the hook, claim, evidence, or short-form pacing needs revision.',
    targetSurface: 'video',
  },
  {
    assetId: 'p1-short-handoff-work-packet',
    priority: 'P1',
    title: 'Short: A handoff is a work packet',
    channel: 'TikTok/Reels/Shorts',
    output: '45-second script',
    sourceComponent: 'Handoff',
    packetPath: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p1-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; render and provider work still gated.',
    nextGate: 'Render-readiness packet before HeyGen, ElevenLabs, Remotion, HyperFrames, or publishing.',
    decisionPrompt: 'Decide whether this short script is ready for render-readiness review.',
    approveMeaning: 'Open the video review surface and approve only the next render-readiness step; provider work remains gated.',
    sendBackMeaning: 'Route a repair task if the handoff framing, claim, evidence, or short-form pacing needs revision.',
    targetSurface: 'video',
  },
  {
    assetId: 'p2-client-one-pager-governed-agentic-operations',
    priority: 'P2',
    title: 'Client one-pager: Governed Agentic Operations',
    channel: 'Client one-pager',
    output: 'PDF/web proof asset',
    sourceComponent: 'Value stack',
    packetPath: 'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; PDF or webpage production still gated.',
    nextGate: 'PDF/web production approval before export, implementation, or client sharing.',
    decisionPrompt: 'Decide whether this one-pager is ready for PDF or webpage production review.',
    approveMeaning: 'Open the Content Hub production path only after approving the editorial packet; PDF export and client sharing remain separate gates.',
    sendBackMeaning: 'Route a repair task if the buyer language, CTA, source support, or AmaduTown branding decision needs revision.',
    targetSurface: 'content',
    launchDraftPath: SALES_OUTREACH_LAUNCH_DRAFT_PATH,
  },
  {
    assetId: 'p2-technical-appendix-agentic-proof-map',
    priority: 'P2',
    title: 'Technical appendix: Agentic Operating Proof Map',
    channel: 'Technical appendix',
    output: 'PDF/Markdown due diligence asset',
    sourceComponent: 'Source map',
    packetPath: 'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; appendix production still gated.',
    nextGate: 'Appendix production approval before PDF export, public release, or client sharing.',
    decisionPrompt: 'Decide whether this appendix is ready for Markdown or PDF production review.',
    approveMeaning: 'Open the Content Hub production path only after approving the proof map; public release and client sharing remain separate gates.',
    sendBackMeaning: 'Route a repair task if the implementation paths, proof questions, or public-safe boundaries need revision.',
    targetSurface: 'content',
  },
  {
    assetId: 'p2-website-proof-page-governed-agents',
    priority: 'P2',
    title: 'Website proof page: Governed Agents, Not Unchecked Automation',
    channel: 'Portfolio website',
    output: 'Proof page brief',
    sourceComponent: 'Full system',
    packetPath: 'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
    draftSource: 'docs/agentic-content-review-packets/p2-challenger-review-packets.md',
    challengerAgent: 'Amina',
    challengerStatus: 'passed',
    passToHuman: true,
    approvalStatus: 'human_review_ready',
    humanReview: 'Ready for editorial approval; website implementation still gated.',
    nextGate: 'Website implementation approval before building or publishing a proof page.',
    decisionPrompt: 'Decide whether this proof-page brief is ready for implementation planning.',
    approveMeaning: 'Open the Content Hub or implementation planning path only after approving the editorial packet; deployment remains a separate gate.',
    sendBackMeaning: 'Route a repair task if the page purpose, privacy boundary, visual direction, or CTA needs revision.',
    targetSurface: 'content',
  },
]

export function getAgenticContentReviewPacketsForSurface(surface: AgenticContentReviewSurface) {
  return AGENTIC_CONTENT_REVIEW_PACKETS.filter((packet) => packet.targetSurface === surface)
}

export function getAgenticContentReviewPacketByAssetId(assetId: string) {
  return AGENTIC_CONTENT_REVIEW_PACKETS.find((packet) => packet.assetId === assetId) ?? null
}

export function buildAgenticContentReviewActionHref(
  packet: AgenticContentReviewPacket,
  decision: AgenticContentReviewDecision,
) {
  const params = new URLSearchParams({
    context: 'agentic-content-review',
    asset: packet.assetId,
    decision,
  })

  return `/admin/agents/standup?${params.toString()}`
}
