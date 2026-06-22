import { describe, expect, it } from 'vitest'
import {
  buildMobileFoundryCommercializationPacket,
  renderMobileFoundryCommercializationPacketMarkdown,
} from './mobile-app-foundry-commercialization-packet'
import type { MobileFoundryBacklogRecord } from './mobile-app-foundry'

const record: MobileFoundryBacklogRecord = {
  id: 'speech-practice-coach',
  title: 'Speech Practice Coach',
  audience: 'People preparing for public speaking moments',
  job_to_be_done: 'Practice a speech, get structured feedback, and track improvement.',
  trend_sources: ['App Store public speaking category'],
  competitors: ['Orai'],
  popularity_score: 88,
  score_breakdown: {
    demand_signal: 25,
    monetization_path: 13,
    builder_fit: 20,
    build_velocity: 10,
    differentiation: 10,
    release_readiness: 10,
  },
  vambah_fit_summary: 'AI workbench utility with a coaching and access lens.',
  prototype_scope: ['speech prompt intake', 'practice scoring', 'feedback history'],
  commercialization_path: ['free practice tier', 'paid coaching companion'],
  risks: ['Avoid employment-outcome claims.'],
  human_gate: 'review_required',
}

describe('mobile app foundry commercialization packet', () => {
  it('builds a read-only commercialization packet with approval gates', () => {
    const packet = buildMobileFoundryCommercializationPacket(record, {}, '2026-06-19T12:00:00.000Z')

    expect(packet).toMatchObject({
      id: 'commercialization-packet:speech-practice-coach:v1',
      generated_at: '2026-06-19T12:00:00.000Z',
      mode: 'read_only',
      validation_status: 'pending_review',
      owner_agent_role: 'Kandake (Kush) - Commercialization Captain',
      commercialization_path: ['free practice tier', 'paid coaching companion'],
      side_effects: {
        invites_testers: false,
        creates_tester_list: false,
        collects_user_data: false,
        submits_to_store: false,
        changes_pricing: false,
        creates_payment_product: false,
        publishes_public_claims: false,
        sends_outbound_messages: false,
      },
    })
    expect(packet.approval_gates).toContain('Submit to App Store Connect or Google Play.')
  })

  it('accepts prototype validation evidence without creating tester or store actions', () => {
    const packet = buildMobileFoundryCommercializationPacket(record, {
      validation_status: 'validated',
      prototype_url: ' https://example.com/prototype ',
      demo_evidence: ['Simulator smoke passed.'],
      tester_profile: ['Five public-speaking learners.'],
      pricing_notes: ['Test as bundle add-on first.'],
      privacy_notes: ['No voice upload in MVP.'],
      store_notes: ['Screenshots pending.'],
      launch_notes: ['Use as private portfolio proof first.'],
    })

    expect(packet.validation_status).toBe('validated')
    expect(packet.prototype_url).toBe('https://example.com/prototype')
    expect(packet.demo_evidence).toEqual(['Simulator smoke passed.'])
    expect(packet.tester_packet).toEqual(['Five public-speaking learners.'])
    expect(packet.side_effects.invites_testers).toBe(false)
    expect(packet.side_effects.submits_to_store).toBe(false)
  })

  it('renders markdown without implying launch side effects', () => {
    const packet = buildMobileFoundryCommercializationPacket(record, {}, '2026-06-19T12:00:00.000Z')
    const markdown = renderMobileFoundryCommercializationPacketMarkdown(packet)

    expect(markdown).toContain('# Speech Practice Coach Commercialization Packet')
    expect(markdown).toContain('Validation status: pending_review')
    expect(markdown).toContain('No tester invite, tester list, user-data collection')
    expect(markdown).not.toContain('submitted to store')
    expect(markdown).not.toContain('testers invited')
  })
})
