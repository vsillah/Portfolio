export const DEFAULT_VERCEL_CONTEXTS = [
  'Vercel – portfolio',
  'Vercel – portfolio-staging',
] as const

export type DeploymentWatchState = 'success' | 'pending' | 'failed' | 'missing'

export type GitHubCommitStatus = {
  context: string
  state: string
  target_url?: string | null
  description?: string | null
  updated_at?: string | null
}

export type GitHubCombinedStatus = {
  state: string
  statuses?: GitHubCommitStatus[]
}

export type WatchedDeploymentContext = {
  context: string
  state: DeploymentWatchState
  rawState?: string
  targetUrl?: string
  description?: string
  updatedAt?: string
}

export type DeploymentWatchSummary = {
  state: DeploymentWatchState
  contexts: WatchedDeploymentContext[]
  missingContexts: string[]
  failedContexts: WatchedDeploymentContext[]
  pendingContexts: WatchedDeploymentContext[]
}

export type DeploymentWatchOptions = {
  ref: string
  owner: string
  repo: string
  contexts: string[]
  timeoutSeconds: number
  intervalSeconds: number
  once: boolean
}

const DEFAULT_OPTIONS: DeploymentWatchOptions = {
  ref: 'main',
  owner: 'vsillah',
  repo: 'Portfolio',
  contexts: [...DEFAULT_VERCEL_CONTEXTS],
  timeoutSeconds: 900,
  intervalSeconds: 30,
  once: false,
}

function normalizeState(state: string | undefined): DeploymentWatchState {
  if (state === 'success') return 'success'
  if (state === 'failure' || state === 'error' || state === 'cancelled') return 'failed'
  if (state === 'pending') return 'pending'
  return 'pending'
}

function latestStatusByContext(statuses: GitHubCommitStatus[]): Map<string, GitHubCommitStatus> {
  const byContext = new Map<string, GitHubCommitStatus>()

  for (const status of statuses) {
    const current = byContext.get(status.context)
    const currentTime = current?.updated_at ? Date.parse(current.updated_at) : 0
    const nextTime = status.updated_at ? Date.parse(status.updated_at) : 0

    if (!current || nextTime >= currentTime) {
      byContext.set(status.context, status)
    }
  }

  return byContext
}

export function summarizeDeploymentStatus(
  combinedStatus: GitHubCombinedStatus,
  contexts: string[] = [...DEFAULT_VERCEL_CONTEXTS]
): DeploymentWatchSummary {
  const byContext = latestStatusByContext(combinedStatus.statuses ?? [])

  const watchedContexts = contexts.map((context) => {
    const status = byContext.get(context)

    if (!status) {
      return {
        context,
        state: 'missing' as const,
      }
    }

    return {
      context,
      state: normalizeState(status.state),
      rawState: status.state,
      targetUrl: status.target_url ?? undefined,
      description: status.description ?? undefined,
      updatedAt: status.updated_at ?? undefined,
    }
  })

  const missingContexts = watchedContexts
    .filter((status) => status.state === 'missing')
    .map((status) => status.context)
  const failedContexts = watchedContexts.filter((status) => status.state === 'failed')
  const pendingContexts = watchedContexts.filter(
    (status) => status.state === 'pending' || status.state === 'missing'
  )

  let state: DeploymentWatchState = 'success'
  if (failedContexts.length > 0) state = 'failed'
  else if (pendingContexts.length > 0) state = 'pending'

  return {
    state,
    contexts: watchedContexts,
    missingContexts,
    failedContexts,
    pendingContexts,
  }
}

export function parseDeploymentWatchArgs(argv: string[]): DeploymentWatchOptions {
  const options: DeploymentWatchOptions = {
    ...DEFAULT_OPTIONS,
    contexts: [...DEFAULT_OPTIONS.contexts],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--ref' && next) {
      options.ref = next
      index += 1
    } else if (arg === '--owner' && next) {
      options.owner = next
      index += 1
    } else if (arg === '--repo' && next) {
      options.repo = next
      index += 1
    } else if (arg === '--timeout' && next) {
      options.timeoutSeconds = Number(next)
      index += 1
    } else if (arg === '--interval' && next) {
      options.intervalSeconds = Number(next)
      index += 1
    } else if (arg === '--contexts' && next) {
      options.contexts = next
        .split(',')
        .map((context) => context.trim())
        .filter(Boolean)
      index += 1
    } else if (arg === '--once') {
      options.once = true
    } else if (arg === '--help' || arg === '-h') {
      throw new Error('HELP_REQUESTED')
    }
  }

  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new Error('--timeout must be a positive number of seconds')
  }

  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds <= 0) {
    throw new Error('--interval must be a positive number of seconds')
  }

  if (options.contexts.length === 0) {
    throw new Error('--contexts must include at least one status context')
  }

  return options
}

export function formatDeploymentWatchSummary(summary: DeploymentWatchSummary): string {
  const lines = [`deployment_state=${summary.state}`]

  for (const status of summary.contexts) {
    const details = [
      `context="${status.context}"`,
      `state=${status.state}`,
      status.rawState ? `raw=${status.rawState}` : undefined,
      status.updatedAt ? `updated_at=${status.updatedAt}` : undefined,
      status.description ? `description="${status.description}"` : undefined,
      status.targetUrl ? `url=${status.targetUrl}` : undefined,
    ].filter(Boolean)

    lines.push(details.join(' '))
  }

  return lines.join('\n')
}
