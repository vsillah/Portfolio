import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { homedir } from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

export type CodexWorkspaceHealth = 'green' | 'yellow' | 'red'

export interface CodexThreadRootSummary {
  cwd: string
  activeCount: number
  portfolioRoot: boolean
}

export interface CodexWorkspaceRootReport {
  available: boolean
  reason?: string
  generatedAt: string
  expectedRoot: string
  stateDatabase: string
  globalStateFile: string
  savedWorkspaceRoots: string[]
  activeWorkspaceRoots: string[]
  projectOrderRoots: string[]
  threadRoots: CodexThreadRootSummary[]
  overview: {
    activeThreads: number
    portfolioThreads: number
    nonPortfolioThreads: number
    savedRootDrift: number
    activeRootDrift: number
    projectOrderDrift: number
  }
  health: CodexWorkspaceHealth
  warnings: string[]
  operationalBoundary: string
}

type WorkspaceStateInput = {
  globalState: Record<string, unknown> | null
  threadRoots: CodexThreadRootSummary[]
  expectedRoot?: string
  stateDatabase?: string
  globalStateFile?: string
}

const EXPECTED_PORTFOLIO_ROOT = '/Users/vambahsillah/Projects/Portfolio'
const DEFAULT_CODEX_HOME = path.join(homedir(), '.codex')
const WORKSPACE_ROOT_KEYS = {
  saved: 'electron-saved-workspace-roots',
  active: 'active-workspace-roots',
  projectOrder: 'project-order',
}

export async function getCodexWorkspaceRootReport(codexHome = DEFAULT_CODEX_HOME): Promise<CodexWorkspaceRootReport> {
  const generatedAt = new Date().toISOString()
  const stateDatabase = path.join(codexHome, 'state_5.sqlite')
  const globalStateFile = path.join(codexHome, '.codex-global-state.json')

  if (!existsSync(codexHome)) {
    return unavailableWorkspaceReport(generatedAt, stateDatabase, globalStateFile, 'Local Codex home is not available in this environment')
  }

  let globalState: Record<string, unknown> | null = null
  if (existsSync(globalStateFile)) {
    try {
      globalState = JSON.parse(await readFile(globalStateFile, 'utf8')) as Record<string, unknown>
    } catch {
      return unavailableWorkspaceReport(generatedAt, stateDatabase, globalStateFile, 'Codex global state file is not readable JSON')
    }
  }

  let threadRoots: CodexThreadRootSummary[] = []
  if (existsSync(stateDatabase)) {
    try {
      threadRoots = await readThreadRootSummaries(stateDatabase)
    } catch {
      return unavailableWorkspaceReport(generatedAt, stateDatabase, globalStateFile, 'Codex thread database could not be queried read-only')
    }
  }

  return buildCodexWorkspaceRootReport({
    globalState,
    threadRoots,
    expectedRoot: EXPECTED_PORTFOLIO_ROOT,
    stateDatabase,
    globalStateFile,
  }, generatedAt)
}

export function buildCodexWorkspaceRootReport(input: WorkspaceStateInput, generatedAt = new Date().toISOString()): CodexWorkspaceRootReport {
  const expectedRoot = input.expectedRoot || EXPECTED_PORTFOLIO_ROOT
  const stateDatabase = input.stateDatabase || path.join(DEFAULT_CODEX_HOME, 'state_5.sqlite')
  const globalStateFile = input.globalStateFile || path.join(DEFAULT_CODEX_HOME, '.codex-global-state.json')
  const savedWorkspaceRoots = extractRootList(input.globalState, WORKSPACE_ROOT_KEYS.saved)
  const activeWorkspaceRoots = extractRootList(input.globalState, WORKSPACE_ROOT_KEYS.active)
  const projectOrderRoots = extractRootList(input.globalState, WORKSPACE_ROOT_KEYS.projectOrder)
  const threadRoots = input.threadRoots
    .map((root) => ({
      ...root,
      portfolioRoot: isPortfolioRoot(root.cwd, expectedRoot),
    }))
    .sort((a, b) => b.activeCount - a.activeCount || a.cwd.localeCompare(b.cwd))

  const activeThreads = threadRoots.reduce((sum, root) => sum + root.activeCount, 0)
  const portfolioThreads = threadRoots.filter((root) => root.portfolioRoot).reduce((sum, root) => sum + root.activeCount, 0)
  const nonPortfolioThreads = activeThreads - portfolioThreads
  const savedRootDrift = countRootDrift(savedWorkspaceRoots, expectedRoot)
  const activeRootDrift = countRootDrift(activeWorkspaceRoots, expectedRoot)
  const projectOrderDrift = countRootDrift(projectOrderRoots, expectedRoot)
  const warnings = buildWorkspaceWarnings({
    savedWorkspaceRoots,
    activeWorkspaceRoots,
    projectOrderRoots,
    threadRoots,
    expectedRoot,
    nonPortfolioThreads,
    savedRootDrift,
    activeRootDrift,
    projectOrderDrift,
  })

  return {
    available: Boolean(input.globalState || input.threadRoots.length > 0),
    generatedAt,
    expectedRoot,
    stateDatabase,
    globalStateFile,
    savedWorkspaceRoots,
    activeWorkspaceRoots,
    projectOrderRoots,
    threadRoots,
    overview: {
      activeThreads,
      portfolioThreads,
      nonPortfolioThreads,
      savedRootDrift,
      activeRootDrift,
      projectOrderDrift,
    },
    health: classifyWorkspaceHealth(nonPortfolioThreads, savedRootDrift + activeRootDrift + projectOrderDrift),
    warnings,
    operationalBoundary: 'Read-only workspace visibility. Do not edit Codex SQLite, Desktop workspace JSON, or thread roots without an explicit operational-state repair step and backups.',
  }
}

