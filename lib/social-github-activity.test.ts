import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))

import { collectDirectGitHubActivityProjections, parsePublicGitHubRepoUrl } from './social-github-activity'

const at = '2026-10-12T16:00:00.000Z'

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function repoName(input: string | URL | Request) {
  return String(input).match(/\/repos\/fixture\/([^/?]+)$/)?.[1] ?? null
}

describe('direct read-only GitHub activity collection', () => {
  const originalToken = process.env.GITHUB_TOKEN
  afterEach(() => {
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalToken
  })

  it('projects Dark Castle repository, branch, PR, and deployment status activity without Agent Ops receipts', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/repos/vsillah/Dark-Castle-Chess')) return response({ id: 181, full_name: 'vsillah/Dark-Castle-Chess', html_url: 'https://github.com/vsillah/Dark-Castle-Chess', private: false, default_branch: 'main', pushed_at: at, updated_at: at })
      if (url.includes('/branches?')) return response([{ name: 'main', commit: { sha: 'abc' } }, { name: 'codex/learning-mode', commit: { sha: 'def' } }])
      if (url.includes('/pulls?')) return response([{ number: 181, title: 'Learning mode', state: 'open', draft: true, html_url: 'https://github.com/vsillah/Dark-Castle-Chess/pull/181', updated_at: at }])
      if (url.includes('/deployments?')) return response([{ id: 9, environment: 'Preview', statuses_url: 'https://api.github.com/repos/vsillah/Dark-Castle-Chess/deployments/9/statuses', updated_at: at }])
      if (url.endsWith('/deployments/9/statuses')) return response([{ id: 10, state: 'success', environment_url: 'https://preview.example.test', updated_at: at }])
      return response({ message: 'not found' }, 404)
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'dcc', title: 'Dark Castle Chess', description: 'Learning-first chess', app_repo_url: 'https://github.com/vsillah/Dark-Castle-Chess', updated_at: at }],
      fetchImpl,
      generatedAt: at,
    })

    expect(result).toMatchObject({ repositories_scanned: 1, private_repositories_rejected: 0, blockers: [], read_only: true })
    expect(result.projections.map((item) => item.source_kind)).toEqual([
      'github_repository_activity', 'github_branch_activity', 'github_pull_request_activity', 'github_deployment_status_activity',
    ])
    expect(result.projections.every((item) => item.product_identity === 'dark_castle_chess')).toBe(true)
    expect(result.projections.every((item) => item.raw_content_included === false && item.approval_status === 'approved')).toBe(true)
    expect(result.projections.find((item) => item.source_kind === 'github_pull_request_activity')).toMatchObject({
      lifecycle_stage: 'in_development',
      evidence_url: 'https://github.com/vsillah/Dark-Castle-Chess/pull/181',
    })
  })

  it('summarizes private repository activity through the configured token without raw private content', async () => {
    process.env.GITHUB_TOKEN = 'configured-test-token'
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/repos/vsillah/private')) return response({ id: 7, full_name: 'vsillah/private', html_url: 'https://github.com/vsillah/private', private: true, default_branch: 'main', updated_at: at })
      if (url.includes('/branches?')) return response([{ name: 'main', commit: { sha: 'private-sha' } }])
      if (url.includes('/pulls?')) return response([{ number: 12, title: 'Private title', state: 'open', html_url: 'https://github.com/vsillah/private/pull/12', updated_at: at }])
      if (url.includes('/deployments?')) return response([])
      return response({ message: 'not found' }, 404)
    }) as typeof fetch
    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'private', title: 'Private product', app_repo_url: 'https://github.com/vsillah/private' }],
      fetchImpl,
      generatedAt: at,
    })
    expect(result).toMatchObject({ repositories_scanned: 1, private_repositories_rejected: 0, private_repositories_summarized: 1, blockers: [] })
    expect(result.projections).toHaveLength(3)
    expect(result.projections.every((item) => item.privacy_classification === 'client_safe_summary' && item.raw_content_included === false)).toBe(true)
    expect(JSON.stringify(result.projections)).not.toContain('Private title')
    expect(JSON.stringify(result.projections)).not.toContain('private-sha')
  })

  it('discovers an unlinked Dark Castle repository and joins it by stable product identity', async () => {
    process.env.GITHUB_TOKEN = 'configured-test-token'
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/user/repos?')) return response([{
        id: 81, name: 'dark-castle-chess', full_name: 'vsillah/dark-castle-chess', owner: { login: 'vsillah' },
        html_url: 'https://github.com/vsillah/dark-castle-chess', private: true, default_branch: 'main', updated_at: at,
      }])
      if (url.endsWith('/repos/vsillah/dark-castle-chess')) return response({
        id: 81, name: 'dark-castle-chess', full_name: 'vsillah/dark-castle-chess', owner: { login: 'vsillah' },
        html_url: 'https://github.com/vsillah/dark-castle-chess', private: true, default_branch: 'main', updated_at: at,
      })
      if (url.includes('/branches?')) return response([{ name: 'main', commit: { sha: 'private-sha' } }])
      if (url.includes('/pulls?')) return response([{ number: 9, title: 'Private title', state: 'open', updated_at: at }])
      if (url.includes('/deployments?')) return response([])
      return response({ message: 'not found' }, 404)
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'dcc-product', title: 'Dark Castle Chess', description: 'Learning-first chess', app_repo_url: null }],
      fetchImpl,
      generatedAt: at,
      githubOwner: 'vsillah',
    })

    expect(result).toMatchObject({ repositories_scanned: 1, private_repositories_summarized: 1, blockers: [] })
    expect(result.projections.map((item) => item.source_kind)).toEqual([
      'github_repository_activity', 'github_branch_activity', 'github_pull_request_activity',
    ])
    expect(result.projections.every((item) => item.product_identity === 'dark_castle_chess' && item.privacy_classification === 'client_safe_summary')).toBe(true)
    expect(JSON.stringify(result.projections)).not.toContain('Private title')
    expect(JSON.stringify(result.projections)).not.toContain('private-sha')
  })

  it('fails closed when multiple discovered repositories match one product', async () => {
    process.env.GITHUB_TOKEN = 'configured-test-token'
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('/user/repos?')) return response([
        { id: 1, name: 'dark-castle-chess', full_name: 'vsillah/dark-castle-chess', owner: { login: 'vsillah' }, html_url: 'https://github.com/vsillah/dark-castle-chess', private: true },
        { id: 2, name: 'dark_castle_chess', full_name: 'vsillah/dark_castle_chess', owner: { login: 'vsillah' }, html_url: 'https://github.com/vsillah/dark_castle_chess', private: true },
      ])
      return response({ message: 'unexpected repository detail request' }, 500)
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'dcc-product', title: 'Dark Castle Chess', app_repo_url: null }],
      fetchImpl,
      generatedAt: at,
      githubOwner: 'vsillah',
    })

    expect(result.projections).toEqual([])
    expect(result.blockers).toEqual([
      '[github_repository_match_ambiguous:dark_castle_chess] 2 authenticated repositories match this Portfolio product identity. Add an explicit app_repo_url to select one.',
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('keeps an unlinked product blocked when discovery finds no stable identity match', async () => {
    process.env.GITHUB_TOKEN = 'configured-test-token'
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('/user/repos?')) return response([{
        id: 3, name: 'portfolio', full_name: 'vsillah/Portfolio', owner: { login: 'vsillah' }, html_url: 'https://github.com/vsillah/Portfolio', private: true,
      }])
      return response({ message: 'unexpected repository detail request' }, 500)
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'unknown-product', title: 'Unmatched Product', app_repo_url: null }],
      fetchImpl,
      generatedAt: at,
      githubOwner: 'vsillah',
    })

    expect(result.projections).toEqual([])
    expect(result.blockers).toEqual([
      '[github_repository_match_missing:unmatched_product] No authenticated repository name matched this Portfolio product identity. Add an explicit app_repo_url or align the repository name.',
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fails closed when private activity is visible without the configured integration token', async () => {
    delete process.env.GITHUB_TOKEN
    const fetchImpl = vi.fn(async () => response({ id: 7, full_name: 'vsillah/private', html_url: 'https://github.com/vsillah/private', private: true })) as typeof fetch
    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'private', title: 'Private product', app_repo_url: 'https://github.com/vsillah/private' }],
      fetchImpl,
      generatedAt: at,
    })
    expect(result.projections).toEqual([])
    expect(result.private_repositories_rejected).toBe(1)
    expect(result.blockers[0]).toContain('github_private_repository_requires_configured_token')
  })

  it('scans multiple repositories concurrently while preserving deterministic repository order', async () => {
    let activeRepositoryReads = 0
    let maxActiveRepositoryReads = 0
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const name = repoName(input)
      if (name) {
        activeRepositoryReads += 1
        maxActiveRepositoryReads = Math.max(maxActiveRepositoryReads, activeRepositoryReads)
        await new Promise((resolve) => setTimeout(resolve, name === 'alpha' ? 25 : 5))
        activeRepositoryReads -= 1
        return response({ id: name === 'alpha' ? 1 : 2, full_name: `fixture/${name}`, html_url: `https://github.com/fixture/${name}`, private: false, default_branch: 'main', updated_at: at })
      }
      if (url.includes('/branches?') || url.includes('/pulls?') || url.includes('/deployments?')) return response([])
      return response({ message: 'not found' }, 404)
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [
        { id: '2', title: 'Beta', app_repo_url: 'https://github.com/fixture/beta' },
        { id: '1', title: 'Alpha', app_repo_url: 'https://github.com/fixture/alpha' },
      ],
      fetchImpl,
      generatedAt: at,
      concurrency: 2,
    })

    expect(maxActiveRepositoryReads).toBe(2)
    expect(result.repositories_scanned).toBe(2)
    expect(result.projections.map((item) => item.product_identity)).toEqual(['alpha', 'beta'])
  })

  it('keeps successful receipts when another repository is rate limited', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const name = repoName(input)
      if (name === 'limited') return response({ message: 'rate limited' }, 429, { 'retry-after': '60', 'x-ratelimit-remaining': '0' })
      if (name === 'ready') return response({ id: 3, full_name: 'fixture/ready', html_url: 'https://github.com/fixture/ready', private: false, default_branch: 'main', updated_at: at })
      if (url.includes('/branches?') || url.includes('/pulls?') || url.includes('/deployments?')) return response([])
      return response({ message: 'not found' }, 404)
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [
        { id: 'limited', title: 'Limited', app_repo_url: 'https://github.com/fixture/limited' },
        { id: 'ready', title: 'Ready', app_repo_url: 'https://github.com/fixture/ready' },
      ],
      fetchImpl,
      generatedAt: at,
      concurrency: 2,
    })

    expect(result.repositories_scanned).toBe(1)
    expect(result.projections.map((item) => item.product_identity)).toEqual(['ready'])
    expect(result.blockers).toEqual([
      '[github_rate_limited:limited] GitHub returned 429; retry after 60 seconds.',
    ])
  })

  it('returns an actionable timeout blocker without hanging the collector', async () => {
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      if (!repoName(input)) return Promise.resolve(response([]))
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    }) as typeof fetch

    const result = await collectDirectGitHubActivityProjections({
      prototypeRows: [{ id: 'slow', title: 'Slow', app_repo_url: 'https://github.com/fixture/slow' }],
      fetchImpl,
      generatedAt: at,
      requestTimeoutMs: 25,
      collectorTimeoutMs: 50,
    })

    expect(result.projections).toEqual([])
    expect(result.blockers[0]).toMatch(/^\[github_request_timeout:slow\].*retry the scan/i)
  })

  it('accepts only canonical HTTPS github.com repository URLs', () => {
    expect(parsePublicGitHubRepoUrl('https://github.com/vsillah/Dark-Castle-Chess')).toEqual({ owner: 'vsillah', repo: 'Dark-Castle-Chess', url: 'https://github.com/vsillah/Dark-Castle-Chess' })
    expect(parsePublicGitHubRepoUrl('git@github.com:vsillah/private.git')).toBeNull()
    expect(parsePublicGitHubRepoUrl('https://example.com/vsillah/repo')).toBeNull()
  })

  it('canonicalizes github.com URLs without keeping credentials, query secrets, or a .git suffix', () => {
    expect(parsePublicGitHubRepoUrl('https://github.com/vsillah/Dark-Castle-Chess.git')).toEqual({
      owner: 'vsillah',
      repo: 'Dark-Castle-Chess',
      url: 'https://github.com/vsillah/Dark-Castle-Chess',
    })
    const embeddedSecret = 'ghp_supersecrettoken'
    const parsed = parsePublicGitHubRepoUrl(`https://${embeddedSecret}@github.com/vsillah/Dark-Castle-Chess?access_token=raw-token`)
    expect(parsed).toEqual({
      owner: 'vsillah',
      repo: 'Dark-Castle-Chess',
      url: 'https://github.com/vsillah/Dark-Castle-Chess',
    })
    expect(JSON.stringify(parsed)).not.toContain(embeddedSecret)
    expect(JSON.stringify(parsed)).not.toContain('raw-token')
    expect(parsePublicGitHubRepoUrl('http://github.com/vsillah/Dark-Castle-Chess')).toBeNull()
    expect(parsePublicGitHubRepoUrl('https://github.com.evil.example/vsillah/Dark-Castle-Chess')).toBeNull()
    expect(parsePublicGitHubRepoUrl('https://github.com/vsillah/repo name')).toBeNull()
  })
})
