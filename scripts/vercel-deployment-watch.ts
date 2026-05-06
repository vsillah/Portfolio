#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import {
  formatDeploymentWatchSummary,
  getDeploymentWatchGuidance,
  parseDeploymentWatchArgs,
  summarizeDeploymentStatus,
  type DeploymentWatchSummary,
  type GitHubCombinedStatus,
} from '../lib/vercel-deployment-watch'

type AgentRunModule = typeof import('../lib/agent-run')

let agentRunModulePromise: Promise<AgentRunModule> | null = null

function loadAgentRunModule() {
  agentRunModulePromise ??= import('../lib/agent-run')
  return agentRunModulePromise
}

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
  --trace                     Write the final watcher output to Agent Operations.
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

async function startTraceRun(options: ReturnType<typeof parseDeploymentWatchArgs>) {
  if (!options.trace) return null

  try {
    const { startAgentRun } = await loadAgentRunModule()
    const run = await startAgentRun({
      agentKey: 'engineering-copilot',
      runtime: 'manual',
      kind: 'agent_ops_deployment_watch',
      title: `Watch Vercel deployment contexts for ${options.ref}`,
      subject: { type: 'deployment', id: options.ref, label: `${options.owner}/${options.repo}` },
      triggerSource: 'vercel_deployment_watch_script',
      currentStep: 'Watching Vercel deployment contexts',
      metadata: {
        ref: options.ref,
        owner: options.owner,
        repo: options.repo,
        contexts: options.contexts,
        timeout_seconds: options.timeoutSeconds,
        interval_seconds: options.intervalSeconds,
        once: options.once,
      },
    })

    return run.id
  } catch (error) {
    console.warn(
      `[deploy:watch] Agent Ops trace unavailable: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

async function recordTraceAttempt(input: {
  runId: string | null
  attempt: number
  summary: DeploymentWatchSummary
  guidance: string[]
}) {
  if (!input.runId) return

  const { recordAgentStep } = await loadAgentRunModule()
  await recordAgentStep({
    runId: input.runId,
    stepKey: `deployment_watch_attempt_${input.attempt}`,
    name: `Deployment watch attempt ${input.attempt}`,
    status: input.summary.state === 'failed' ? 'failed' : 'completed',
    outputSummary: `Deployment state: ${input.summary.state}`,
    metadata: {
      deployment_state: input.summary.state,
      contexts: input.summary.contexts,
      guidance: input.guidance,
    },
    idempotencyKey: `${input.runId}:attempt:${input.attempt}`,
  }).catch((error) => {
    console.warn(
      `[deploy:watch] Could not record trace attempt: ${error instanceof Error ? error.message : String(error)}`,
    )
  })
}

async function finishTrace(input: {
  runId: string | null
  options: ReturnType<typeof parseDeploymentWatchArgs>
  summary: DeploymentWatchSummary | null
  guidance: string[]
  attempts: number
  exitStatus: 'completed' | 'failed' | 'cancelled' | 'stale'
  errorMessage?: string | null
}) {
  if (!input.runId || !input.summary) return

  const { attachAgentArtifact, endAgentRun } = await loadAgentRunModule()
  const artifactMarkdown = [
    '# Vercel Deployment Watch',
    '',
    `Ref: ${input.options.ref}`,
    `Repo: ${input.options.owner}/${input.options.repo}`,
    `State: ${input.summary.state}`,
    `Attempts: ${input.attempts}`,
    '',
    '## Contexts',
    '',
    ...input.summary.contexts.map((context) => `- ${context.context}: ${context.state}`),
    '',
    '## Guidance',
    '',
    ...input.guidance.map((item) => `- ${item}`),
  ].join('\n')

  await attachAgentArtifact({
    runId: input.runId,
    artifactType: 'agent_ops_deployment_watch',
    title: `Vercel deployment watch - ${input.summary.state}`,
    refType: 'git_ref',
    refId: input.options.ref,
    metadata: {
      summary_markdown: artifactMarkdown,
      deployment_state: input.summary.state,
      contexts: input.summary.contexts,
      guidance: input.guidance,
      attempts: input.attempts,
    },
    idempotencyKey: `${input.runId}:artifact:deployment-watch`,
  }).catch((error) => {
    console.warn(
      `[deploy:watch] Could not attach trace artifact: ${error instanceof Error ? error.message : String(error)}`,
    )
  })

  await endAgentRun({
    runId: input.runId,
    status: input.exitStatus,
    currentStep: `Deployment watch ${input.summary.state}`,
    errorMessage: input.errorMessage ?? null,
    outcome: {
      deployment_state: input.summary.state,
      ref: input.options.ref,
      owner: input.options.owner,
      repo: input.options.repo,
      contexts: input.summary.contexts,
      guidance: input.guidance,
      attempts: input.attempts,
    },
  }).catch((error) => {
    console.warn(
      `[deploy:watch] Could not finish trace run: ${error instanceof Error ? error.message : String(error)}`,
    )
  })
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
  let traceRunId: string | null = await startTraceRun(options)
  let latestSummary: DeploymentWatchSummary | null = null
  let latestGuidance: string[] = []

  while (true) {
    attempt += 1

    try {
      const combinedStatus = fetchCombinedStatus(options.owner, options.repo, options.ref)
      const summary = summarizeDeploymentStatus(combinedStatus, options.contexts)
      const guidance = getDeploymentWatchGuidance(summary)
      latestSummary = summary
      latestGuidance = guidance

      console.log(`\n[attempt ${attempt}] ${new Date().toISOString()}`)
      console.log(formatDeploymentWatchSummary(summary))
      console.log(guidance.join('\n'))
      await recordTraceAttempt({ runId: traceRunId, attempt, summary, guidance })

      if (summary.state === 'success') {
        await finishTrace({
          runId: traceRunId,
          options,
          summary,
          guidance,
          attempts: attempt,
          exitStatus: 'completed',
        })
        process.exit(0)
      }

      if (summary.state === 'failed') {
        await finishTrace({
          runId: traceRunId,
          options,
          summary,
          guidance,
          attempts: attempt,
          exitStatus: 'failed',
          errorMessage: 'A required Vercel deployment context failed.',
        })
        process.exit(1)
      }

      if (options.once) {
        await finishTrace({
          runId: traceRunId,
          options,
          summary,
          guidance,
          attempts: attempt,
          exitStatus: 'completed',
        })
        process.exit(2)
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      if (traceRunId) {
        const { markAgentRunFailed } = await loadAgentRunModule()
        await markAgentRunFailed(
          traceRunId,
          error instanceof Error ? error.message : 'Deployment watch failed',
          { ref: options.ref, owner: options.owner, repo: options.repo },
        ).catch(() => {})
      }
      process.exit(1)
    }

    if (Date.now() - startedAt >= timeoutMs) {
      const message = `Timed out after ${options.timeoutSeconds}s while waiting for Vercel deployment contexts.`
      console.error(message)
      await finishTrace({
        runId: traceRunId,
        options,
        summary: latestSummary,
        guidance: latestGuidance,
        attempts: attempt,
        exitStatus: 'failed',
        errorMessage: message,
      })
      process.exit(2)
    }

    await sleep(options.intervalSeconds * 1000)
  }
}

main()
