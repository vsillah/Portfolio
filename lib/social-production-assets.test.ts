import { describe, expect, it } from 'vitest'
import {
  buildSocialProductionAssetsPacket,
  getVideoRedactionGate,
} from './social-production-assets'

describe('social production assets', () => {
  it('creates a hard redaction gate for sensitive Chronicle and b-roll evidence', () => {
    const packet = buildSocialProductionAssetsPacket({
      contentId: 'social-1',
      postText: 'Review this internal route: /admin/social-content/social-1',
      ctaText: 'Build with receipts.',
      hashtags: ['#AI'],
      imagePrompt: 'Mission Control illustration.',
      frameworkVisualType: 'architecture',
      ragContext: {
        goal_id: 'goal-1',
        chronicle_evidence_notes: ['Raw Chronicle screen history mentioned vambah@example.com.'],
        open_brain_references: ['approved-memory'],
      },
      brollAssets: [{
        id: 'asset-1',
        route: '/admin/agents/swarm-board',
        route_description: 'Agent Swarm Board',
        filename: 'swarm-board',
        screenshot_path: '/tmp/swarm.png',
        clip_path: '/tmp/swarm.webm',
        captured_at: '2026-06-18T10:00:00.000Z',
      }],
      chronicleScope: {
        approved: true,
        source: 'social_content_detail',
        window_label: 'current production review',
      },
      generatedAt: '2026-06-18T10:00:00.000Z',
    })

    expect(packet.version).toBe('social_production_assets_v2')
    expect(packet.chronicle_evidence.ingestion_mode).toBe('direct_scoped_review')
    expect(packet.video_redaction_manifest.status).toBe('requires_review')
    expect(packet.video_redaction_manifest.items.length).toBeGreaterThan(0)
    expect(packet.video_redaction_manifest.items.map((item) => item.issue_type)).toEqual(
      expect.arrayContaining(['admin_record', 'email', 'raw_chronicle']),
    )
    expect(getVideoRedactionGate(packet).ready).toBe(false)
  })

  it('treats approved redaction decisions as publish-ready', () => {
    const packet = buildSocialProductionAssetsPacket({
      contentId: 'social-1',
      postText: 'Use /admin/social-content/social-1 as internal proof.',
      ctaText: null,
      hashtags: [],
      imagePrompt: null,
      frameworkVisualType: null,
      ragContext: {},
      brollAssets: [],
      chronicleScope: {
        approved: true,
        source: 'social_content_detail',
        window_label: 'current production review',
      },
      generatedAt: '2026-06-18T10:00:00.000Z',
    })

    packet.video_redaction_manifest.items = packet.video_redaction_manifest.items.map((item) => ({
      ...item,
      status: 'approved',
      reviewer_decision: 'approve_redaction',
    }))

    expect(getVideoRedactionGate(packet)).toMatchObject({
      ready: true,
      unresolvedItems: [],
      message: null,
    })
  })
})
