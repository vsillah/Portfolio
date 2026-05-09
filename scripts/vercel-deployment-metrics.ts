#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import {
  DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS,
  collectDeploymentFindings,
  formatSeconds,
  summarizeDeploymentMetrics,
  toDeploymentMetric,
  type DeploymentMetric,
  type DeploymentMetricThresholds,
  type MetricFinding,
  type MetricSummary,
  type VercelDeployment,
} from '../lib/vercel-deployment-metrics'

type VercelListResponse = {
  deployments?: VercelDeployment[]
}

export const DEFAULT_PROJECTS = ['portfolio', 'portfolio-staging']

export function parseArgs(argv: string[]) {
  const options = {
    projects: [...DEFAULT_PROJECTS],
    limit: 20,
    json: false,
    thresholds: { ...DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS },
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
    } else if (arg === '--queue-watch' && next) {
      options.thresholds.queueWatchSeconds = Number(next)
      index += 1
    } else if (arg === '--queue-blocked' && next) {
      options.thresholds.queueBlockedSeconds = Number(next)
      index += 1
    } else if (arg === '--build-watch' && next) {
      options.thresholds.buildWatchSeconds = Number(next)
      index += 1
    } else if (arg === '--build-blocked' && next) {
      options.thresholds.buildBlockedSeconds = Number(next)
      index += 1
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run deploy:metrics -- [options]

Options:
  --projects <a,b>       Vercel projects to inspect. Defaults to portfolio,portfolio-staging.
  --limit <n>            Number of recent deployments per project to include. Defaults to 20.
  --queue-watch <sec>    Queue watch threshold. Defaults to 300.
  --queue-blocked <sec>  Queue blocked threshold. Defaults to 600.
  --build-watch <sec>    Build watch threshold. Defaults to 480.
  --build-blocked <sec>  Build blocked threshold. Defaults to 900.
  --json                 Print machine-readable output.
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

  validateThresholds(options.thresholds)

  return options
}

function validateThresholds(thresholds: DeploymentMetricThresholds) {
  for (const [key, value] of Object.entries(thresholds)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`--${key} must be a positive number of seconds`)
    }
  }

  if (thresholds.queueBlockedSeconds < thresholds.queueWatchSeconds) {
    throw new Error('--queue-blocked must be greater than or equal to --queue-watch')
  }

  if (thresholds.buildBlockedSeconds < thresholds.buildWatchSeconds) {
    throw new Error('--build-blocked must be greater than or equal to --build-watch')
  }
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

function printSummary(summaries: MetricSummary[]) {
  console.log('Deployment Timing Summary')
  console.log('project\ttarget\tcount\tavg_queue\tavg_build\tavg_total\tmax_queue\tmax_build\tmax_total')

  for (const summary of summaries) {
    console.log(
      [
        summary.project,
        summary.target,
        summary.count,
        formatSeconds(Math.round(summary.averageQueueSeconds)),
        formatSeconds(Math.round(summary.averageBuildSeconds)),
        formatSeconds(Math.round(summary.averageTotalSeconds)),
        formatSeconds(Math.round(summary.maxQueueSeconds)),
        formatSeconds(Math.round(summary.maxBuildSeconds)),
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

function printFindings(findings: MetricFinding[]) {
  console.log('')
  console.log('Deployment Timing Findings')

  if (findings.length === 0) {
    console.log('No queue/build timing findings crossed the configured thresholds.')
    return
  }

  console.log('severity\tproject\ttarget\tstate\treason\tguidance\turl')

  for (const finding of findings) {
    console.log(
      [
        finding.severity,
        finding.project,
        finding.target,
        finding.state,
        finding.reason,
        finding.guidance,
        finding.url,
      ].join('\t')
    )
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const metrics = options.projects.flatMap((project) =>
    runVercelList(project)
      .slice(0, options.limit)
      .map((deployment) => toDeploymentMetric(project, deployment))
  )
  const summaries = summarizeDeploymentMetrics(metrics)
  const findings = collectDeploymentFindings(metrics, options.thresholds)

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          projects: options.projects,
          limit: options.limit,
          thresholds: options.thresholds,
          summaries,
          findings,
          metrics,
        },
        null,
        2
      )
    )
    return
  }

  printSummary(summaries)
  printRecent(metrics)
  printFindings(findings)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
