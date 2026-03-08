/**
 * Module Sync scan — discover spin-off candidates via GitHub API (tree of default branch).
 * Excludes registered paths, MODULE_SYNC_IGNORE, and sensitive paths.
 * Used by GET /api/admin/module-sync/scan.
 */

import { MODULE_SYNC_IGNORE } from './module-sync-config'
import { getRegisteredPortfolioPaths } from './module-sync-db'
import { parseGitHubRepoEnv } from './module-sync-db'

const GITHUB_API = 'https://api.github.com'

/** Path segments that indicate sensitive content; exclude from scan. */
const SENSITIVE_SEGMENTS = new Set([
  '.env',
  'secret',
  'credentials',
  'secrets',
])
const SENSITIVE_PREFIX = '.env'

export interface ScanCandidate {
  path: string
  reason?: string
}

export interface ScanResult {
  candidates: ScanCandidate[]
  error?: string
  rateLimitRetryAfter?: number
}

function isPathSensitive(relativePath: string): boolean {
  const segments = relativePath.split('/').filter(Boolean)
  if (segments.some((s) => s.startsWith(SENSITIVE_PREFIX))) return true
  if (segments.some((s) => SENSITIVE_SEGMENTS.has(s.toLowerCase()))) return true
  return false
}

function hasIgnoredSegment(relativePath: string): boolean {
  const segments = relativePath.split('/').filter(Boolean)
  return segments.some((s) => MODULE_SYNC_IGNORE.has(s))
}

/**
 * Fetch default branch and recursive tree for the portfolio repo (GITHUB_REPO).
 * Uses GitHub API; token must have contents:read.
 */
async function getRepoTreePaths(
  token: string | undefined
): Promise<{ paths: string[]; error?: string; rateLimitRetryAfter?: number }> {
  const parsed = parseGitHubRepoEnv(process.env.GITHUB_REPO)
  if (!parsed) {
    return { paths: [], error: 'GITHUB_REPO is not set or invalid. Use owner/repo.' }
  }
  const { owner, repo } = parsed
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers })
  if (repoRes.status === 404) {
    return { paths: [], error: 'Portfolio repo not found.' }
  }
  if (repoRes.status === 403) {
    const retryAfter = repoRes.headers.get('Retry-After')
    return {
      paths: [],
      error: 'GitHub rate limit exceeded. Try again later.',
      rateLimitRetryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    }
  }
  if (!repoRes.ok) {
    return { paths: [], error: `GitHub API error: ${repoRes.status}` }
  }
  const repoData = (await repoRes.json()) as { default_branch?: string }
  const defaultBranch = repoData.default_branch ?? 'main'

  const refRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
    { headers }
  )
  if (refRes.status === 403) {
    const retryAfter = refRes.headers.get('Retry-After')
    return {
      paths: [],
      error: 'GitHub rate limit exceeded. Try again later.',
      rateLimitRetryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    }
  }
  if (!refRes.ok) {
    return { paths: [], error: `Failed to get branch ref: ${refRes.status}` }
  }
  const refData = (await refRes.json()) as { object?: { sha?: string } }
  const commitSha = refData.object?.sha
  if (!commitSha) {
    return { paths: [], error: 'Could not get commit SHA' }
  }

  const treeRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
    { headers }
  )
  if (treeRes.status === 403) {
    const retryAfter = treeRes.headers.get('Retry-After')
    return {
      paths: [],
      error: 'GitHub rate limit exceeded. Try again later.',
      rateLimitRetryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    }
  }
  if (!treeRes.ok) {
    return { paths: [], error: `Failed to get tree: ${treeRes.status}` }
  }
  const treeData = (await treeRes.json()) as {
    tree?: Array<{ path: string; type: string }>
    truncated?: boolean
  }
  const tree = treeData.tree ?? []
  const paths = tree.filter((t) => t.type === 'blob').map((t) => t.path)
  return { paths }
}

/**
 * Heuristics: candidate dirs are
 * - client-templates/<name> that contain template.json or README (any case)
 * - top-level <name> that contains INSTALL.md
 */
function inferCandidateDirs(filePaths: string[]): Map<string, string> {
  const candidateToReason = new Map<string, string>()
  for (const p of filePaths) {
    const parts = p.split('/')
    if (parts.length >= 2 && parts[0] === 'client-templates') {
      const dir = parts.slice(0, 2).join('/')
      const file = parts[parts.length - 1]?.toLowerCase()
      if (file === 'template.json' || file === 'readme.md' || file === 'readme') {
        candidateToReason.set(dir, 'client-templates with template.json or README')
      }
    } else if (parts.length === 2 && parts[1]?.toLowerCase() === 'install.md') {
      candidateToReason.set(parts[0], 'top-level with INSTALL.md')
    }
  }
  return candidateToReason
}

/**
 * Scan the portfolio repo (via GitHub API) for spin-off candidates.
 * Excludes registered paths, ignored segments, and sensitive paths.
 */
export async function runModuleSyncScan(): Promise<ScanResult> {
  const token = process.env.GITHUB_TOKEN
  const { paths, error: apiError, rateLimitRetryAfter } = await getRepoTreePaths(token)
  if (apiError) {
    return { candidates: [], error: apiError, rateLimitRetryAfter }
  }

  const registered = await getRegisteredPortfolioPaths()
  const candidateToReason = inferCandidateDirs(paths)
  const candidates: ScanCandidate[] = []

  for (const [dir, reason] of candidateToReason) {
    if (registered.has(dir)) continue
    if (hasIgnoredSegment(dir)) continue
    if (isPathSensitive(dir)) continue
    candidates.push({ path: dir, reason })
  }

  candidates.sort((a, b) => a.path.localeCompare(b.path))
  return { candidates, rateLimitRetryAfter }
}
