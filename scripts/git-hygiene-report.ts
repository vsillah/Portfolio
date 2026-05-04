#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'

type StatusLabel = 'normal' | 'watch' | 'debt' | 'blocker'

type BranchReport = {
  name: string
  upstream: string
  tracking: string
  shortSha: string
  subject: string
  uniqueCommits: number
  label: StatusLabel
  recommendation: string
}

type WorktreeReport = {
  path: string
  branch: string
  head: string
  dirtyFiles: number
  uniqueCommits: number
  label: StatusLabel
  recommendation: string
}

type PullRequestReport = {
  number: number
  title: string
  headRefName: string
  isDraft: boolean
  ageHours: number
  label: StatusLabel
  recommendation: string
}

type OpenPullRequest = {
  number: number
  title: string
  headRefName: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
}

function run(args: string[], cwd = process.cwd()): string {
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `${args.join(' ')} failed`
    throw new Error(message)
  }

  return result.stdout.trim()
}

function tryRun(args: string[], cwd = process.cwd()): string {
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) return ''
  return result.stdout.trim()
}

function countLines(value: string): number {
  if (!value.trim()) return 0
  return value.split('\n').filter(Boolean).length
}

function countUniqueCommits(ref: string): number {
  const count = tryRun(['git', 'rev-list', '--count', ref, '--not', 'origin/main'])
  return Number(count || 0)
}

function countWorktreeUniqueCommits(path: string): number {
  const count = tryRun(['git', '-C', path, 'rev-list', '--count', 'HEAD', '--not', 'origin/main'])
  return Number(count || 0)
}

function getCurrentBranch(): string {
  return tryRun(['git', 'branch', '--show-current']) || '(detached)'
}

function getGoneBranches(): BranchReport[] {
  const output = run([
    'git',
    'for-each-ref',
    'refs/heads',
    '--format=%(refname:short)|%(upstream:short)|%(upstream:track)|%(objectname:short)|%(contents:subject)',
  ])

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, upstream, tracking, shortSha, ...subjectParts] = line.split('|')
      const subject = subjectParts.join('|')
      return { name, upstream, tracking, shortSha, subject }
    })
    .filter((branch) => branch.tracking.includes('gone'))
    .map((branch) => {
      const uniqueCommits = countUniqueCommits(branch.name)
      const label: StatusLabel = uniqueCommits > 0 ? 'watch' : 'normal'
      const recommendation =
        uniqueCommits > 0
          ? 'classify as preserve, superseded, abandon, or needs PR before deleting'
          : 'safe cleanup candidate after captain confirms no worktree owns it'

      return {
        ...branch,
        uniqueCommits,
        label,
        recommendation,
      }
    })
}

function parseWorktrees(): WorktreeReport[] {
  const output = run(['git', 'worktree', 'list', '--porcelain'])
  const blocks = output.split(/\n(?=worktree )/).filter(Boolean)

  return blocks.map((block) => {
    const lines = block.split('\n')
    const path = lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length) ?? ''
    const head = lines.find((line) => line.startsWith('HEAD '))?.slice('HEAD '.length, 19) ?? ''
    const branchLine = lines.find((line) => line.startsWith('branch '))
    const branch = branchLine ? branchLine.replace('branch refs/heads/', '') : '(detached)'
    const dirtyFiles = countLines(tryRun(['git', '-C', path, 'status', '--porcelain']))
    const uniqueCommits = countWorktreeUniqueCommits(path)

    let label: StatusLabel = 'normal'
    let recommendation = 'expected active or verification worktree'

    if (dirtyFiles > 0) {
      label = 'debt'
      recommendation = 'identify owner before merge or cleanup'
    } else if (branch === 'main' || branch === '(detached)') {
      label = 'normal'
      recommendation = 'keep as normal captain verification/main checkout'
    } else if (uniqueCommits > 0) {
      label = 'watch'
      recommendation = 'preserve until branch owner or PR status is clear'
    } else {
      label = 'watch'
      recommendation = 'cleanup candidate if no active chat still uses it'
    }

    return {
      path,
      branch,
      head,
      dirtyFiles,
      uniqueCommits,
      label,
      recommendation,
    }
  })
}