async function readThreadRootSummaries(stateDatabase: string): Promise<CodexThreadRootSummary[]> {
  const query = [
    'select cwd, count(*) active_count',
    'from threads',
    'where archived = 0',
    'group by cwd',
    'order by active_count desc;',
  ].join(' ')
  const { stdout } = await execFileAsync('sqlite3', ['-json', stateDatabase, query], { maxBuffer: 1024 * 1024 })
  const rows = JSON.parse(stdout || '[]') as Array<{ cwd?: string; active_count?: number }>
  return rows
    .filter((row) => typeof row.cwd === 'string' && typeof row.active_count === 'number')
    .map((row) => ({
      cwd: row.cwd || '',
      activeCount: row.active_count || 0,
      portfolioRoot: isPortfolioRoot(row.cwd || '', EXPECTED_PORTFOLIO_ROOT),
    }))
}

function extractRootList(globalState: Record<string, unknown> | null, key: string) {
  const value = globalState?.[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function isPortfolioRoot(root: string, expectedRoot: string) {
  return root === expectedRoot || root.startsWith(`${expectedRoot}/`)
}

function countRootDrift(roots: string[], expectedRoot: string) {
  return roots.filter((root) => !isPortfolioRoot(root, expectedRoot)).length
}

function classifyWorkspaceHealth(nonPortfolioThreads: number, rootDrift: number): CodexWorkspaceHealth {
  if (nonPortfolioThreads === 0 && rootDrift === 0) return 'green'
  if (nonPortfolioThreads > 10 || rootDrift > 2) return 'red'
  return 'yellow'
}

function buildWorkspaceWarnings(input: {
  savedWorkspaceRoots: string[]
  activeWorkspaceRoots: string[]
  projectOrderRoots: string[]
  threadRoots: CodexThreadRootSummary[]
  expectedRoot: string
  nonPortfolioThreads: number
  savedRootDrift: number
  activeRootDrift: number
  projectOrderDrift: number
}) {
  const warnings: string[] = []
  if (input.savedWorkspaceRoots.length === 0) warnings.push('No saved Codex Desktop workspace roots were found.')
  if (input.activeWorkspaceRoots.length === 0) warnings.push('No active Codex Desktop workspace roots were found.')
  if (input.savedRootDrift > 0) warnings.push(`${input.savedRootDrift} saved workspace root(s) do not point at Portfolio.`)
  if (input.activeRootDrift > 0) warnings.push(`${input.activeRootDrift} active workspace root(s) do not point at Portfolio.`)
  if (input.projectOrderDrift > 0) warnings.push(`${input.projectOrderDrift} project-order root(s) do not point at Portfolio.`)
  if (input.nonPortfolioThreads > 0) warnings.push(`${input.nonPortfolioThreads} active thread(s) are rooted outside Portfolio.`)
  if (!input.threadRoots.some((root) => root.cwd === input.expectedRoot)) warnings.push('No active thread group is rooted exactly at Portfolio.')
  return warnings
}

function unavailableWorkspaceReport(
  generatedAt: string,
  stateDatabase: string,
  globalStateFile: string,
  reason: string,
): CodexWorkspaceRootReport {
  return {
    available: false,
    reason,
    generatedAt,
    expectedRoot: EXPECTED_PORTFOLIO_ROOT,
    stateDatabase,
    globalStateFile,
    savedWorkspaceRoots: [],
    activeWorkspaceRoots: [],
    projectOrderRoots: [],
    threadRoots: [],
    overview: {
      activeThreads: 0,
      portfolioThreads: 0,
      nonPortfolioThreads: 0,
      savedRootDrift: 0,
      activeRootDrift: 0,
      projectOrderDrift: 0,
    },
    health: 'yellow',
    warnings: [reason],
    operationalBoundary: 'Read-only workspace visibility. Do not edit Codex SQLite, Desktop workspace JSON, or thread roots without an explicit operational-state repair step and backups.',
  }
}
