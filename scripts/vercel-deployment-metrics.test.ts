import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECTS, parseArgs } from './vercel-deployment-metrics'
import {
  formatSeconds,
  summarizeDeploymentMetrics,
  toDeploymentMetric,
  type DeploymentMetric,
  type VercelDeployment,
} from '../lib/vercel-deployment-metrics'

const baseTime = Date.parse('2026-05-09T10:00:00.000Z')

function deployment(overrides: Partial<VercelDeployment> = {}): VercelDeployment {
  return {
    url: 'deployment.example.vercel.app',
    name: 'portfolio',
    state: 'READY',
    target: 'production',
    createdAt: baseTime,
    buildingAt: baseTime + 30_000,
    ready: baseTime + 150_000,
    meta: {
      githubPrId: '188',
      githubCommitRef: 'cursor/regression-test-coverage-224e',
    },
    ...overrides,
  }
}

function metric(overrides: Partial<DeploymentMetric> = {}): DeploymentMetric {
  return {
    project: 'portfolio',
    state: 'READY',
    target: 'production',
    ref: 'main',
    pr: '188',
    url: 'deployment.example.vercel.app',
    queueSeconds: 30,
    buildSeconds: 120,
    totalSeconds: 150,
    ...overrides,
  }
}

describe('vercel deployment metrics script helpers', () => {
  it('parses project, limit, JSON, and threshold options', () => {
    expect(
      parseArgs([
        '--projects',
        ' portfolio, ,portfolio-staging ',
        '--limit',
        '7',
        '--queue-watch',
        '120',
        '--queue-blocked',
        '240',
        '--build-watch',
        '300',
        '--build-blocked',
        '600',
        '--json',
      ])
    ).toEqual({
      projects: ['portfolio', 'portfolio-staging'],
      limit: 7,
      json: true,
      thresholds: {
        queueWatchSeconds: 120,
        queueBlockedSeconds: 240,
        buildWatchSeconds: 300,
        buildBlockedSeconds: 600,
      },
    })
  })

  it('uses safe defaults and rejects invalid options', () => {
    expect(parseArgs([])).toEqual({
      projects: DEFAULT_PROJECTS,
      limit: 20,
      json: false,
      thresholds: {
        queueWatchSeconds: 300,
        queueBlockedSeconds: 600,
        buildWatchSeconds: 480,
        buildBlockedSeconds: 900,
      },
    })
    expect(() => parseArgs(['--projects', ' , '])).toThrow('--projects must include at least one project')
    expect(() => parseArgs(['--limit', '0'])).toThrow('--limit must be a positive number')
    expect(() => parseArgs(['--limit', 'NaN'])).toThrow('--limit must be a positive number')
    expect(() => parseArgs(['--queue-blocked', '10', '--queue-watch', '20'])).toThrow(
      '--queue-blocked must be greater than or equal to --queue-watch'
    )
    expect(() => parseArgs(['--build-blocked', '10', '--build-watch', '20'])).toThrow(
      '--build-blocked must be greater than or equal to --build-watch'
    )
  })

  it('calculates completed deployment queue, build, and total durations', () => {
    expect(toDeploymentMetric('portfolio', deployment())).toEqual({
      project: 'portfolio',
      state: 'READY',
      target: 'production',
      ref: 'cursor/regression-test-coverage-224e',
      pr: '188',
      url: 'deployment.example.vercel.app',
      queueSeconds: 30,
      buildSeconds: 120,
      totalSeconds: 150,
    })
  })

  it('tracks elapsed time for queued and building deployments without ready timestamps', () => {
    const queued = toDeploymentMetric(
      'portfolio',
      deployment({
        state: 'QUEUED',
        target: null,
        buildingAt: undefined,
        ready: undefined,
        meta: undefined,
      }),
      baseTime + 45_000
    )
    const building = toDeploymentMetric(
      'portfolio-staging',
      deployment({
        state: 'BUILDING',
        buildingAt: baseTime + 20_000,
        ready: undefined,
      }),
      baseTime + 95_000
    )

    expect(queued).toMatchObject({
      project: 'portfolio',
      state: 'QUEUED',
      target: 'preview',
      ref: 'unknown',
      pr: '',
      queueSeconds: 45,
      buildSeconds: null,
      totalSeconds: 45,
    })
    expect(building).toMatchObject({
      project: 'portfolio-staging',
      state: 'BUILDING',
      queueSeconds: 20,
      buildSeconds: 75,
      totalSeconds: 95,
    })
  })

  it('summarizes only ready deployments with measurable totals by project and target', () => {
    const summaries = summarizeDeploymentMetrics([
      metric({ project: 'portfolio-staging', target: 'preview', queueSeconds: 10, buildSeconds: 50, totalSeconds: 60 }),
      metric({ queueSeconds: 20, buildSeconds: 100, totalSeconds: 120 }),
      metric({ queueSeconds: null, buildSeconds: 80, totalSeconds: 100 }),
      metric({ state: 'BUILDING', target: 'production', queueSeconds: 15, buildSeconds: 40, totalSeconds: 55 }),
      metric({ state: 'READY', target: 'production', totalSeconds: null }),
    ])

    expect(summaries).toEqual([
      {
        project: 'portfolio',
        target: 'production',
        count: 2,
        averageQueueSeconds: 20,
        averageBuildSeconds: 90,
        averageTotalSeconds: 110,
        maxQueueSeconds: 20,
        maxBuildSeconds: 100,
        maxTotalSeconds: 120,
      },
      {
        project: 'portfolio-staging',
        target: 'preview',
        count: 1,
        averageQueueSeconds: 10,
        averageBuildSeconds: 50,
        averageTotalSeconds: 60,
        maxQueueSeconds: 10,
        maxBuildSeconds: 50,
        maxTotalSeconds: 60,
      },
    ])
  })

  it('formats missing, sub-minute, and minute-scale timings for tabular output', () => {
    expect(formatSeconds(null)).toBe('-')
    expect(formatSeconds(59)).toBe('59s')
    expect(formatSeconds(60)).toBe('1m00s')
    expect(formatSeconds(125)).toBe('2m05s')
  })
})
