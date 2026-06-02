export type AgenticContentReviewSurface = 'social' | 'video'

export type AgenticContentReviewPacket = {
  assetId: string
  priority: 'P0' | 'P1'
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
}

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
]

export function getAgenticContentReviewPacketsForSurface(surface: AgenticContentReviewSurface) {
  return AGENTIC_CONTENT_REVIEW_PACKETS.filter((packet) => packet.targetSurface === surface)
}
