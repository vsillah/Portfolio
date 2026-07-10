#!/usr/bin/env tsx
import { execFile, spawn } from 'child_process'
import { readFile, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import {
  compileKarpathyWikiOverlay,
  createOpenBrainProposal,
  getOpenBrainSnapshot,
  linkOpenBrainRecords,
  type OpenBrainMemoryKind,
  type OpenBrainPrivacyTier,
} from '../lib/open-brain'

type OpenBrainMcpServer = Pick<McpServer, 'registerTool'>
type UpdateScope = 'open_brain' | 'portfolio'

const execFileAsync = promisify(execFile)
const APPLY_APPROVAL_PHRASE = 'APPLY PORTFOLIO PATCH'
const MAX_READ_BYTES = 40_000
const MAX_PATCH_BYTES = 250_000
const BLOCKED_PATH_PARTS = new Set([
  '.git',
  '.next',
  'node_modules',
  'local-private',
  '.vercel',
  '.turbo',
])
const BLOCKED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.npmrc',
])
const BLOCKED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp4',
  '.mov',
  '.tiff',
  '.pdf',
  '.zip',
])

export function registerOpenBrainTools(target: OpenBrainMcpServer) {
  target.registerTool('capture_memory', {
    description: 'Create an approval-gated Open Brain memory proposal. Durable memory writes still require approval.',
    inputSchema: proposalSchema(),
  }, async (args) => createProposalToolResult(args))

  target.registerTool('search_memory', {
    description: 'Search approved local Open Brain memories and source projections.',
    inputSchema: {
      query: z.string(),
    },
  }, async ({ query }) => {
    const snapshot = await getOpenBrainSnapshot()
    const normalizedQuery = query.toLowerCase()
    return asText({
      memories: snapshot.memories.filter((memory) => `${memory.title} ${memory.body}`.toLowerCase().includes(normalizedQuery)),
      sources: snapshot.sources.filter((source) => `${source.title} ${source.summary} ${source.path || ''}`.toLowerCase().includes(normalizedQuery)),
    })
  })

  target.registerTool('get_context_packet', {
    description: 'Return the compact context packet agents should read before acting.',
    inputSchema: {},
  }, async () => {
    const snapshot = await getOpenBrainSnapshot()
    return asText(snapshot.contextPacket)
  })

  target.registerTool('propose_memory_write', {
    description: 'Create an approval-gated proposed memory write.',
    inputSchema: proposalSchema(),
  }, async (args) => createProposalToolResult(args))

  target.registerTool('list_pending_memory_proposals', {
    description: 'List pending Open Brain memory proposals.',
    inputSchema: {},
  }, async () => {
    const snapshot = await getOpenBrainSnapshot()
    return asText(snapshot.proposals.filter((proposal) => proposal.status === 'pending'))
  })

  target.registerTool('link_memory_to_source', {
    description: 'Create an auditable local Open Brain link between an approved memory and source record.',
    inputSchema: {
      memoryId: z.string(),
      sourceId: z.string(),
      relationship: z.string(),
    },
  }, async ({ memoryId, sourceId, relationship }) => {
    const snapshot = await getOpenBrainSnapshot()
    if (!snapshot.memories.some((memory) => memory.id === memoryId)) throw new Error('Memory not found.')
    if (!snapshot.sources.some((source) => source.id === sourceId)) throw new Error('Source not found.')
    const link = await linkOpenBrainRecords({ fromId: memoryId, toId: sourceId, relationship })
    return asText({
      link,
      note: 'Link recorded locally. This does not promote any memory, mutate agent config, or write to public docs.',
    })
  })

  target.registerTool('compile_wiki_overlay', {
    description: 'Compile Karpathy Wiki overlay previews from approved non-private memories.',
    inputSchema: {},
  }, async () => {
    const snapshot = await getOpenBrainSnapshot()
    return asText({ mode: 'preview', pages: compileKarpathyWikiOverlay(snapshot.memories, snapshot.events) })
  })

  target.registerTool('get_update_workspace_context', {
    description: 'Inspect the local Portfolio/Open Brain update workspace before proposing or applying changes.',
    inputSchema: {},
  }, async () => getUpdateWorkspaceContextToolResult())

  target.registerTool('read_update_target', {
    description: 'Read a scoped Portfolio/Open Brain file for local update work. Secrets, private folders, generated media, and oversized files are blocked.',
    inputSchema: {
      scope: z.enum(['open_brain', 'portfolio']),
      relativePath: z.string(),
      maxBytes: z.number().optional(),
    },
  }, async ({ scope, relativePath, maxBytes }) => readUpdateTargetToolResult({
    scope,
    relativePath,
    maxBytes,
  }))

  target.registerTool('apply_portfolio_patch', {
    description: 'Check or apply a unified diff against the local Portfolio worktree. Applying requires explicit approval phrase and LM Studio tool approval.',
    inputSchema: {
      scope: z.enum(['open_brain', 'portfolio']),
      unifiedDiff: z.string(),
      reason: z.string(),
      apply: z.boolean().optional(),
      approvalPhrase: z.string().optional(),
    },
  }, async ({ scope, unifiedDiff, reason, apply = false, approvalPhrase }) => applyPortfolioPatchToolResult({
    scope,
    unifiedDiff,
    reason,
    apply,
    approvalPhrase,
  }))
}

