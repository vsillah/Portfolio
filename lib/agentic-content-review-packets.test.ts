import { describe, expect, it } from 'vitest'
import {
  AGENTIC_CONTENT_REVIEW_PACKETS,
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
    }
  })

  it('routes social and video packets to their existing Portfolio review surfaces', () => {
    const socialPackets = getAgenticContentReviewPacketsForSurface('social')
    const videoPackets = getAgenticContentReviewPacketsForSurface('video')

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
  })
})
