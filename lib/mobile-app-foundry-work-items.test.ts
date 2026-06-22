import { describe, expect, it } from 'vitest'
import {
  buildMobileFoundryWorkItemRequest,
  parseMobileFoundryBacklogRecord,
} from './mobile-app-foundry-work-items'
import type { MobileFoundryBacklogRecord } from './mobile-app-foundry'

const record: MobileFoundryBacklogRecord = {
  id: 'speech-practice-coach',
  title: 'Speech Practice Coach',
  audience: 'People preparing for public speaking moments',
  job_to_be_done: 'Practice a speech, get structured feedback, and track improvement.',
  trend_sources: ['App Store public speaking category', 'YouTube creator demand'],
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

describe('mobile app foundry work item requests', () => {
  it('builds a proposed Agent Ops work item with the governed metadata boundary', () => {
    const request = buildMobileFoundryWorkItemRequest(record, 'run-123')

    expect(request).toMatchObject({
      title: 'Prototype mobile app opportunity: Speech Practice Coach',
      priority: 'high',
      status: 'proposed',
      ownerAgentKey: 'engineering-copilot',
      ownerRuntime: 'manual',
      sourceRunId: 'run-123',
      source: {
        type: 'mobile_app_foundry_backlog',
        id: 'speech-practice-coach',
        label: 'Mobile App Foundry backlog',
      },
      overlapGroup: 'mobile-app-foundry',
      idempotencyKey: 'mobile-foundry:speech-practice-coach:prototype-work-item:v1',
      metadata: expect.objectContaining({
        foundry_agent_role: 'Imhotep (Kemet) - Prototype Architect',
        human_gate: 'review_required',
        side_effect_boundary: {
          creates_proposed_agent_work_item: true,
          creates_repositories: false,
          creates_github_accounts: false,
          sends_outbound_messages: false,
          submits_to_app_stores: false,
          changes_prices: false,
          uses_paid_apis: false,
        },
      }),
    })
    expect(request.objective).toContain('Do not create repos, GitHub accounts, tester outreach')
  })

  it('maps lower scores to lower work item priority', () => {
    expect(buildMobileFoundryWorkItemRequest({ ...record, popularity_score: 94 }).priority).toBe('urgent')
    expect(buildMobileFoundryWorkItemRequest({ ...record, popularity_score: 74 }).priority).toBe('medium')
    expect(buildMobileFoundryWorkItemRequest({ ...record, popularity_score: 40 }).priority).toBe('low')
  })

  it('parses the public-safe backlog record shape and normalizes score values', () => {
    const parsed = parseMobileFoundryBacklogRecord({
      ...record,
      popularity_score: 101.2,
      score_breakdown: { demand_signal: 25.4, monetization_path: -1 },
      trend_sources: [' App Store ', null],
      human_gate: 'anything',
    })

    expect(parsed).toMatchObject({
      id: 'speech-practice-coach',
      popularity_score: 100,
      score_breakdown: {
        demand_signal: 25,
        monetization_path: 0,
      },
      trend_sources: ['App Store'],
      human_gate: 'review_required',
    })
  })
})