function getOpenPullRequests(now = new Date()): PullRequestReport[] {
  const output = tryRun([
    'gh',
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'number,title,headRefName,isDraft,createdAt,updatedAt',
  ])

  if (!output) return []

  const prs = JSON.parse(output) as OpenPullRequest[]

  return prs.map((pr) => {
    const createdAt = Date.parse(pr.createdAt)
    const ageHours = Number.isFinite(createdAt)
      ? Math.floor((now.getTime() - createdAt) / 36_000) / 100
      : 0

    let label: StatusLabel = 'normal'
    let recommendation = 'no action'

    if (!pr.isDraft && ageHours >= 48) {
      label = 'debt'
      recommendation = 'ready PR older than 48h; integration captain should sequence or block explicitly'
    } else if (!pr.isDraft) {
      label = 'normal'
      recommendation = 'ready PR; process through normal merge gate'
    } else if (ageHours >= 168) {
      label = 'watch'
      recommendation = 'draft older than 7d; ask owner whether to keep, close, or refresh'
    } else {
      label = 'normal'
      recommendation = 'draft PR is expected parallel-work residue'
    }

    return {
      number: pr.number,
      title: pr.title,
      headRefName: pr.headRefName,
      isDraft: pr.isDraft,
      ageHours,
      label,
      recommendation,
    }
  })
}

function getPrFileMap(prs: PullRequestReport[]): Map<string, PullRequestReport[]> {
  const byFile = new Map<string, PullRequestReport[]>()

  for (const pr of prs) {
    const output = tryRun(['gh', 'pr', 'diff', String(pr.number), '--name-only'])
    if (!output) continue

    for (const file of output.split('\n').filter(Boolean)) {
      const current = byFile.get(file) ?? []
      current.push(pr)
      byFile.set(file, current)
    }
  }

  return byFile
}

function formatTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows]
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length))
  )

  return allRows
    .map((row, rowIndex) => {
      const formatted = row
        .map((value, index) => String(value).padEnd(widths[index]))
        .join(' | ')
      if (rowIndex === 0) {
        return `${formatted}\n${widths.map((width) => '-'.repeat(width)).join('-|-')}`
      }
      return formatted
    })
    .join('\n')
}

function main(): void {
  run(['git', 'fetch', '--prune', 'origin'])

  const now = new Date()
  const currentBranch = getCurrentBranch()
  const goneBranches = getGoneBranches()
  const worktrees = parseWorktrees()
  const prs = getOpenPullRequests(now)
  const fileMap = getPrFileMap(prs)
  const overlappingFiles = [...fileMap.entries()].filter(([, owners]) => owners.length > 1)

  console.log(`# Git Hygiene Watch Report`)
  console.log(`Generated: ${now.toISOString()}`)
  console.log(`Current branch: ${currentBranch}`)
  console.log('')

  console.log('## Watch Policy')
  console.log('- Vercel pending under 5m: normal; 5-10m: watch; over 10m repeatedly: debt; failure or timeout: blocker.')
  console.log('- GitHub 502 or merge-in-progress: check PR state, check origin/main, poll briefly, retry once if still open and clean.')
  console.log('- Branch and worktree cleanup is report-only here; no deletion is performed.')
  console.log('')

  console.log('## Gone Local Branches')
  if (goneBranches.length === 0) {
    console.log('No local branches with gone upstreams.')
  } else {
    console.log(
      formatTable(
        ['label', 'branch', 'unique', 'sha', 'recommendation', 'subject'],
        goneBranches.map((branch) => [
          branch.label,
          branch.name,
          String(branch.uniqueCommits),
          branch.shortSha,
          branch.recommendation,
          branch.subject,
        ])
      )
    )
  }
  console.log('')

  console.log('## Worktrees')
  console.log(
    formatTable(
      ['label', 'branch', 'dirty', 'unique', 'head', 'path', 'recommendation'],
      worktrees.map((worktree) => [
        worktree.label,
        worktree.branch,
        String(worktree.dirtyFiles),
        String(worktree.uniqueCommits),
        worktree.head,
        worktree.path,
        worktree.recommendation,
      ])
    )
  )
  console.log('')

  console.log('## Open PR Age')
  if (prs.length === 0) {
    console.log('No open PRs.')
  } else {
    console.log(
      formatTable(
        ['label', 'pr', 'draft', 'age_h', 'branch', 'recommendation', 'title'],
        prs.map((pr) => [
          pr.label,
          `#${pr.number}`,
          String(pr.isDraft),
          String(pr.ageHours),
          pr.headRefName,
          pr.recommendation,
          pr.title,
        ])
      )
    )
  }
  console.log('')

  console.log('## Open PR File Overlap')
  if (overlappingFiles.length === 0) {
    console.log('No overlapping files across open PRs.')
  } else {
    console.log(
      formatTable(
        ['label', 'file', 'prs', 'recommendation'],
        overlappingFiles.map(([file, owners]) => [
          'watch',
          file,
          owners.map((pr) => `#${pr.number}`).join(','),
          'sequence PRs or require impact preflight before merging',
        ])
      )
    )
  }
}

main()
