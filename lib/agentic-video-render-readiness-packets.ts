import {
  getAgenticContentReviewPacketByAssetId,
  type AgenticContentReviewPacket,
} from './agentic-content-review-packets'
import { VIDEO_RENDER_APPROVAL_PACKET_PATH, VIDEO_RENDER_APPROVAL_SCOPE } from './video-render-approval'

export type AgenticVideoRenderProvider = 'HeyGen' | 'ElevenLabs' | 'Remotion' | 'HyperFrames'
export type AgenticVideoRenderReadinessDecision = 'prepare_preflight' | 'send_back_to_script_repair' | 'hold_provider_work'

export type AgenticVideoRenderReadinessPacket = {
  assetId: string
  sourceAssetId: string
  title: string
  channel: string
  format: string
  priority: 'P0' | 'P1'
  sourcePacket: AgenticContentReviewPacket
  providerTargets: AgenticVideoRenderProvider[]
  readinessStatus: 'ready_for_preflight'
  approvalStatus: 'render_readiness_review_ready'
  requiredChecks: string[]
  hardBlocks: string[]
  approvalBoundary: string
  nextGate: string
  packetPath: string
  scope: string
}

const RENDER_READINESS_PACKET_SPECS = [
  {
    assetId: 'render-p0-youtube-agentic-ai-teams-skip',
    sourceAssetId: 'p0-youtube-agentic-ai-teams-skip',
    providerTargets: ['HeyGen', 'ElevenLabs', 'Remotion', 'HyperFrames'] satisfies AgenticVideoRenderProvider[],
    requiredChecks: [
      'Confirm final spoken script length is within provider limits.',
      'Confirm HeyGen template or avatar and voice defaults are configured.',
      'Confirm ElevenLabs voice path is planned only if separate voiceover is requested.',
      'Confirm B-roll, captions, and aspect ratio are selected before any render job.',
    ],
  },
  {
    assetId: 'render-p1-short-agent-needs-receipt',
    sourceAssetId: 'p1-short-agent-needs-receipt',
    providerTargets: ['HeyGen', 'ElevenLabs', 'Remotion', 'HyperFrames'] satisfies AgenticVideoRenderProvider[],
    requiredChecks: [
      'Confirm short-form script fits a 45-second spoken delivery.',
      'Confirm 9:16 aspect ratio and caption-safe framing before render.',
      'Confirm HeyGen template or avatar and voice defaults are configured.',
      'Confirm no provider job starts until internal review render approval is recorded.',
    ],
  },
  {
    assetId: 'render-p1-short-handoff-work-packet',
    sourceAssetId: 'p1-short-handoff-work-packet',
    providerTargets: ['HeyGen', 'ElevenLabs', 'Remotion', 'HyperFrames'] satisfies AgenticVideoRenderProvider[],
    requiredChecks: [
      'Confirm short-form script fits a 45-second spoken delivery.',
      'Confirm 9:16 aspect ratio and caption-safe framing before render.',
      'Confirm handoff visuals are storyboarded before any avatar or voice job.',
      'Confirm no provider job starts until internal review render approval is recorded.',
    ],
  },
] as const

function buildRenderReadinessPacket(
  spec: (typeof RENDER_READINESS_PACKET_SPECS)[number],
): AgenticVideoRenderReadinessPacket {
  const sourcePacket = getAgenticContentReviewPacketByAssetId(spec.sourceAssetId)
  if (!sourcePacket) {
    throw new Error(`Missing source content review packet for ${spec.sourceAssetId}`)
  }
  if (sourcePacket.targetSurface !== 'video') {
    throw new Error(`Render-readiness source must be a video packet: ${spec.sourceAssetId}`)
  }

  return {
    assetId: spec.assetId,
    sourceAssetId: spec.sourceAssetId,
    title: sourcePacket.title,
    channel: sourcePacket.channel,
    format: sourcePacket.output,
    priority: sourcePacket.priority === 'P0' ? 'P0' : 'P1',
    sourcePacket,
    providerTargets: [...spec.providerTargets],
    readinessStatus: 'ready_for_preflight',
    approvalStatus: 'render_readiness_review_ready',
    requiredChecks: [...spec.requiredChecks],
    hardBlocks: [
      'No HeyGen, ElevenLabs, Remotion, HyperFrames, publishing, or outbound provider job is approved by this packet.',
      'Challenger clearance is required before this packet can be prepared.',
      'Shaka render approval is required before an internal review render can start.',
      'Publishing approval remains separate from render approval.',
    ],
    approvalBoundary: 'This packet prepares provider preflight only. It does not start a render or approve publishing.',
    nextGate: 'Run the read-only render-readiness preflight, then request Shaka internal review render approval if ready.',
    packetPath: VIDEO_RENDER_APPROVAL_PACKET_PATH,
    scope: VIDEO_RENDER_APPROVAL_SCOPE,
  }
}

export const AGENTIC_VIDEO_RENDER_READINESS_PACKETS: AgenticVideoRenderReadinessPacket[] =
  RENDER_READINESS_PACKET_SPECS.map(buildRenderReadinessPacket)

export function getAgenticVideoRenderReadinessPackets() {
  return AGENTIC_VIDEO_RENDER_READINESS_PACKETS
}

export function getAgenticVideoRenderReadinessPacketByAssetId(assetId: string) {
  return AGENTIC_VIDEO_RENDER_READINESS_PACKETS.find((packet) => packet.assetId === assetId) ?? null
}

export function buildAgenticVideoRenderReadinessActionHref(
  packet: AgenticVideoRenderReadinessPacket,
  decision: AgenticVideoRenderReadinessDecision,
) {
  const params = new URLSearchParams({
    context: 'agentic-render-readiness',
    asset: packet.assetId,
    decision,
  })

  return `/admin/agents/standup?${params.toString()}`
}
