import { stableProductIdentity, buildApprovedSourceProjection, type SocialTopicSourceProjection } from '@/lib/social-topic-source-receipts'

const GITHUB_API = 'https://api.github.com'
const DEFAULT_GITHUB_CONCURRENCY = 4
const DEFAULT_GITHUB_REQUEST_TIMEOUT_MS = 8_000
const DEFAULT_GITHUB_COLLECTOR_TIMEOUT_MS = 40_000

export type GitHubActivityCollection = {
  projections: SocialTopicSourceProjection[]
  blockers: string[]
  repositories_scanned: number
  private_repositories_rejected: number
  private_repositories_summarized: number
  read_only: true
}

type PrototypeRepoRow = {
  id: string
  title?: string | null
  description?: string | null
  app_repo_url?: string | null
  updated_at?: string | null
}

type GitHubRepository = {
  id?: number
  full_name?: string
  html_url?: string
  private?: boolean
  default_branch?: string
  pushed_at?: string | null
  updated_at?: string | null
}

type GitHubBranch = { name?: string; commit?: { sha?: string } }
type GitHubPullRequest = { number?: number; title?: string; state?: string; draft?: boolean; html_url?: string; updated_at?: string | null; merged_at?: string | null }
type GitHubDeployment = { id?: number; environment?: string; created_at?: string | null; updated_at?: string | null; statuses_url?: string }
type GitHubDeploymentStatus = { id?: number; state?: string; environment_url?: string | null; created_at?: string | null; updated_at?: string | null }

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parsePublicGitHubRepoUrl(value: unknown) {
  const text = asString(value)
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return null
    const [owner, repo] = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
    if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null
    return { owner, repo: repo.replace(/\.git$/i, ''), url: `https://github.com/${owner}/${repo.replace(/\.git$/i, '')}` }
  } catch {
    return null
  }
}

function productTopics(productIdentity: string, label: string) {
  if (productIdentity === 'dark_castle_chess') {
    return ['chess_product_development', 'explainable_chess_learning', 'learning_mode']
  }
  return [...new Set([
    productIdentity,
    label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
  ].filter(Boolean))]
}

