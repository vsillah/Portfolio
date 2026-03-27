import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  parseGitHubRepoUrl,
  computeDiff,
  readPortfolioModule,
  runModuleDiff,
} from './module-sync-diff'

describe('parseGitHubRepoUrl', () => {
  it('parses common GitHub URL formats', () => {
    expect(parseGitHubRepoUrl('https://github.com/acme-inc/module-sync')).toEqual({
      owner: 'acme-inc',
      repo: 'module-sync',
    })
    expect(parseGitHubRepoUrl('https://github.com/acme-inc/module-sync.git')).toEqual({
      owner: 'acme-inc',
      repo: 'module-sync',
    })
    expect(parseGitHubRepoUrl('git@github.com:acme-inc/module-sync.git')).toEqual({
      owner: 'acme-inc',
      repo: 'module-sync',
    })
  })

  it('returns null for non-GitHub or malformed URLs', () => {
    expect(parseGitHubRepoUrl('https://gitlab.com/acme-inc/module-sync')).toBeNull()
    expect(parseGitHubRepoUrl('https://github.com/acme-inc')).toBeNull()
    expect(parseGitHubRepoUrl('not-a-url')).toBeNull()
  })
})

describe('computeDiff', () => {
  it('classifies added, removed, modified, unchanged and sorts by path', () => {
    const portfolio = new Map<string, string>([
      ['b.txt', 'only-in-portfolio'],
      ['a.txt', 'same-content'],
      ['c.txt', 'new-content'],
    ])
    const repo = new Map<string, string>([
      ['a.txt', 'same-content'],
      ['c.txt', 'old-content'],
      ['d.txt', 'only-in-repo'],
    ])

    const result = computeDiff(portfolio, repo)

    expect(result.map((r) => `${r.path}:${r.status}`)).toEqual([
      'a.txt:unchanged',
      'b.txt:added',
      'c.txt:modified',
      'd.txt:removed',
    ])
    expect(result.find((r) => r.path === 'c.txt')?.patch).toContain('@@')
  })
})

describe('readPortfolioModule', () => {
  it('reads text files and skips ignored directories', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'module-sync-diff-'))
    const modulePath = path.join(tempRoot, 'sample-module')
    await fs.promises.mkdir(path.join(modulePath, 'node_modules'), { recursive: true })
    await fs.promises.mkdir(path.join(modulePath, '.git'), { recursive: true })
    await fs.promises.writeFile(path.join(modulePath, 'keep.txt'), 'hello')
    await fs.promises.writeFile(path.join(modulePath, 'empty.txt'), '')
    await fs.promises.writeFile(path.join(modulePath, 'node_modules', 'ignore.txt'), 'ignored')
    await fs.promises.writeFile(path.join(modulePath, '.git', 'config'), 'ignored')

    const files = await readPortfolioModule(tempRoot, 'sample-module')

    expect(files.get('keep.txt')).toBe('hello')
    expect(files.get('empty.txt')).toBe('')
    expect(files.has('node_modules/ignore.txt')).toBe(false)
    expect(files.has('.git/config')).toBe(false)

    await fs.promises.rm(tempRoot, { recursive: true, force: true })
  })
})

describe('runModuleDiff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns explicit error when spun-off repo URL is missing', async () => {
    const result = await runModuleDiff(
      {
        id: 'module-a',
        name: 'Module A',
        portfolioPath: 'lib',
      },
      '/workspace'
    )

    expect(result.error).toBe('No spun-off repo URL configured for this module.')
    expect(result.files).toEqual([])
  })

  it('marks repo as not found when GitHub responds with 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404, statusText: 'Not Found' }))
    )

    const result = await runModuleDiff(
      {
        id: 'module-b',
        name: 'Module B',
        portfolioPath: 'lib',
        spunOffRepoUrl: 'https://github.com/acme-inc/missing-repo',
      },
      '/workspace',
      'fake-token'
    )

    expect(result.repoNotFound).toBe(true)
    expect(result.error).toBe('Repo not found or deleted on GitHub.')
  })
})
