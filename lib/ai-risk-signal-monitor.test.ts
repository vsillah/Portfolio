import { describe, expect, it } from 'vitest'
import { assessAiRiskSignals, getAiRiskSignalMonitorSummary } from './ai-risk-signal-monitor'

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
      safetyBoundary: expect.stringContaining('Read-only signal assessment'),
    })
  })
})
