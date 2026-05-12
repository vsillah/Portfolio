#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'

const DEFAULT_LOCAL_PATHS = ['.env.local', '.env.staging', '.vercel']

type BootstrapOptions = {
  sourceRoot: string | null
  localPaths: string[]
  replaceBrokenSymlinks: boolean
}

type WorktreeEntry = {
  path: string
  branch: string | null
}

export function parseArgs(argv: string[]): BootstrapOptions {
  const options: BootstrapOptions = {
    sourceRoot: null,
    localPaths: DEFAULT_LOCAL_PATHS,
    replaceBrokenSymlinks: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--source' && next) {
      options.sourceRoot = resolve(next)
      index += 1
    } else if (arg === '--paths' && next) {
      options.localPaths = next
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      index += 1
    } else if (arg === '--keep-broken-symlinks') {
      options.replaceBrokenSymlinks = false
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run worktree:env -- [options]

Options:
  --source <path>  Source checkout to link local env files from. Defaults to the main worktree.
  --paths <list>   Comma-separated local paths to link. Defaults to .env.local,.env.staging,.vercel.
`)
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (options.localPaths.length === 0) {
    throw new Error('--paths must include at least one local path')
  }

  return options
}

export function parseWorktreeList(output: string): WorktreeEntry[] {
  return output
    .split(/\n(?=worktree )/)
    .map((block) => {
      const lines = block.split('\n').filter(Boolean)
      const path = lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length) ?? ''
      const branch = lines.find((line) => line.startsWith('branch '))?.slice('branch '.length) ?? null
      return path ? { path, branch } : null
    })
    .filter((entry): entry is WorktreeEntry => Boolean(entry))
}

export function selectSourceRoot(entries: WorktreeEntry[], fallback: string): string {
  return entries.find((entry) => entry.branch === 'refs/heads/main')?.path ?? fallback
}

function gitWorktreeEntries(): WorktreeEntry[] {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || 'git worktree list failed'
    throw new Error(message)
  }

  return parseWorktreeList(result.stdout)
}

function isBrokenSymlink(path: string) {
  try {
    const stat = lstatSync(path)
    if (!stat.isSymbolicLink()) return false
    const target = resolve(dirname(path), readlinkSync(path))
    return !existsSync(target)
  } catch {
    return false
  }
}

function linkLocalPath(sourceRoot: string, targetRoot: string, localPath: string, replaceBrokenSymlinks: boolean) {
  const source = resolve(sourceRoot, localPath)
  const target = resolve(targetRoot, localPath)

  if (!existsSync(source)) {
    return `skip ${localPath}: source not found in ${sourceRoot}`
  }

  if (existsSync(target)) {
    return `skip ${localPath}: already present`
  }

  if (isBrokenSymlink(target)) {
    if (!replaceBrokenSymlinks) return `skip ${localPath}: broken symlink already present`
    unlinkSync(target)
  }

  symlinkSync(source, target)
  return `linked ${localPath} -> ${relative(targetRoot, source)}`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const targetRoot = process.cwd()
  const sourceRoot = options.sourceRoot ?? selectSourceRoot(gitWorktreeEntries(), targetRoot)

  if (resolve(sourceRoot) === resolve(targetRoot)) {
    console.log(`Current checkout already appears to be the source worktree: ${sourceRoot}`)
    return
  }

  console.log(`Linking local worktree runtime files from ${sourceRoot} into ${targetRoot}`)
  for (const localPath of options.localPaths) {
    console.log(linkLocalPath(sourceRoot, targetRoot, localPath, options.replaceBrokenSymlinks))
  }

  console.log(`Done. Linked paths are gitignored; ${basename(sourceRoot)} remains the source of local secrets.`)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
