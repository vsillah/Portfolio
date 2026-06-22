import { describe, expect, it } from 'vitest'
import { analyzeMobileAppFoundryBacklog, type MobileFoundryAnalystInput } from './mobile-app-foundry-analyst'

const baseInput: MobileFoundryAnalystInput = {
  sourcePacket: {
    title: 'My $1.19M App Process: App Idea & Validation (Part 1 of 3)',
    url: 'https://youtu.be/yBa3BKOrVPA?si=QfNu_KvZ_1e9Wu3y',
    transcriptStatus: 'available',
    evidence: ['Validate proven demand before building.', 'Use a unique twist on proven categories.'],
  },
  githubInventorySummary: {
    privateInventoryIncluded: true,
    builderPatterns: ['scan', 'practice', 'utility', 'AI workbench'],
    reusableStack: ['TypeScript', 'Expo', 'Next.js'],
    commercializationFit: ['tester-ready MVP', 'subscription or paid utility'],
  },
  marketEvidence: {
    opportunities: [
      {
        id: 'speech-practice-coach',
        title: 'Speech Practice Coach',
        audience: 'People preparing for public speaking moments',
        jobToBeDone: 'Practice a speech, get structured feedback, and track improvement.',
        trendSources: ['App Store public speaking category', 'YouTube creator demand'],
        competitors: ['Speechify', 'Orai'],
        demandSignals: ['recurring personal development need', 'creator search demand'],
        monetizationSignals: ['subscription precedent', 'clear upgrade trigger'],
        builderFitSignals: ['practice', 'AI workbench'],
        buildVelocitySignals: ['text and audio MVP', 'no regulated store claim'],
        differentiationSignals: ['community-first coaching framing', 'Portfolio service tie-in'],
        releaseReadinessSignals: ['tester path is clear', 'privacy burden is manageable', 'store policy risk is understood'],
        prototypeScope: ['speech prompt intake', 'practice scoring', 'feedback history'],
        commercializationPath: ['free practice tier', 'paid coaching companion'],
        risks: ['Avoid therapeutic or employment-outcome claims.'],
      },
      {
        id: 'coupon-map',
        title: 'Coupon Map',
        audience: 'Local shoppers',
        jobToBeDone: 'Find nearby discounts before visiting a store.',
        trendSources: ['discount app search results'],
        competitors: ['RetailMeNot'],
        demandSignals: ['savings demand'],
        monetizationSignals: [],
        builderFitSignals: [],
        buildVelocitySignals: ['simple location MVP'],
        differentiationSignals: [],
        releaseReadinessSignals: [],
        prototypeScope: ['location list', 'coupon detail'],
        commercializationPath: ['affiliate tests'],
      },
    ],
  },
}

describe('analyzeMobileAppFoundryBacklog', () => {
  it('builds a deterministic ranked read-only backlog', () => {
    const result = analyzeMobileAppFoundryBacklog(baseInput, '2026-06-19T12:00:00.000Z')

    expect(result).toMatchObject({
      generated_at: '2026-06-19T12:00:00.000Z',
      mode: 'read_only',
      source_packet: {
        title: baseInput.sourcePacket.title,
        evidence_count: 2,
      },
      safety_boundary: {
        creates_work_items: false,
        creates_repositories: false,
        creates_github_accounts: false,
        sends_outbound_messages: false,
        submits_to_app_stores: false,
        changes_prices: false,
      },
    })
    expect(result.backlog.map((item) => item.id)).toEqual(['speech-practice-coach', 'coupon-map'])
    expect(result.backlog[0]).toMatchObject({
      title: 'Speech Practice Coach',
      human_gate: 'review_required',
      score_breakdown: {
        demand_signal: 25,
        monetization_path: 13,
        builder_fit: 20,
        build_velocity: 10,
        differentiation: 10,
        release_readiness: 10,
      },
    })
    expect(result.backlog[0].popularity_score).toBe(88)
  })

  it('flags records when source packet evidence is missing', () => {
    const result = analyzeMobileAppFoundryBacklog(
      {
        ...baseInput,
        sourcePacket: { ...baseInput.sourcePacket, evidence: [], transcriptStatus: 'pending' },
      },
      '2026-06-19T12:00:00.000Z'
    )

    expect(result.warnings).toEqual([
      'Source packet has no evidence lines. Backlog records are flagged for human review before any scoring should be trusted.',
    ])
    expect(result.backlog[0].risks[0]).toContain('Missing source-packet evidence')
    expect(result.source_packet.transcript_status).toBe('pending')
  })

  it('does not include execution fields that imply side effects', () => {
    const result = analyzeMobileAppFoundryBacklog(baseInput, '2026-06-19T12:00:00.000Z')
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('agent_work_items')
    expect(serialized).not.toContain('repository_created')
    expect(serialized).not.toContain('tester_invited')
    expect(serialized).not.toContain('store_submitted')
  })
})
