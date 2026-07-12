import { describe, it, expect } from 'vitest'
import { getScenario, POPULATE_DEMO_SCENARIOS, scenarioIncludesDiagnosticStep } from './scenarios'

describe('scenarioIncludesDiagnosticStep', () => {
  it('returns true for scenarios that include a diagnostic step', () => {
    expect(scenarioIncludesDiagnosticStep('chat_to_diagnostic')).toBe(true)
    expect(scenarioIncludesDiagnosticStep('full_funnel')).toBe(true)
  })

  it('returns false for scenarios without a diagnostic step', () => {
    expect(scenarioIncludesDiagnosticStep('quick_browse')).toBe(false)
    expect(scenarioIncludesDiagnosticStep('seed_warm_leads')).toBe(false)
  })

  it('returns false for unknown scenario IDs', () => {
    expect(scenarioIncludesDiagnosticStep('nonexistent_scenario')).toBe(false)
  })

  it('registers the Content Intelligence calendar fixture seed scenario', () => {
    const scenario = getScenario('seed_social_content_calendar_fixture')

    expect(scenario).toMatchObject({
      id: 'seed_social_content_calendar_fixture',
      name: 'Seed: Content Calendar Fixture',
      tags: expect.arrayContaining(['seed', 'populate-demo', 'content-intelligence', 'calendar']),
    })
    expect(scenario?.steps[0]).toMatchObject({
      type: 'apiCall',
      endpoint: '/api/admin/testing/demo-seed',
      method: 'POST',
      body: { key: 'social_content_calendar_fixture' },
      expectedStatus: 200,
    })
    expect(POPULATE_DEMO_SCENARIOS.map((item) => item.id)).toContain(
      'seed_social_content_calendar_fixture',
    )
  })

  it('registers the Social Channel review fixture seed scenario', () => {
    const scenario = getScenario('seed_social_channel_review_fixture')

    expect(scenario).toMatchObject({
      id: 'seed_social_channel_review_fixture',
      name: 'Seed: Social Channel Review Fixture',
      tags: expect.arrayContaining(['seed', 'populate-demo', 'content-intelligence', 'social-review']),
    })
    expect(scenario?.steps[0]).toMatchObject({
      type: 'apiCall',
      endpoint: '/api/admin/testing/demo-seed',
      method: 'POST',
      body: { key: 'social_channel_review_fixture' },
      expectedStatus: 200,
    })
    expect(POPULATE_DEMO_SCENARIOS.map((item) => item.id)).toContain(
      'seed_social_channel_review_fixture',
    )
  })

  it('registers the Accelerated Workshop campaign fixture seed scenario', () => {
    const scenario = getScenario('seed_accelerated_workshop_campaign_fixture')

    expect(scenario).toMatchObject({
      id: 'seed_accelerated_workshop_campaign_fixture',
      name: 'Seed: Accelerated Workshop Campaign Fixture',
      tags: expect.arrayContaining([
        'seed',
        'populate-demo',
        'content-intelligence',
        'calendar',
        'social-review',
        'accelerated',
      ]),
    })
    expect(scenario?.steps[0]).toMatchObject({
      type: 'apiCall',
      endpoint: '/api/admin/testing/demo-seed',
      method: 'POST',
      body: { key: 'accelerated_workshop_campaign_fixture' },
      expectedStatus: 200,
    })
    expect(POPULATE_DEMO_SCENARIOS.map((item) => item.id)).toContain(
      'seed_accelerated_workshop_campaign_fixture',
    )
  })

  it('registers the Agentic Book Rollout campaign fixture seed scenario', () => {
    const scenario = getScenario('seed_agentic_book_rollout_campaign_fixture')

    expect(scenario).toMatchObject({
      id: 'seed_agentic_book_rollout_campaign_fixture',
      name: 'Seed: Agentic Book Rollout Campaign Fixture',
      tags: expect.arrayContaining([
        'seed',
        'populate-demo',
        'content-intelligence',
        'calendar',
        'social-review',
        'agentic',
      ]),
    })
    expect(scenario?.steps[0]).toMatchObject({
      type: 'apiCall',
      endpoint: '/api/admin/testing/demo-seed',
      method: 'POST',
      body: { key: 'agentic_book_rollout_campaign_fixture' },
      expectedStatus: 200,
    })
    expect(POPULATE_DEMO_SCENARIOS.map((item) => item.id)).toContain(
      'seed_agentic_book_rollout_campaign_fixture',
    )
  })
})
