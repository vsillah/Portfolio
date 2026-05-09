import { describe, expect, it } from 'vitest'
import {
  collectDeploymentFindings,
  formatSeconds,
  summarizeDeploymentMetrics,
  toDeploymentMetric,
  type DeploymentMetric,
} from './vercel-deployment-metrics'

describe('toDeploymentMetric', () => {
  it('calculates ready deployment queue, build, and total timing', () => {
    const metric = toDeploymentMetric('portfolio', {
      name: 'portfolio',
      url: 'portfolio-git-branch.vercel.app',
      state: 'READY',
      target: 'preview',
      createdAt: 1_000,
      buildingAt: 181_000,
      ready: 661_000,
      meta: {
        githubPrId: '123',
        githubCommitRef: 'codex/example',
      },
    })

    expect(metric).toMatchObject({
      project: 'portfolio',
      state: 'READY',
      target: 'preview',
      ref: 'codex/example',
      pr: '123',
      queueSeconds: 180,
      buildSeconds: 480,
      totalSeconds: 660,
    })
  })

  it('uses current time for queued and building deployments', () => {
    const queued = toDeploymentMetric(
      'portfolio-staging',
      {
        name: 'portfolio-staging',
        url: 'portfolio-staging-git-branch.vercel.app',
        state: 'QUEUED',
        createdAt: 1_000,
      },
      601_000
    )
    const building = toDeploymentMetric(
      'portfolio-staging',
      {
        name: 'portfolio-staging',
        url: 'portfolio-staging-git-branch.vercel.app',
        state: 'BUILDING',
        createdAt: 1_000,
        buildingAt: 121_000,
      },
      721_000
    )

    expect(queued.queueSeconds).toBe(600)
    expect(queued.totalSeconds).toBe(600)
    expect(building.queueSeconds).toBe(120)
    expect(building.buildSeconds).toBe(600)
    expect(building.totalSeconds).toBe(720)
  })
})

describe('summarizeDeploymentMetrics', () => {
  it('summarizes ready deployments by project and target', () => {
    const metrics: DeploymentMetric[] = [
      {
        project: 'portfolio',
        state: 'READY',
        target: 'preview',
        ref: 'a',
        pr: '1',
        url: 'a.vercel.app',
        queueSeconds: 60,
        buildSeconds: 180,
        totalSeconds: 240,
      },
      {
        project: 'portfolio',
        state: 'READY',
        target: 'preview',
        ref: 'b',
        pr: '2',
        url: 'b.vercel.app',
        queueSeconds: 180,
        buildSeconds: 420,
        totalSeconds: 600,
      },
      {
        project: 'portfolio',
        state: 'BUILDING',
        target: 'preview',
        ref: 'c',
        pr: '3',
        url: 'c.vercel.app',
        queueSeconds: 30,
        buildSeconds: 60,
        totalSeconds: 90,
      },
    ]

    expect(summarizeDeploymentMetrics(metrics)).toEqual([
      {
        project: 'portfolio',
        target: 'preview',
        count: 2,
        averageQueueSeconds: 120,
        averageBuildSeconds: 300,
        averageTotalSeconds: 420,
        maxQueueSeconds: 180,
        maxBuildSeconds: 420,
        maxTotalSeconds: 600,
      },
    ])
  })
})

describe('collectDeploymentFindings', () => {
  it('flags queue and build pressure using deployment thresholds', () => {
    const findings = collectDeploymentFindings([
      {
        project: 'portfolio-staging',
        state: 'READY',
        target: 'preview',
        ref: 'codex/example',
        pr: '123',
        url: 'staging.vercel.app',
        queueSeconds: 650,
        buildSeconds: 400,
        totalSeconds: 1_050,
      },
      {
        project: 'portfolio',
        state: 'READY',
        target: 'preview',
        ref: 'codex/example',
        pr: '123',
        url: 'portfolio.vercel.app',
        queueSeconds: 40,
        buildSeconds: 500,
        totalSeconds: 540,
      },
    ])

    expect(findings).toEqual([
      {
        severity: 'blocked',
        project: 'portfolio-staging',
        target: 'preview',
        state: 'READY',
        url: 'staging.vercel.app',
        reason: 'queue=10m50s',
        guidance: 'Treat as a deployment blocker until inspected in Vercel or rerun.',
      },
      {
        severity: 'watch',
        project: 'portfolio',
        target: 'preview',
        state: 'READY',
        url: 'portfolio.vercel.app',
        reason: 'build=8m20s',
        guidance: 'Watch this deployment path during captain sweeps; repeated hits are operating debt.',
      },
    ])
  })
})

describe('formatSeconds', () => {
  it('formats null, seconds, and minutes consistently', () => {
    expect(formatSeconds(null)).toBe('-')
    expect(formatSeconds(59)).toBe('59s')
    expect(formatSeconds(60)).toBe('1m00s')
    expect(formatSeconds(125)).toBe('2m05s')
  })
})
