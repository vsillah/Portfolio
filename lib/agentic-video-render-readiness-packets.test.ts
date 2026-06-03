import { describe, expect, it } from 'vitest'
import {
  AGENTIC_VIDEO_RENDER_READINESS_PACKETS,
  buildAgenticVideoRenderReadinessActionHref,
  getAgenticVideoRenderReadinessPacketByAssetId,
  getAgenticVideoRenderReadinessPackets,
} from './agentic-video-render-readiness-packets'
import { VIDEO_RENDER_APPROVAL_PACKET_PATH, VIDEO_RENDER_APPROVAL_SCOPE } from './video-render-approval'

describe('agentic video render-readiness packets', () => {
  it('derives provider preflight packets from challenger-cleared video scripts', () => {
    expect(getAgenticVideoRenderReadinessPackets()).toHaveLength(3)

    for (const packet of AGENTIC_VIDEO_RENDER_READINESS_PACKETS) {
      expect(packet.sourcePacket.targetSurface).toBe('video')
      expect(packet.sourcePacket.challengerStatus).toBe('passed')
      expect(packet.sourcePacket.passToHuman).toBe(true)
      expect(packet.readinessStatus).toBe('ready_for_preflight')
      expect(packet.approvalStatus).toBe('render_readiness_review_ready')
      expect(packet.packetPath).toBe(VIDEO_RENDER_APPROVAL_PACKET_PATH)
      expect(packet.scope).toBe(VIDEO_RENDER_APPROVAL_SCOPE)
      expect(packet.approvalBoundary).toContain('does not start a render')
      expect(packet.hardBlocks.join(' ')).toContain('No HeyGen')
      expect(packet.hardBlocks.join(' ')).toContain('Publishing approval remains separate')
    }
  })

  it('keeps provider work behind explicit Standup decisions', () => {
    const packet = getAgenticVideoRenderReadinessPacketByAssetId('render-p0-youtube-agentic-ai-teams-skip')

    expect(packet).not.toBeNull()
    expect(buildAgenticVideoRenderReadinessActionHref(packet!, 'prepare_preflight')).toBe(
      '/admin/agents/standup?context=agentic-render-readiness&asset=render-p0-youtube-agentic-ai-teams-skip&decision=prepare_preflight',
    )
    expect(buildAgenticVideoRenderReadinessActionHref(packet!, 'send_back_to_script_repair')).toContain('decision=send_back_to_script_repair')
    expect(buildAgenticVideoRenderReadinessActionHref(packet!, 'hold_provider_work')).toContain('decision=hold_provider_work')
  })
})
