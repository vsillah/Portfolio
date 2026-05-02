#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import {
  formatDeploymentWatchSummary,
  parseDeploymentWatchArgs,
  summarizeDeploymentStatus,
  type GitHubCombinedStatus,
} from '../lib/vercel-deployment-watch'

function usage(): string {
  return `Usage:
  npx tsx scripts/vercel-deployment-watch.ts [options]

Options:
  --ref <sha-or-branch>       Commit SHA or branch to watch. Defaults to main.
  --owner <owner>             GitHub owner. Defaults to vsillah.
  --repo <repo>               GitHub repo. Defaults to Portfolio.
  --contexts <a,b>            Comma-separated status contexts.
                             Defaults to both Portfolio Vercel contexts.
  --timeout <seconds>         Max wait time. Defaults to 900.
  --interval <seconds>        Poll interval. Defaults to 30.
  --once                      Print one status snapshot and exit.
  --help                      Show this help.

Exit codes:
  0 success
  1 failed or command error
  2 timed out while pending
`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fetchCombinedStatus(owner: string, repo: string, ref: string): GitHubCombinedStatus {
  const endpoint = `repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/status`
  const result = spawnSync('gh', ['api', endpoint], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || 'gh api failed'
    throw new Error(message)
  }

  return JSON.parse(result.stdout) as GitHubCombinedStatus
}

async function main(): Promise<void> {
  let options

  try {
    options = parseDeploymentWatchArgs(process.argv.slice(2))
  } catch (error) {
    if (error instanceof Error && error.message === 'HELP_REQUESTED') {
      console.log(usage())
      process.exit(0)
    }

    console.error(error instanceof Error ? error.message : error)
    console.error('')
    console.error(usage())
    process.exit(1)
  }

  const startedAt = Date.now()
  const timeoutMs = options.timeoutSeconds * 1000
  let attempt = 0

  while (true) {
    attempt += 1

    try {
      const combinedStatus = fetchCombinedStatus(options.owner, options.repo, options.ref)
      const summary = summarizeDeploymentStatus(combinedStatus, options.contexts)

      console.log(`\n[attempt ${attempt}] ${new Date().toISOString()}`)
      console.log(formatDeploymentWatchSummary(summary))

      if (summary.state === 'success') {
        process.exit(0)
      }

      if (summary.state === 'failed') {
        process.exit(1)
      }

      if (options.once) {
        process.exit(2)
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    }

    if (Date.now() - startedAt >= timeoutMs) {
      console.error(
        `Timed out after ${options.timeoutSeconds}s while waiting for Vercel deployment contexts.`
      )
      process.exit(2)
    }

    await sleep(options.intervalSeconds * 1000)
  }
}

main()
