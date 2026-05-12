import { describe, expect, it } from 'vitest'
import {
  assessAiRiskSignals,
  buildAiRiskWorkItemRequests,
  buildMoremiOperationalDrillWorkItemRequest,
  getAiRiskSignalMonitorSummary,
  getAiRiskSourceFeeds,
} from './ai-risk-signal-monitor'

describe('AI risk signal monitor', () => {
  it('classifies privacy and regulatory signals as approval-routed exposure', () => {
    const [assessment] = assessAiRiskSignals([
      {
        title: 'Regulator issues AI agent privacy enforcement warning',
        summary: 'The warning focuses on AI agents processing customer data without consent or retention controls.',
        sourceName: 'Regulator bulletin',
      },
    ])

    expect(assessment).toMatchObject({
      classification: 'approval_required',
      severity: 'critical',
      category: 'privacy_data',
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerAgentName: 'Moremi (Ife) - Risk & Compliance',
    })
    expect(assessment.exposureSurfaces.map((surface) => surface.key)).toEqual(expect.arrayContaining([
      'client-data-boundary',
      'ai-policy-governance',
    ]))
    expect(assessment.upgradeRequest).toMatchObject({
      priority: 'urgent',
      owner_agent_key: 'risk-compliance-intelligence',
      metadata: expect.objectContaining({ approval_required: true }),
    })
  })

  it('keeps unrelated signals as watch-only without upgrade requests', () => {
    const [assessment] = assessAiRiskSignals([
      {
        title: 'AI conference announces new keynote track',
        summary: 'The event includes broad commentary about AI adoption and demos.',
        sourceName: 'Conference site',
        severity: 'low',
      },
    ])

    expect(assessment.classification).toBe('watch_only')
    expect(assessment.exposureSurfaces).toEqual([])
    expect(assessment.upgradeRequest).toBeNull()
  })

  it('routes prompt and runtime security signals through approval-required packets', () => {
    const [assessment] = assessAiRiskSignals([
      {
        id: 'security-advisory-1',
        title: 'AI agent prompt injection vulnerability affects browser automation',
        summary: 'Security researchers report indirect prompt injection that can trigger unsafe tool calls.',
        sourceName: 'Security advisory',
        sourceUrl: 'https://example.com/advisory',
        tags: ['tool injection'],
      },
    ])

    expect(assessment).toMatchObject({
      classification: 'approval_required',
      severity: 'high',
      category: 'prompt_injection',
    })
    expect(assessment.exposureSurfaces.map((surface) => surface.key)).toEqual(expect.arrayContaining([
      'agent-tool-use',
      'runtime-security',
    ]))
    expect(assessment.upgradeRequest).toMatchObject({
      source_id: 'security-advisory-1',
      source_label: 'Security advisory',
      priority: 'urgent',
      metadata: expect.objectContaining({
        approval_required: true,
        classification: 'approval_required',
        source_url: 'https://example.com/advisory',
        exposure_surfaces: expect.arrayContaining(['agent-tool-use', 'runtime-security']),
      }),
    })
  })

  it('returns a read-only monitor summary with Moremi as owner', () => {
    expect(getAiRiskSignalMonitorSummary()).toMatchObject({
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerAgentName: 'Moremi (Ife) - Risk & Compliance',
      enabledSourceFeedCount: 5,
      safetyBoundary: expect.stringContaining('Read-only signal assessment'),
    })
  })

  it('exposes approved source feeds with filtering before live ingestion exists', () => {
    expect(getAiRiskSourceFeeds({ enabledOnly: true }).map((feed) => feed.key)).toEqual(expect.arrayContaining([
      'owasp-agent-security-initiative',
      'nist-ai-rmf',
      'eu-ai-act',
      'ftc-ai-guidance',
    ]))
    expect(getAiRiskSourceFeeds({ category: 'prompt_injection' }).map((feed) => feed.key)).toEqual(expect.arrayContaining([
      'owasp-agent-security-initiative',
      'owasp-aivss',
    ]))
    expect(getAiRiskSourceFeeds({ priority: 'vendor', enabledOnly: true })).toEqual([])
  })

  it('builds proposed work item requests only for actionable assessments', () => {
    const assessments = assessAiRiskSignals([
      {
        id: 'actionable-risk',
        title: 'AI agent prompt injection vulnerability affects browser automation',
        summary: 'Security researchers report indirect prompt injection that can trigger unsafe tool calls.',
        sourceName: 'Security advisory',
      },
      {
        id: 'watch-risk',
        title: 'AI conference announces new keynote track',
        summary: 'The event includes broad commentary about AI adoption and demos.',
        sourceName: 'Conference site',
        severity: 'low',
      },
    ])

    expect(buildAiRiskWorkItemRequests(assessments)).toEqual([
      expect.objectContaining({
        title: 'Review AI risk signal: AI agent prompt injection vulnerability affects browser automation',
        status: 'proposed',
        ownerAgentKey: 'risk-compliance-intelligence',
        ownerRuntime: 'manual',
        overlapGroup: 'ai-risk-compliance',
        idempotencyKey: 'ai-risk-signal:actionable-risk:approval_required',
        metadata: expect.objectContaining({
          conversion_requires_review: true,
          exposure_surfaces: expect.arrayContaining(['agent-tool-use', 'runtime-security']),
        }),
      }),
    ])
  })

  it('builds an idempotent synthetic Moremi operational drill packet', () => {
    const { assessment, workItemRequest } = buildMoremiOperationalDrillWorkItemRequest()

    expect(assessment).toMatchObject({
      signalId: 'moremi-operational-drill-prompt-injection-browser-automation',
      classification: 'approval_required',
      severity: 'high',
      ownerAgentKey: 'risk-compliance-intelligence',
    })
    expect(workItemRequest).toMatchObject({
      title: 'Review AI risk signal: Synthetic Moremi drill: prompt injection risk in browser automation',
      status: 'proposed',
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerRuntime: 'manual',
      overlapGroup: 'ai-risk-compliance',
      idempotencyKey: 'ai-risk-drill:moremi-operational-drill:v1',
      metadata: expect.objectContaining({
        synthetic_drill: true,
        non_production_data: true,
        production_mutation_allowed: false,
        slack_verification_command: '/agent work',
        admin_verification_path: '/admin/agents/coordination',
      }),
    })
  })
})
