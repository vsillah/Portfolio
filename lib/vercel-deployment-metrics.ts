export type VercelDeployment = {
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

export type DeploymentMetric = {
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

export type MetricSummary = {
  project: string
  target: string
  count: number
  averageQueueSeconds: number
  averageBuildSeconds: number
  averageTotalSeconds: number
  maxQueueSeconds: number
  maxBuildSeconds: number
  maxTotalSeconds: number
}

export type DeploymentMetricThresholds = {
  queueWatchSeconds: number
  queueBlockedSeconds: number
  buildWatchSeconds: number
  buildBlockedSeconds: number
}

export type MetricPressure = 'normal' | 'watch' | 'blocked'

export type MetricFinding = {
  severity: MetricPressure
  project: string
  target: string
  state: string
  url: string
  reason: string
  guidance: string
}

export const DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS: DeploymentMetricThresholds = {
  queueWatchSeconds: 5 * 60,
  queueBlockedSeconds: 10 * 60,
  buildWatchSeconds: 8 * 60,
  buildBlockedSeconds: 15 * 60,
}

export function secondsBetween(end: number | undefined, start: number | undefined): number | null {
  if (!end || !start || end < start) return null
  return Math.round((end - start) / 1000)
}

export function toDeploymentMetric(
  project: string,
  deployment: VercelDeployment,
  now = Date.now()
): DeploymentMetric {
  const target = deployment.target ?? 'preview'
  const createdAt = deployment.createdAt
  const buildingAt = deployment.buildingAt
  const readyAt = deployment.ready

  const queueSeconds = buildingAt
    ? secondsBetween(buildingAt, createdAt)
    : deployment.state === 'QUEUED'
      ? secondsBetween(now, createdAt)
      : null

  const buildSeconds =
    readyAt && buildingAt
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

function max(values: Array<number | null>): number {
  const finite = values.filter((value): value is number => Number.isFinite(value))
  if (finite.length === 0) return 0
  return Math.max(...finite)
}

export function summarizeDeploymentMetrics(metrics: DeploymentMetric[]): MetricSummary[] {
  const readyMetrics = metrics.filter(
    (metric) => metric.state === 'READY' && metric.totalSeconds !== null
  )
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
        maxQueueSeconds: max(group.map((metric) => metric.queueSeconds)),
        maxBuildSeconds: max(group.map((metric) => metric.buildSeconds)),
        maxTotalSeconds: max(group.map((metric) => metric.totalSeconds)),
      }
    })
    .sort((a, b) => a.project.localeCompare(b.project) || a.target.localeCompare(b.target))
}

function pressureForSeconds(
  seconds: number | null,
  watchSeconds: number,
  blockedSeconds: number
): MetricPressure {
  if (seconds === null) return 'normal'
  if (seconds >= blockedSeconds) return 'blocked'
  if (seconds >= watchSeconds) return 'watch'
  return 'normal'
}

function higherPressure(a: MetricPressure, b: MetricPressure): MetricPressure {
  const rank: Record<MetricPressure, number> = { normal: 0, watch: 1, blocked: 2 }
  return rank[a] >= rank[b] ? a : b
}

export function classifyDeploymentMetric(
  metric: DeploymentMetric,
  thresholds: DeploymentMetricThresholds = DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS
): MetricFinding | null {
  const queuePressure = pressureForSeconds(
    metric.queueSeconds,
    thresholds.queueWatchSeconds,
    thresholds.queueBlockedSeconds
  )
  const buildPressure = pressureForSeconds(
    metric.buildSeconds,
    thresholds.buildWatchSeconds,
    thresholds.buildBlockedSeconds
  )
  const severity = higherPressure(queuePressure, buildPressure)

  if (severity === 'normal') return null

  const reasons = [
    queuePressure !== 'normal' && metric.queueSeconds !== null
      ? `queue=${formatSeconds(metric.queueSeconds)}`
      : null,
    buildPressure !== 'normal' && metric.buildSeconds !== null
      ? `build=${formatSeconds(metric.buildSeconds)}`
      : null,
  ].filter(Boolean)

  const guidance =
    severity === 'blocked'
      ? 'Treat as a deployment blocker until inspected in Vercel or rerun.'
      : 'Watch this deployment path during captain sweeps; repeated hits are operating debt.'

  return {
    severity,
    project: metric.project,
    target: metric.target,
    state: metric.state,
    url: metric.url,
    reason: reasons.join(' '),
    guidance,
  }
}

export function collectDeploymentFindings(
  metrics: DeploymentMetric[],
  thresholds: DeploymentMetricThresholds = DEFAULT_DEPLOYMENT_METRIC_THRESHOLDS
): MetricFinding[] {
  return metrics
    .map((metric) => classifyDeploymentMetric(metric, thresholds))
    .filter((finding): finding is MetricFinding => finding !== null)
    .sort((a, b) => {
      const rank: Record<MetricPressure, number> = { normal: 0, watch: 1, blocked: 2 }
      return rank[b.severity] - rank[a.severity] || a.project.localeCompare(b.project)
    })
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m${remainder.toString().padStart(2, '0')}s`
}
