import { describe, expect, it } from 'vitest'
import {
  AGENTIC_CONTENT_REVIEW_PACKETS,
  buildAgenticContentReviewActionHref,
  getAgenticContentReviewPacketByAssetId,
  getAgenticContentReviewPacketsForSurface,
} from './agentic-content-review-packets'

describe('agentic content review packet registry', () => {
  it('only exposes challenger-cleared packets to human review surfaces', () => {
    expect(AGENTIC_CONTENT_REVIEW_PACKETS.length).toBeGreaterThan(0)

    for (const packet of AGENTIC_CONTENT_REVIEW_PACKETS) {
      expect(packet.challengerAgent).toBe('Amina')
      expect(packet.challengerStatus).toBe('passed')
      expect(packet.passToHuman).toBe(true)
      expect(packet.approvalStatus).toBe('human_review_ready')
      expect(packet.nextGate).toMatch(/approval|Render-readiness/)
      expect(packet.decisionPrompt).toMatch(/Decide/)
      expect(packet.approveMeaning).toMatch(/Open/)
      expect(packet.sendBackMeaning).toMatch(/Route a repair task/)
      if (packet.launchDraftPath) {
        expect(packet.launchDraftPath).toBe('docs/agentic-content-linkedin-drafts/2026-06-04-sales-outreach-launch-drafts.md')
      }
    }
  })

  it('routes social and video packets to their existing Portfolio review surfaces', () => {
    const socialPackets = getAgenticContentReviewPacketsForSurface('social')
    const videoPackets = getAgenticContentReviewPacketsForSurface('video')
    const contentPackets = getAgenticContentReviewPacketsForSurface('content')

    expect(socialPackets.map((packet) => packet.assetId)).toEqual([
      'p0-linkedin-flagship-agentic-operating-system',
      'p0-carousel-seven-things-after-agent-demo',
      'p1-linkedin-scope-safety-model',
      'p1-linkedin-agent-qa-scorecards',
    ])

    expect(videoPackets.map((packet) => packet.assetId)).toEqual([
      'p0-youtube-agentic-ai-teams-skip',
      'p1-short-agent-needs-receipt',
      'p1-short-handoff-work-packet',
    ])

    expect(contentPackets.map((packet) => packet.assetId)).toEqual([
      'p2-client-one-pager-governed-agentic-operations',
      'p2-technical-appendix-agentic-proof-map',
      'p2-website-proof-page-governed-agents',
    ])
  })

  it('builds traceable Standup actions without changing content state directly', () => {
    const packet = getAgenticContentReviewPacketByAssetId('p0-youtube-agentic-ai-teams-skip')

    expect(packet).not.toBeNull()
    expect(buildAgenticContentReviewActionHref(packet!, 'approve_next_gate')).toBe(
      '/admin/agents/standup?context=agentic-content-review&asset=p0-youtube-agentic-ai-teams-skip&decision=approve_next_gate',
    )
    expect(buildAgenticContentReviewActionHref(packet!, 'send_back_for_repair')).toContain('decision=send_back_for_repair')
    expect(buildAgenticContentReviewActionHref(packet!, 'hold_for_human')).toContain('decision=hold_for_human')
  })

  it('links the sales outreach launch packet to the first Monday review batch', () => {
    const launchPackets = AGENTIC_CONTENT_REVIEW_PACKETS.filter((packet) => packet.launchDraftPath)

    expect(launchPackets.map((packet) => packet.assetId)).toEqual([
      'p0-linkedin-flagship-agentic-operating-system',
      'p0-carousel-seven-things-after-agent-demo',
      'p1-linkedin-scope-safety-model',
      'p1-linkedin-agent-qa-scorecards',
      'p2-client-one-pager-governed-agentic-operations',
    ])
  })
})
