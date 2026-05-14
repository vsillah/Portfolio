import { describe, expect, it } from 'vitest'
import {
  buildVercelResearchPlan,
  requiresVercelProductionConfigApproval,
  type VercelResearchProposal,
} from './vercel-deployment-research'
import type { DeploymentMetric } from './vercel-deployment-metrics'

function metric(overrides: Partial<DeploymentMetric> = {}): DeploymentMetric {
  return {
    project: 'portfolio',
    state: 'READY',
    target: 'preview',
    ref: 'main',
    pr: '193',
    url: 'portfolio-preview.vercel.app',
    queueSeconds: 40,
    buildSeconds: 210,
    totalSeconds: 250,
    ...overrides,
  }
}

describe('buildVercelResearchPlan', () => {
  it('creates a planning-only profile proposal from deployment metrics', () => {
    const plan = buildVercelResearchPlan({
      generatedAt: '2026-05-11T12:00:00.000Z',
      metrics: [metric()],
    })

    expect(plan.approvalType).toBe('vercel_deployment_research_proposal')
    expect(plan.proposals[0]).toMatchObject({
      id: 'next-build-profile',
      riskLevel: 'low',
      approvalState: 'not_required',
      decisionFrame: {
        successMetric: 'Build duration and identified bottleneck',
        goalStatus: 'on_track',
      },
    })
    expect(plan.operatingRules.join(' ')).toContain('does not execute experiments automatically')
  })

  it('marks production config proposal candidates as approval-required', () => {
    const plan = buildVercelResearchPlan({
      metrics: [
        metric({
          project: 'portfolio-staging',
          queueSeconds: 650,
          buildSeconds: 180,
          totalSeconds: 830,
        }),
      ],
    })

    expect(plan.findings.map((finding) => finding.reason)).toContain('queue=10m50s')
    expect(plan.proposals.find((proposal) => proposal.id === 'vercel-queue-config-review')).toMatchObject({
      riskLevel: 'high',
      approvalState: 'approval_required',
      touchedSettings: expect.arrayContaining(['Vercel project preview deployment setting']),
      decisionFrame: {
        goalStatus: 'blocked',
        recommendedAction: 'approve',
      },
    })
  })
})

describe('requiresVercelProductionConfigApproval', () => {
  it('detects hosted deployment settings as approval-gated', () => {
    const proposal = {
      touchedSettings: ['Vercel project preview deployment setting'],
    } satisfies Pick<VercelResearchProposal, 'touchedSettings'>

    expect(requiresVercelProductionConfigApproval(proposal)).toBe(true)
    expect(requiresVercelProductionConfigApproval({ touchedSettings: [] })).toBe(false)
  })
})
