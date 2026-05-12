import { describe, expect, it } from 'vitest'
import {
  parseArgs,
  parseWorktreeList,
  selectSourceRoot,
} from './bootstrap-worktree-env'

describe('bootstrap-worktree-env', () => {
  it('parses default options', () => {
    expect(parseArgs([])).toEqual({
      sourceRoot: null,
      localPaths: ['.env.local', '.env.staging', '.vercel'],
      replaceBrokenSymlinks: true,
    })
  })

  it('parses source and path overrides', () => {
    expect(parseArgs(['--source', '/tmp/main', '--paths', '.env.local,.vercel'])).toEqual({
      sourceRoot: '/tmp/main',
      localPaths: ['.env.local', '.vercel'],
      replaceBrokenSymlinks: true,
    })
  })

  it('selects the main worktree as the default source root', () => {
    const entries = parseWorktreeList(`worktree /Users/vambahsillah/Projects/Portfolio
HEAD abc123
branch refs/heads/main

worktree /Users/vambahsillah/Projects/Portfolio.worktrees/feature
HEAD def456
branch refs/heads/codex/feature
`)

    expect(selectSourceRoot(entries, '/fallback')).toBe('/Users/vambahsillah/Projects/Portfolio')
  })

  it('falls back to the current checkout when main is not listed', () => {
    expect(selectSourceRoot([], '/fallback')).toBe('/fallback')
  })
})
