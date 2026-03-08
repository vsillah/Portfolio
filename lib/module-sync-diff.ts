/**
 * Diff portfolio module path vs. GitHub repo (default branch).
 * Used by Admin → Module Sync API.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as diff from 'diff'
import {
  MODULE_SYNC_IGNORE,
  GITHUB_DEFAULT_BRANCH_FALLBACK,
  type ModuleSyncEntry,
} from './module-sync-config'

const GITHUB_API = 'https://api.github.com'

export interface DiffFileResult {
  path: string
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  patch?: string
  portfolioContent?: string
  repoContent?: string
}

export interface ModuleDiffResult {
  moduleId: string
  moduleName: string
  portfolioPath: string
  repoUrl: string
  repoBranch: string
  summary: { added: number; removed: number; modified: number; unchanged: number }
  files: DiffFileResult[]
  error?: string
  /** When true, the GitHub repo returned 404 (deleted or not found). UI can offer "Remove from module list" for custom modules. */
  repoNotFound?: boolean
}

/**
 * Recursively list files under dir, relative to baseDir. Skips MODULE_SYNC_IGNORE.
 */
async function listPortfolioFiles(
  baseDir: string,
  dir: string,
  relativeSoFar: string
): Promise<string[]> {
  const entries = await fs.promises.readdir(path.join(baseDir, dir), { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    if (MODULE_SYNC_IGNORE.has(e.name)) continue
    const rel = relativeSoFar ? `${relativeSoFar}/${e.name}` : e.name
    const full = path.join(baseDir, dir, e.name)
    if (e.isDirectory()) {
      const sub = await listPortfolioFiles(baseDir, path.join(dir, e.name), rel)
      files.push(...sub)
    } else if (e.isFile()) {
      files.push(rel)
    }
  }
  return files
}

/**
 * Read portfolio directory and return map of relative path -> content (utf-8).
 * Binary files are skipped (we don't diff them).
 */
export async function readPortfolioModule(
  projectRoot: string,
  portfolioPath: string
): Promise<Map<string, string>> {
  const fullPath = path.join(projectRoot, portfolioPath)
  const stat = await fs.promises.stat(fullPath).catch(() => null)
  if (!stat || !stat.isDirectory()) {
    return new Map()
  }

  const relPaths = await listPortfolioFiles(projectRoot, portfolioPath, '')
  const map = new Map<string, string>()
  for (const rel of relPaths) {
    const abs = path.join(projectRoot, portfolioPath, rel)
    try {
      const buf = await fs.promises.readFile(abs)
      if (!buf.length) {
        map.set(rel, '')
        continue
      }
      const str = buf.toString('utf-8')
      if (!str && buf.length > 0) continue
      map.set(rel, str)
    } catch {
      continue
    }
  }
  return map
}

/**
 * Parse GitHub repo URL to owner and repo name.
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\/$/, '')
  const match = trimmed.match(/github\.com[/:](\w[\w.-]*)\/([\w.-]+?)(?:\.git)?$/i)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

/**
 * Fetch default branch for repo.
 */
async function getDefaultBranch(owner: string, repo: string, token?: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new Error(`GitHub repo fetch failed: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { default_branch?: string }
  return data.default_branch ?? GITHUB_DEFAULT_BRANCH_FALLBACK
}

/**
 * Fetch recursive tree for ref (branch). Returns list of { path, sha, type }.
 */
async function getRepoTree(
  owner: string,
  repo: string,
  ref: string,
  token?: string
): Promise<Array<{ path: string; sha: string; type: string }>> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (!res.ok) {
    throw new Error(`GitHub tree fetch failed: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { tree?: Array<{ path: string; sha: string; type: string }> }
  return data.tree ?? []
}

/**
 * Fetch blob content (decoded from base64).
 */
async function getBlobContent(
  owner: string,
  repo: string,
  sha: string,
  token?: string
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs/${sha}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new Error(`GitHub blob fetch failed: ${res.status}`)
  }
  const data = (await res.json()) as { content?: string; encoding?: string }
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  return (data.content as string) ?? ''
}

/**
 * Build map of path -> content for repo (default branch). Only text files (we skip binary by trying utf-8).
 */
export async function readGitHubModule(
  owner: string,
  repo: string,
  token?: string
): Promise<{ branch: string; files: Map<string, string> }> {
  const branch = await getDefaultBranch(owner, repo, token)
  const refRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (!refRes.ok) {
    throw new Error(`GitHub ref fetch failed: ${refRes.status}`)
  }
  const refData = (await refRes.json()) as { object?: { sha?: string } }
  const treeSha = refData.object?.sha
  if (!treeSha) throw new Error('Could not get tree SHA')

  const tree = await getRepoTree(owner, repo, treeSha, token)
  const blobs = tree.filter((t) => t.type === 'blob')
  const files = new Map<string, string>()

  for (const b of blobs) {
    try {
      const content = await getBlobContent(owner, repo, b.sha, token)
      files.set(b.path, content)
    } catch {
      continue
    }
  }

  return { branch, files }
}

/**
 * Compare portfolio map vs repo map and produce DiffFileResult[] with patches for modified files.
 */
export function computeDiff(
  portfolioFiles: Map<string, string>,
  repoFiles: Map<string, string>
): DiffFileResult[] {
  const allPaths = new Set([...portfolioFiles.keys(), ...repoFiles.keys()])
  const results: DiffFileResult[] = []

  for (const p of allPaths) {
    const portfolioContent = portfolioFiles.get(p)
    const repoContent = repoFiles.get(p)

    if (portfolioContent !== undefined && repoContent === undefined) {
      results.push({ path: p, status: 'added', portfolioContent })
      continue
    }
    if (portfolioContent === undefined && repoContent !== undefined) {
      results.push({ path: p, status: 'removed', repoContent })
      continue
    }
    if (portfolioContent === repoContent) {
      results.push({ path: p, status: 'unchanged' })
      continue
    }
    const patch = diff.createPatch(p, repoContent ?? '', portfolioContent ?? '', 'repo', 'portfolio')
    results.push({
      path: p,
      status: 'modified',
      patch,
      portfolioContent: portfolioContent ?? '',
      repoContent: repoContent ?? '',
    })
  }

  return results.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Run full diff for a module: read portfolio, read GitHub repo, compare.
 */
export async function runModuleDiff(
  entry: ModuleSyncEntry,
  projectRoot: string,
  githubToken?: string
): Promise<ModuleDiffResult> {
  const result: ModuleDiffResult = {
    moduleId: entry.id,
    moduleName: entry.name,
    portfolioPath: entry.portfolioPath,
    repoUrl: entry.spunOffRepoUrl ?? '',
    repoBranch: '',
    summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    files: [],
  }

  if (!entry.spunOffRepoUrl?.trim()) {
    result.error = 'No spun-off repo URL configured for this module.'
    return result
  }

  const parsed = parseGitHubRepoUrl(entry.spunOffRepoUrl)
  if (!parsed) {
    result.error = 'Invalid GitHub repo URL. Use https://github.com/owner/repo'
    return result
  }

  try {
    const [portfolioFiles, { branch, files: repoFiles }] = await Promise.all([
      readPortfolioModule(projectRoot, entry.portfolioPath),
      readGitHubModule(parsed.owner, parsed.repo, githubToken),
    ])

    result.repoBranch = branch
    const fileResults = computeDiff(portfolioFiles, repoFiles)
    result.files = fileResults

    for (const f of fileResults) {
      if (f.status === 'added') result.summary.added++
      else if (f.status === 'removed') result.summary.removed++
      else if (f.status === 'modified') result.summary.modified++
      else result.summary.unchanged++
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.error = msg
    if (/404|not found/i.test(msg)) {
      result.repoNotFound = true
      result.error = 'Repo not found or deleted on GitHub.'
    }
  }

  return result
}
