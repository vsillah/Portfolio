import { describe, expect, it } from 'vitest'
import {
  buildMobileFoundryPrototypePacket,
  renderMobileFoundryPrototypePacketMarkdown,
} from './mobile-app-foundry-prototype-packet'
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

describe('mobile app foundry prototype packet', () => {
  it('builds a deterministic read-only prototype packet from a backlog record', () => {
    const packet = buildMobileFoundryPrototypePacket(record, '2026-06-19T12:00:00.000Z')

    expect(packet).toMatchObject({
      id: 'prototype-packet:speech-practice-coach:v1',
      generated_at: '2026-06-19T12:00:00.000Z',
      mode: 'read_only',
      backlog_record_id: 'speech-practice-coach',
      app_title: 'Speech Practice Coach',
      owner_agent_role: 'Imhotep (Kemet) - Prototype Architect',
      repo_plan: {
        proposed_repo_slug: 'mobile-speech-practice-coach',
        repo_creation_status: 'approval_required',
        suggested_branch: 'codex/mobile-speech-practice-coach-prototype',
      },
      side_effects: {
        creates_repository: false,
        creates_github_account: false,
        installs_paid_api: false,
        invites_testers: false,
        submits_to_store: false,
        changes_pricing: false,
        publishes_claims: false,
        collects_user_data: false,
      },
    })
    expect(packet.approval_gates).toContain('Create repository or new GitHub owner.')
    expect(packet.smoke_tests).toContain('Launch the app in a simulator or browser preview.')
  })

  it('falls back when optional scope, commercialization, or risk fields are missing', () => {
    const packet = buildMobileFoundryPrototypePacket({
      ...record,
      prototype_scope: [],
      commercialization_path: [],
      risks: [],
    })

    expect(packet.mvp_scope[0]).toBe('Define the primary mobile user flow.')
    expect(packet.commercialization_assumptions[0]).toContain('pending')
    expect(packet.risks[0]).toContain('No material risks')
  })

  it('renders markdown without implying external side effects', () => {
    const packet = buildMobileFoundryPrototypePacket(record, '2026-06-19T12:00:00.000Z')
    const markdown = renderMobileFoundryPrototypePacketMarkdown(packet)

    expect(markdown).toContain('# Speech Practice Coach Prototype Packet')
    expect(markdown).toContain('Repo creation status: approval_required')
    expect(markdown).toContain('No repository, GitHub account, paid API')
    expect(markdown).not.toContain('repository created')
    expect(markdown).not.toContain('tester invited')
  })
})