export async function createProposalToolResult(args: {
  kind: OpenBrainMemoryKind
  title: string
  body: string
  privacyTier: OpenBrainPrivacyTier
  confidence?: number
  sourceIds?: string[]
  reason: string
}) {
  const proposal = await createOpenBrainProposal({
    kind: args.kind,
    title: args.title,
    body: args.body,
    privacyTier: args.privacyTier,
    confidence: args.confidence,
    sourceIds: args.sourceIds || [],
    reason: args.reason,
    createdBy: 'open-brain-mcp',
  })
  return asText({ proposal, approvalRequired: true })
}

export function asText(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

export function proposalSchema() {
  return {
    kind: z.enum(['fact', 'decision', 'preference', 'workflow', 'risk', 'operating_rule']),
    title: z.string(),
    body: z.string(),
    privacyTier: z.enum(['public_safe', 'client_safe', 'internal_ops', 'private']),
    confidence: z.number().optional(),
    sourceIds: z.array(z.string()).optional(),
    reason: z.string(),
  }
}

export async function getUpdateWorkspaceContextToolResult() {
  const portfolioRoot = getPortfolioRoot()
  const [branch, status, snapshot] = await Promise.all([
    runGit(['branch', '--show-current'], portfolioRoot).catch((error) => `unavailable: ${error.message}`),
    runGit(['status', '--short', '--branch'], portfolioRoot).catch((error) => `unavailable: ${error.message}`),
    getOpenBrainSnapshot().catch((error) => null),
  ])

  return asText({
    portfolioRoot,
    branch: branch.trim(),
    gitStatus: status.trim().split('\n').slice(0, 120),
    openBrain: snapshot
      ? {
          home: snapshot.service.home,
          available: snapshot.service.available,
          sources: snapshot.overview.sources,
          memories: snapshot.overview.memories,
          pendingProposals: snapshot.overview.pendingProposals,
          health: snapshot.health,
        }
      : { available: false, reason: 'Open Brain snapshot could not be loaded.' },
    updateLane: {
      modelRole: 'LM Studio can inspect, propose, and apply explicitly approved local patches through this MCP server.',
      defaultMode: 'dry-run patch check',
      applyBoundary: `Applying a patch requires apply=true, approvalPhrase="${APPLY_APPROVAL_PHRASE}", and approving the LM Studio tool call.`,
      allowedScopes: {
        open_brain: [
          'docs/open-brain*',
          'scripts/open-brain*',
          'lib/open-brain*',
          'lib/model-ops-open-brain*',
          'app/admin/agents/open-brain/**',
          'app/api/admin/agents/open-brain/**',
        ],
        portfolio: [
          'docs/**',
          'app/**',
          'components/**',
          'lib/**',
          'scripts/**',
          'package.json',
          'package-lock.json',
        ],
      },
      blocked: [
        'secrets and env files',
        'node_modules, .git, .next, local-private, .vercel',
        'generated media and binary files',
        'paths outside the Portfolio root',
      ],
    },
    nextStepForModel: 'Read only the files needed, run apply_portfolio_patch with apply=false first, then ask Vambah before applying.',
  })
}

export async function readUpdateTargetToolResult(args: {
  scope: UpdateScope
  relativePath: string
  maxBytes?: number
}) {
  const portfolioRoot = getPortfolioRoot()
  const safePath = resolveAllowedUpdatePath(args.relativePath, args.scope, portfolioRoot)
  const maxBytes = Math.min(Math.max(args.maxBytes ?? MAX_READ_BYTES, 1), MAX_READ_BYTES)
  const contents = await readFile(safePath.absolutePath, 'utf8')
  const truncated = Buffer.byteLength(contents, 'utf8') > maxBytes
  return asText({
    path: safePath.relativePath,
    bytesReturned: Math.min(Buffer.byteLength(contents, 'utf8'), maxBytes),
    truncated,
    text: contents.slice(0, maxBytes),
    boundary: 'Read-only. No file was changed.',
  })
}

export async function applyPortfolioPatchToolResult(args: {
  scope: UpdateScope
  unifiedDiff: string
  reason: string
  apply?: boolean
  approvalPhrase?: string
}) {
  const portfolioRoot = getPortfolioRoot()
  if (!args.reason?.trim()) throw new Error('Patch reason is required.')
  if (Buffer.byteLength(args.unifiedDiff || '', 'utf8') > MAX_PATCH_BYTES) {
    throw new Error(`Patch is too large for LM Studio apply lane. Limit is ${MAX_PATCH_BYTES} bytes.`)
  }
  const changedPaths = extractUnifiedDiffPaths(args.unifiedDiff)
  if (changedPaths.length === 0) throw new Error('No changed file paths were found in the unified diff.')
  for (const changedPath of changedPaths) {
    resolveAllowedUpdatePath(changedPath, args.scope, portfolioRoot)
  }

  const check = await runGitApply(args.unifiedDiff, portfolioRoot, ['--check'])
  if (args.apply !== true) {
    return asText({
      mode: 'dry_run',
      checked: true,
      applied: false,
      changedPaths,
      reason: args.reason,
      gitApplyCheck: check,
      nextStepForModel: `If Vambah approves this exact patch, call apply_portfolio_patch again with apply=true and approvalPhrase="${APPLY_APPROVAL_PHRASE}".`,
    })
  }

  if (args.approvalPhrase !== APPLY_APPROVAL_PHRASE) {
    throw new Error(`Applying requires approvalPhrase="${APPLY_APPROVAL_PHRASE}".`)
  }
  const beforeStatus = await runGit(['status', '--short', '--branch'], portfolioRoot).catch((error) => `unavailable: ${error.message}`)
  const applyResult = await runGitApply(args.unifiedDiff, portfolioRoot, [])
  const afterStatus = await runGit(['status', '--short', '--branch'], portfolioRoot).catch((error) => `unavailable: ${error.message}`)

  return asText({
    mode: 'applied',
    checked: true,
    applied: true,
    changedPaths,
    reason: args.reason,
    gitApplyCheck: check,
    gitApply: applyResult,
    beforeStatus: beforeStatus.trim().split('\n').slice(0, 80),
    afterStatus: afterStatus.trim().split('\n').slice(0, 120),
    boundary: 'Patch applied locally only. It was not committed, pushed, deployed, or promoted to durable Open Brain memory.',
  })
}

export function extractUnifiedDiffPaths(unifiedDiff: string) {
  const paths = new Set<string>()
  for (const line of unifiedDiff.split('\n')) {
    const gitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
    if (gitMatch) {
      if (gitMatch[1] !== '/dev/null') paths.add(gitMatch[1])
      if (gitMatch[2] !== '/dev/null') paths.add(gitMatch[2])
      continue
    }
    const fileMatch = line.match(/^(?:---|\+\+\+) (?:a|b)\/(.+)$/)
    if (fileMatch && fileMatch[1] !== '/dev/null') paths.add(fileMatch[1])
  }
  return [...paths].sort()
}

export function resolveAllowedUpdatePath(relativePath: string, scope: UpdateScope, portfolioRoot = getPortfolioRoot()) {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('\0')) throw new Error('A relative file path is required.')
  if (normalized.startsWith('../') || normalized.includes('/../')) throw new Error(`Path escapes Portfolio root: ${relativePath}`)
  const parts = normalized.split('/')
  if (parts.some((part) => BLOCKED_PATH_PARTS.has(part))) throw new Error(`Blocked path segment in ${relativePath}`)
  const basename = parts[parts.length - 1]
  if (BLOCKED_FILE_NAMES.has(basename)) throw new Error(`Blocked sensitive file: ${relativePath}`)
  if (BLOCKED_EXTENSIONS.has(path.extname(basename).toLowerCase())) throw new Error(`Blocked generated or binary file: ${relativePath}`)
  if (!isAllowedScopePath(normalized, scope)) throw new Error(`Path ${relativePath} is outside the ${scope} update scope.`)
  const absolutePath = path.resolve(portfolioRoot, normalized)
  if (!absolutePath.startsWith(`${path.resolve(portfolioRoot)}${path.sep}`) && absolutePath !== path.resolve(portfolioRoot)) {
    throw new Error(`Path escapes Portfolio root: ${relativePath}`)
  }
  return { relativePath: normalized, absolutePath }
}

