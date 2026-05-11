#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import {
  buildVercelResearchPlan,
  formatVercelResearchPlanMarkdown,
  type VercelResearchPlan,
} from '../lib/vercel-deployment-research'
import type { DeploymentMetric } from '../lib/vercel-deployment-metrics'

type MetricsOutput = {
  metrics?: DeploymentMetric[]
}

export function parseArgs(argv: string[]) {
  const options = {
    json: false,
    limit: 20,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--json') {
      options.json = true
    } else if (arg === '--limit' && next) {
      options.limit = Number(next)
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run deploy:research:plan -- [options]

Options:
  --limit <n>  Number of recent deployments per Vercel project to inspect. Defaults to 20.
  --json       Print machine-readable output.
`)
      process.exit(0)
    }
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    throw new Error('--limit must be a positive number')
  }

  return options
}

function readDeploymentMetrics(limit: number): DeploymentMetric[] {
  const result = spawnSync('tsx', ['scripts/vercel-deployment-metrics.ts', '--json', '--limit', String(limit)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || 'deploy:metrics failed'
    throw new Error(message)
  }

  const parsed = JSON.parse(result.stdout) as MetricsOutput
  return parsed.metrics ?? []
}

export function buildPlanFromMetrics(metrics: DeploymentMetric[]): VercelResearchPlan {
  return buildVercelResearchPlan({ metrics })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const plan = buildPlanFromMetrics(readDeploymentMetrics(options.limit))
  if (options.json) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }
  console.log(formatVercelResearchPlanMarkdown(plan))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
