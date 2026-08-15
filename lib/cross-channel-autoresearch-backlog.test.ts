import { describe, expect, it } from 'vitest'
import {
  AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES,
  AUTORESEARCH_BACKLOG_EXTERNAL_ACTIONS,
  AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
  buildAutoResearchBacklogAdminProjection,
  buildAutoResearchBacklogReadOnlyResponse,
  callableAutoResearchExternalActions,
  evaluateAutoResearchImprovementRecommendation,
  externalAutoResearchActionPermission,
  projectAutoResearchBacklogItem,
} from './cross-channel-autoresearch-backlog'
import type { CrossChannelAutoResearchBacklogItem } from './cross-channel-autoresearch-backlog'

function cloneFixture(index = 0): CrossChannelAutoResearchBacklogItem {
  return structuredClone(AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES[index])
}

describe('cross-channel autoresearch backlog', () => {
  it('keeps fixtures linked to existing packet paths and campaign IDs', () => {
    const xItem = AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES.find((item) => item.id === 'autoresearch-agentified-agt-x-01')
    const youtubeItem = AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES.find((item) => item.id === 'autoresearch-agentified-agt-yt-ep01')

    expect(xItem).toBeDefined()
    expect(youtubeItem).toBeDefined()
    expect(xItem?.campaignSlug).toBe('agentified-trust-scale-2026-07')
    expect(xItem?.releaseLinkage?.calendarAssetId).toBe('AGT-X-01')
    expect(xItem?.sourcePacketPaths).toEqual(expect.arrayContaining([
      'docs/content-strategy/agentified-x-research-evidence-2026-08-05.md',
      'docs/content-strategy/agentified-x-review-packets-2026-08-05.md',
      'agentified/campaign/portfolio-campaign-packet.json',
    ]))

    expect(youtubeItem?.releaseLinkage?.calendarAssetId).toBe('AGT-YT-EP01')
    expect(youtubeItem?.sourcePacketPaths).toContain('docs/agentic-content-video-scripts/agentified-youtube-amina-research-to-video-packet.md')
  })

  it('requires source-distance approval before draft handoff', () => {
    const item = cloneFixture()
    item.sourceDistance = {
      ...item.sourceDistance,
      status: 'pending',
    }

    const projection = projectAutoResearchBacklogItem(item)

    expect(projection.canDraftHandoff).toBe(false)
    expect(projection.gates.privacy_rights.state).toBe('blocked')
    expect(projection.gates.draft_handoff.state).toBe('blocked')
    expect(projection.blockers.join(' ')).toMatch(/source-distance/i)
  })

  it('keeps explicit blocked source basis fail-closed even when evidence exists', () => {
    const item = cloneFixture()
    item.gates = item.gates.map((gate) => (
      gate.key === 'source_basis'
        ? { ...gate, state: 'blocked' as const, note: 'Source owner rejected this packet.' }
        : gate
    ))

    const projection = projectAutoResearchBacklogItem(item)

    expect(projection.gates.source_basis.state).toBe('blocked')
    expect(projection.gates.source_basis.rawState).toBe('blocked')
    expect(projection.gates.draft_handoff.state).toBe('blocked')
    expect(projection.gates.draft_handoff.missingPrerequisite).toBe('source_basis')
    expect(projection.canDraftHandoff).toBe(false)
    expect(projection.failClosed).toBe(true)
  })

  it('keeps explicit manual-review source basis fail-closed even when evidence exists', () => {
    const item = cloneFixture()
    item.gates = item.gates.map((gate) => (
      gate.key === 'source_basis'
        ? { ...gate, state: 'manual_review' as const, note: 'Human source review is required.' }
        : gate
    ))

    const projection = projectAutoResearchBacklogItem(item)

    expect(projection.gates.source_basis.state).toBe('manual_review')
    expect(projection.gates.source_basis.rawState).toBe('manual_review')
    expect(projection.gates.draft_handoff.state).toBe('blocked')
    expect(projection.gates.draft_handoff.missingPrerequisite).toBe('source_basis')
    expect(projection.canDraftHandoff).toBe(false)
    expect(projection.failClosed).toBe(true)
  })

  it('enforces sequential gate ordering', () => {
    const item = cloneFixture()
    item.gates = item.gates.map((gate) => {
      if (gate.key === 'copy') return { ...gate, state: 'pending' }
      if (gate.key === 'visual_media') return { ...gate, state: 'approved' }
      if (gate.key === 'draft_handoff') return { ...gate, state: 'approved' }
      return gate
    })

    const projection = projectAutoResearchBacklogItem(item)

    expect(projection.gates.copy.state).toBe('pending')
    expect(projection.gates.visual_media.state).toBe('blocked')
    expect(projection.gates.visual_media.missingPrerequisite).toBe('copy')
    expect(projection.gates.draft_handoff.state).toBe('blocked')
    expect(projection.canDraftHandoff).toBe(false)
  })

  it('does not let approved internal handoff execute providers', () => {
    const item = cloneFixture()
    const projection = projectAutoResearchBacklogItem(item)

    expect(item.status).toBe('approved_for_internal_handoff')
    expect(projection.gates.draft_handoff.state).toBe('approved')
    expect(projection.canDraftHandoff).toBe(true)
    expect(projection.gates.provider_execution.state).toBe('pending')
    expect(callableAutoResearchExternalActions()).toEqual([])
    expect(externalAutoResearchActionPermission(item, 'provider_call')).toMatchObject({
      allowed: false,
      action: 'provider_call',
    })
  })

  it('prevents 24-48 hour recommendations from becoming decision grade', () => {
    const evaluation = evaluateAutoResearchImprovementRecommendation({
      recommendationState: 'decision_grade',
      reviewWindowUsed: '24_48h',
      changeType: 'hook',
      recommendation: 'Declare this hook the winner.',
      evidenceBasis: 'Early replies only.',
      visibleSampleBasis: 'Manual 24-48 hour review.',
      confidence: 'high',
    })

    expect(evaluation.allowed).toBe(false)
    expect(evaluation.canBeDecisionGrade).toBe(false)
    expect(evaluation.blockers).toContain('24-48 hour directional review cannot produce a decision-grade recommendation.')
  })

  it('requires sample basis and confidence for seven-day decision-grade recommendations', () => {
    const incomplete = evaluateAutoResearchImprovementRecommendation({
      recommendationState: 'decision_grade',
      reviewWindowUsed: 'seven_day',
      changeType: 'thumbnail',
      recommendation: 'Change the thumbnail promise.',
      evidenceBasis: 'Seven-day read exists.',
    })

    expect(incomplete.allowed).toBe(false)
    expect(incomplete.blockers).toEqual(expect.arrayContaining([
      'Seven-day decision-grade recommendation requires a visible sample basis.',
      'Seven-day decision-grade recommendation requires a confidence level.',
    ]))

    const complete = evaluateAutoResearchImprovementRecommendation({
      recommendationState: 'decision_grade',
      reviewWindowUsed: 'seven_day',
      changeType: 'thumbnail',
      recommendation: 'Move real Portfolio proof into the thumbnail.',
      evidenceBasis: 'Seven-day read with public and first-party approved signal.',
      visibleSampleBasis: 'Thumbnail CTR, retention, and comment quality after seven days.',
      confidence: 'medium',
    })

    expect(complete.allowed).toBe(true)
    expect(complete.canBeDecisionGrade).toBe(true)
  })

  it.each(['blocked', 'manual_hold', 'superseded'] as const)('keeps %s status fail-closed', (status) => {
    const item = cloneFixture()
    item.status = status

    const projection = projectAutoResearchBacklogItem(item)

    expect(projection.failClosed).toBe(true)
    expect(projection.canDraftHandoff).toBe(false)
    expect(projection.blockers).toContain(`Backlog item status ${status} is fail-closed.`)
  })

  it('exposes no provider, Slack, cron, migration, publish, schedule, upload, or production mutation action', () => {
    expect(AUTORESEARCH_BACKLOG_SIDE_EFFECTS).toEqual({
      provider_call: false,
      slack_send: false,
      cron_activation: false,
      migration: false,
      publish: false,
      schedule: false,
      upload: false,
      production_mutation: false,
    })
    expect(callableAutoResearchExternalActions()).toEqual([])

    const item = cloneFixture()
    for (const action of AUTORESEARCH_BACKLOG_EXTERNAL_ACTIONS) {
      expect(externalAutoResearchActionPermission(item, action).allowed).toBe(false)
    }
  })

  it('builds a read-only admin projection without adding callable actions', () => {
    const projection = buildAutoResearchBacklogAdminProjection(AGENTIFIED_AUTORESEARCH_BACKLOG_FIXTURES)

    expect(projection).toHaveLength(7)
    expect(projection[0]).toMatchObject({
      id: 'autoresearch-agentified-agt-x-01',
      campaign: {
        slug: 'agentified-trust-scale-2026-07',
        phase: 'tease',
      },
      learningWindows: {
        directional: '24_48h',
        decision: 'seven_day',
      },
      firstBlockedOrPendingGate: 'final_submission',
      externalActions: AUTORESEARCH_BACKLOG_SIDE_EFFECTS,
      callableExternalActions: [],
    })
    expect(projection[0].variants.map((variant) => variant.channel)).toEqual(['x', 'linkedin'])
    expect(projection.map((item) => item.title)).toEqual(expect.arrayContaining([
      'The operating layer behind AMINA',
      'The workbook is the receipt path',
      'Agentified release thread: build trust before scale',
      'Agentic work needs an operating system',
      'The Receipt Every Agent Needs',
      'What the cover is really showing',
    ]))

    const youtubeItem = projection.find((item) => item.id === 'autoresearch-agentified-agt-yt-ep01')
    expect(youtubeItem?.firstBlockedOrPendingGate).toBe('copy')
    expect(youtubeItem?.variants[0].visualNeeds).toEqual(['b_roll', 'thumbnail'])
  })

  it('serializes the read-only response with empty callable external actions', () => {
    const response = buildAutoResearchBacklogReadOnlyResponse()

    expect(response.summary).toEqual({
      total: 7,
      readyForInternalHandoff: 4,
      blockedOrManual: 7,
      callableExternalActions: 0,
    })
    expect(response.side_effects).toBe(AUTORESEARCH_BACKLOG_SIDE_EFFECTS)
    expect(response.callable_external_actions).toEqual([])
    expect(response.items[0].sourcePacketPaths).toContain('agentified/campaign/portfolio-campaign-packet.json')
    expect(response.items.map((item) => item.title)).toEqual(expect.arrayContaining([
      'What breaks first when AI gets faster?',
      'The operating layer behind AMINA',
      'The workbook is the receipt path',
      'Agentified release thread: build trust before scale',
      'Agentic work needs an operating system',
      'The Receipt Every Agent Needs',
      'What the cover is really showing',
    ]))
    expect(JSON.stringify(response)).not.toContain('provider_token')
  })
})