async function githubJson<T>(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    throw new Error('github_request_timeout: GitHub collector time budget was exhausted before the request started; retry the scan or reduce the repository set.')
  }
  const token = process.env.GITHUB_TOKEN?.trim()
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after')
      const rateLimitReset = response.headers.get('x-ratelimit-reset')
      const rateLimited = response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0'
      if (rateLimited) {
        const resetAt = rateLimitReset && Number.isFinite(Number(rateLimitReset))
          ? new Date(Number(rateLimitReset) * 1000).toISOString()
          : null
        throw new Error(`github_rate_limited: GitHub returned ${response.status}; retry ${retryAfter ? `after ${retryAfter} seconds` : resetAt ? `after ${resetAt}` : 'after the integration rate limit resets'}.`)
      }
      throw new Error(`github_read_failed: GitHub returned ${response.status} for a read-only activity request.`)
    }
    return response.json() as Promise<T>
  } catch (error) {
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error(`github_request_timeout: GitHub did not answer within ${timeoutMs}ms; retry the scan after checking integration availability.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function safeIso(value: unknown, fallback: string) {
  const text = asString(value)
  return Number.isFinite(Date.parse(text)) ? text : fallback
}

function blockerForRepository(productIdentity: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Read-only GitHub activity collection failed.'
  if (message.startsWith('github_rate_limited:')) {
    return `[github_rate_limited:${productIdentity}]${message.slice('github_rate_limited:'.length)}`
  }
  if (message.startsWith('github_request_timeout:')) {
    return `[github_request_timeout:${productIdentity}]${message.slice('github_request_timeout:'.length)}`
  }
  return `[github_activity_collection_failed:${productIdentity}] ${message}`
}

async function mapWithBoundedConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }))
  return results
}

type RepositoryCollectionResult = {
  projections: SocialTopicSourceProjection[]
  blockers: string[]
  repositoriesScanned: number
  privateRepositoriesRejected: number
  privateRepositoriesSummarized: number
}

export async function collectDirectGitHubActivityProjections(options: {
  prototypeRows?: PrototypeRepoRow[]
  fetchImpl?: typeof fetch
  generatedAt?: string
  concurrency?: number
  requestTimeoutMs?: number
  collectorTimeoutMs?: number
} = {}): Promise<GitHubActivityCollection> {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const fetchImpl = options.fetchImpl ?? fetch
  const concurrency = Math.min(8, Math.max(1, Math.floor(options.concurrency ?? DEFAULT_GITHUB_CONCURRENCY)))
  const requestTimeoutMs = Math.max(25, Math.floor(options.requestTimeoutMs ?? DEFAULT_GITHUB_REQUEST_TIMEOUT_MS))
  const collectorTimeoutMs = Math.max(requestTimeoutMs, Math.floor(options.collectorTimeoutMs ?? DEFAULT_GITHUB_COLLECTOR_TIMEOUT_MS))
  const collectorDeadline = Date.now() + collectorTimeoutMs
  let rows = options.prototypeRows
  if (!rows) {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { data, error } = await supabaseAdmin
      .from('app_prototypes')
      .select('id, title, description, app_repo_url, updated_at')
      .not('app_repo_url', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) throw new Error(`github_product_mapping_read_failed:${error.message}`)
    rows = (data ?? []) as PrototypeRepoRow[]
  }

  const repositoryRows = rows
    .map((row) => ({ row, repoRef: parsePublicGitHubRepoUrl(row.app_repo_url) }))
    .filter((item): item is { row: PrototypeRepoRow; repoRef: NonNullable<ReturnType<typeof parsePublicGitHubRepoUrl>> } => Boolean(item.repoRef))
    .sort((a, b) => `${a.repoRef.owner}/${a.repoRef.repo}/${a.row.id}`.localeCompare(`${b.repoRef.owner}/${b.repoRef.repo}/${b.row.id}`))

  const repositoryResults = await mapWithBoundedConcurrency(repositoryRows, concurrency, async ({ row, repoRef }): Promise<RepositoryCollectionResult> => {
    const projections: SocialTopicSourceProjection[] = []
    const blockers: string[] = []
    const label = asString(row.title) || repoRef.repo
    const productIdentity = stableProductIdentity(label, row.description, repoRef.repo)
    const topics = productTopics(productIdentity, label)
    const remainingTimeout = () => Math.min(requestTimeoutMs, collectorDeadline - Date.now())
    try {
      const repo = await githubJson<GitHubRepository>(`${GITHUB_API}/repos/${repoRef.owner}/${repoRef.repo}`, fetchImpl, remainingTimeout())
      const privateRepository = repo.private === true
      if (privateRepository && !process.env.GITHUB_TOKEN?.trim()) {
        blockers.push(`[github_private_repository_requires_configured_token:${productIdentity}] Private repository activity requires the configured read-only GitHub integration.`)
        return { projections, blockers, repositoriesScanned: 0, privateRepositoriesRejected: 1, privateRepositoriesSummarized: 0 }
      }
      const [branches, pulls, deployments] = await Promise.all([
        githubJson<GitHubBranch[]>(`${GITHUB_API}/repos/${repoRef.owner}/${repoRef.repo}/branches?per_page=20`, fetchImpl, remainingTimeout()),
        githubJson<GitHubPullRequest[]>(`${GITHUB_API}/repos/${repoRef.owner}/${repoRef.repo}/pulls?state=all&sort=updated&direction=desc&per_page=20`, fetchImpl, remainingTimeout()),
        githubJson<GitHubDeployment[]>(`${GITHUB_API}/repos/${repoRef.owner}/${repoRef.repo}/deployments?per_page=20`, fetchImpl, remainingTimeout()),
      ])
      const deploymentStatuses = (await Promise.all(deployments.slice(0, 10).map(async (deployment) => {
        if (!deployment.statuses_url) return null
        const statuses = await githubJson<GitHubDeploymentStatus[]>(deployment.statuses_url, fetchImpl, remainingTimeout())
        return { deployment, status: statuses[0] ?? null }
      }))).filter((item): item is NonNullable<typeof item> => Boolean(item))
      const observedAt = safeIso(
        [repo.pushed_at, repo.updated_at, pulls[0]?.updated_at, deploymentStatuses[0]?.status?.updated_at]
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1),
        generatedAt,
      )
      const base = {
        productIdentity,
        label,
        privacyClassification: privateRepository ? 'client_safe_summary' as const : 'public_safe' as const,
        approvedAt: observedAt,
        approvedBy: privateRepository ? 'github_authenticated_api' : 'github_public_api',
        observedAt,
        evidenceUrl: repo.html_url || repoRef.url,
        metadata: {
          collector: privateRepository ? 'github_authenticated_api_read_only' : 'github_public_api_read_only',
          repository: repo.full_name || `${repoRef.owner}/${repoRef.repo}`,
          repository_visibility: privateRepository ? 'private_summary' : 'public',
          topic_identities: topics,
          raw_private_content_included: false,
        },
      }
      projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'github_development', sourceKind: 'github_repository_activity', sourceId: `github:${repo.id ?? repo.full_name}:repository`, lifecycleStage: 'in_development',
        approvedSummary: `${label} has current ${privateRepository ? 'authenticated' : 'public'} repository activity on its default branch; this proves visible development activity only.`,
        provenance: `github_public_api:${repo.full_name}:repository`,
      }))
      if (branches.length > 0) projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'github_development', sourceKind: 'github_branch_activity', sourceId: `github:${repo.id ?? repo.full_name}:branches`, lifecycleStage: 'in_development',
        approvedSummary: `${label} exposes ${branches.length} current branch${branches.length === 1 ? '' : 'es'} through the read-only GitHub integration; branch presence does not prove deployment.`,
        provenance: `github_public_api:${repo.full_name}:branches`,
        metadata: { ...base.metadata, branch_count: branches.length, default_branch: repo.default_branch || null },
      }))
      if (pulls.length > 0) projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: `github:${repo.id ?? repo.full_name}:pulls`, lifecycleStage: 'in_development',
        approvedSummary: `${label} has ${pulls.length} recent pull-request record${pulls.length === 1 ? '' : 's'}; the latest visible state is ${pulls[0].state || 'unknown'} and does not prove release.`,
        provenance: `github_public_api:${repo.full_name}:pulls`,
        evidenceUrl: pulls[0].html_url || repo.html_url || repoRef.url,
        metadata: { ...base.metadata, pull_request_count: pulls.length, latest_pull_request_number: pulls[0].number ?? null, latest_pull_request_state: pulls[0].state ?? null },
      }))
      if (deploymentStatuses.length > 0) {
        const productionSuccess = deploymentStatuses.some(({ deployment, status }) => deployment.environment?.toLowerCase() === 'production' && status?.state === 'success')
        const latest = deploymentStatuses[0]
        projections.push(buildApprovedSourceProjection({
          ...base,
          sourceGroup: 'github_development', sourceKind: 'github_deployment_status_activity', sourceId: `github:${repo.id ?? repo.full_name}:deployments`, lifecycleStage: productionSuccess ? 'production_deployed' : 'preview_deployed',
          approvedSummary: `${label} has ${deploymentStatuses.length} GitHub deployment-status record${deploymentStatuses.length === 1 ? '' : 's'}; the latest visible state is ${latest.status?.state || 'unknown'} for ${latest.deployment.environment || 'an unspecified environment'}.`,
          provenance: `github_public_api:${repo.full_name}:deployment_statuses`,
          evidenceUrl: latest.status?.environment_url || repo.html_url || repoRef.url,
          observedAt: safeIso(latest.status?.updated_at || latest.deployment.updated_at || latest.deployment.created_at, observedAt),
          metadata: { ...base.metadata, deployment_status_count: deploymentStatuses.length, latest_deployment_state: latest.status?.state ?? null, latest_deployment_environment: latest.deployment.environment ?? null },
        }))
      }
      return {
        projections,
        blockers,
        repositoriesScanned: 1,
        privateRepositoriesRejected: 0,
        privateRepositoriesSummarized: privateRepository ? 1 : 0,
      }
    } catch (error) {
      blockers.push(blockerForRepository(productIdentity, error))
      return { projections: [], blockers, repositoriesScanned: 0, privateRepositoriesRejected: 0, privateRepositoriesSummarized: 0 }
    }
  })

  return {
    projections: repositoryResults.flatMap((result) => result.projections),
    blockers: repositoryResults.flatMap((result) => result.blockers),
    repositories_scanned: repositoryResults.reduce((total, result) => total + result.repositoriesScanned, 0),
    private_repositories_rejected: repositoryResults.reduce((total, result) => total + result.privateRepositoriesRejected, 0),
    private_repositories_summarized: repositoryResults.reduce((total, result) => total + result.privateRepositoriesSummarized, 0),
    read_only: true,
  }
}