function isAllowedScopePath(relativePath: string, scope: UpdateScope) {
  if (scope === 'open_brain') {
    return relativePath.startsWith('docs/open-brain') ||
      relativePath.startsWith('scripts/open-brain') ||
      relativePath.startsWith('lib/open-brain') ||
      relativePath.startsWith('lib/model-ops-open-brain') ||
      relativePath.startsWith('app/admin/agents/open-brain/') ||
      relativePath.startsWith('app/api/admin/agents/open-brain/')
  }
  return relativePath.startsWith('docs/') ||
    relativePath.startsWith('app/') ||
    relativePath.startsWith('components/') ||
    relativePath.startsWith('lib/') ||
    relativePath.startsWith('scripts/') ||
    relativePath === 'package.json' ||
    relativePath === 'package-lock.json'
}

function getPortfolioRoot() {
  return path.resolve(process.env.OPEN_BRAIN_PORTFOLIO_ROOT || process.cwd())
}

async function runGit(args: string[], cwd: string) {
  const result = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024,
  })
  return [result.stdout, result.stderr].filter(Boolean).join('\n')
}

async function runGitApply(unifiedDiff: string, cwd: string, args: string[]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'open-brain-mcp-patch-'))
  const patchPath = path.join(dir, 'update.patch')
  try {
    await writeFile(patchPath, unifiedDiff)
    return await runSpawn('git', ['apply', ...args, patchPath], cwd)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function runSpawn(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
        return
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit ${code}: ${stderr || stdout}`))
    })
  })
}

async function main() {
  const server = new McpServer({
    name: 'portfolio-open-brain',
    version: '0.2.0',
  })
  registerOpenBrainTools(server)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-mcp] Server error:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
