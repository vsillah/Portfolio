#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'

type VercelDeployment = {
  url: string
  name: string
  state: string
  target?: string | null
  createdAt?: number
  buildingAt?: number
  ready?: number
  meta?: {
    githubPrId?: string
    githubCommitRef?: string
    githubCommitSha?: string
    githubCommitMessage?: string
  }
}

type VercelListResponse = {
  deployments?: VercelDeployment[]
}

type DeploymentMetric = {
  project: string
  state: string
  target: string
  ref: string
  pr: string
  url: string
  queueSeconds: number | null
  buildSeconds: number | null
  totalSeconds: number | null
}

type MetricSummary = {
  project: string
  target: string
  count: number
  averageQueueSeconds: number
  averageBuildSeconds: number
  averageTotalSeconds: number
  maxTotalSeconds: number
}

const DEFAULT_PROJECTS = ['portfolio', 'portfolio-staging']

function parseArgs(argv: string[]) {
  const options = {
    projects: [...DEFAULT_PROJECTS],
    limit: 20,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--projects' && next) {
      options.projects = next
        .split(',')
        .map((project) => project.trim())
        .filter(Boolean)
      index += 1
    } else if (arg === '--limit' && next) {
      options.limit = Number(next)
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run deploy:metrics -- [options]

Options:
  --projects <a,b>   Vercel projects to inspect. Defaults to portfolio,portfolio-staging.
  --limit <n>        Number of recent deployments per project to include. Defaults to 20.
`)
      process.exit(0)
    }
  }

  if (options.projects.length === 0) {
    throw new Error('--projects must include at least one project')
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive number')
  }

  return options
}

function runVercelList(project: string): VercelDeployment[] {
  const result = spawnSync('vercel', ['ls', project, '--yes', '--format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || 'vercel ls failed'
    throw new Error(`${project}: ${message}`)
  }

  const parsed = JSON.parse(result.stdout) as VercelListResponse
  return parsed.deployments ?? []
}

function secondsBetween(end: number | undefined, start: number | undefined): number | null {
  if (!end || !start || end < start) return null
  return Math.round((end - start) / 1000)
}

function toMetric(project: string, deployment: VercelDeployment, now = Date.now()): DeploymentMetric {
  const target = deployment.target ?? 'preview'
  const createdAt = deployment.createdAt
  const buildingAt = deployment.buildingAt
  const readyAt = deployment.ready

  const queueSeconds = buildingAt
    ? secondsBetween(buildingAt, createdAt)
    : deployment.state === 'QUEUED'
      ? secondsBetween(now, createdAt)
      : null

  const buildSeconds = readyAt && buildingAt
    ? secondsBetween(readyAt, buildingAt)
    : deployment.state === 'BUILDING'
      ? secondsBetween(now, buildingAt ?? createdAt)
      : null

  const totalSeconds = readyAt
    ? secondsBetween(readyAt, createdAt)
    : deployment.state === 'QUEUED' || deployment.state === 'BUILDING'
      ? secondsBetween(now, createdAt)
      : null

  return {
    project,
    state: deployment.state,
    target,
    ref: deployment.meta?.githubCommitRef ?? 'unknown',
    pr: deployment.meta?.githubPrId ?? '',
    url: deployment.url,
    queueSeconds,
    buildSeconds,
    totalSeconds,
  }
}

function average(values: Array<number | null>): number {
  const finite = values.filter((value): value is number => Number.isFinite(value))
  if (finite.length === 0) return 0
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

function summarize(metrics: DeploymentMetric[]): MetricSummary[] {
  const readyMetrics = metrics.filter((metric) => metric.state === 'READY' && metric.totalSeconds !== null)
  const groups = new Map<string, DeploymentMetric[]>()

  for (const metric of readyMetrics) {
    const key = `${metric.project}:${metric.target}`
    groups.set(key, [...(groups.get(key) ?? []), metric])
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const [project, target] = key.split(':')
      return {
        project,
        target,
        count: group.length,
        averageQueueSeconds: average(group.map((metric) => metric.queueSeconds)),
        averageBuildSeconds: average(group.map((metric) => metric.buildSeconds)),
        averageTotalSeconds: average(group.map((metric) => metric.totalSeconds)),
        maxTotalSeconds: Math.max(...group.map((metric) => metric.totalSeconds ?? 0)),
      }
    })
    .sort((a, b) => a.project.localeCompare(b.project) || a.target.localeCompare(b.target))
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m${remainder.toString().padStart(2, '0')}s`
}

function printSummary(summaries: MetricSummary[]) {
  console.log('Deployment Timing Summary')
  console.log('project\ttarget\tcount\tavg_queue\tavg_build\tavg_total\tmax_total')

  for (const summary of summaries) {
    console.log(
      [
        summary.project,
        summary.target,
        summary.count,
        formatSeconds(Math.round(summary.averageQueueSeconds)),
        formatSeconds(Math.round(summary.averageBuildSeconds)),
        formatSeconds(Math.round(summary.averageTotalSeconds)),
        formatSeconds(Math.round(summary.maxTotalSeconds)),
      ].join('\t')
    )
  }
}

function printRecent(metrics: DeploymentMetric[]) {
  console.log('')
  console.log('Recent Deployments')
  console.log('project\tstate\ttarget\tpr\tqueue\tbuild\ttotal\tref\turl')

  for (const metric of metrics) {
    console.log(
      [
        metric.project,
        metric.state,
        metric.target,
        metric.pr || '-',
        formatSeconds(metric.queueSeconds),
        formatSeconds(metric.buildSeconds),
        formatSeconds(metric.totalSeconds),
        metric.ref,
        metric.url,
      ].join('\t')
    )
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const metrics = options.projects.flatMap((project) =>
    runVercelList(project)
      .slice(0, options.limit)
      .map((deployment) => toMetric(project, deployment))
  )

  printSummary(summarize(metrics))
  printRecent(metrics)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
