import { createHash, randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import { listCodexAutomationInventory } from './codex-automation-inventory'
import { getCodexWorkspaceRootReport } from './codex-workspace-roots'

export type OpenBrainPrivacyTier = 'public_safe' | 'client_safe' | 'internal_ops' | 'private'
export type OpenBrainSourceKind =
  | 'codex_automation'
  | 'workspace_root_report'
  | 'repair_packet'
  | 'runbook'
  | 'agent_run'
  | 'handoff'
  | 'work_item'
  | 'wiki_page'
export type OpenBrainMemoryKind = 'fact' | 'decision' | 'preference' | 'workflow' | 'risk' | 'operating_rule'
export type OpenBrainProposalStatus = 'pending' | 'approved' | 'rejected'

export interface OpenBrainSourceRecord {
  id: string
  kind: OpenBrainSourceKind
  title: string
  summary: string
  path: string | null
  privacyTier: OpenBrainPrivacyTier
  confidence: number
  lastObservedAt: string
  fingerprint: string
}

export interface OpenBrainMemoryRecord {
  id: string
  kind: OpenBrainMemoryKind
  title: string
  body: string
  privacyTier: OpenBrainPrivacyTier
  confidence: number
  sourceIds: string[]
  createdAt: string
  updatedAt: string
  fingerprint: string
}

export interface OpenBrainLinkRecord {
  id: string
  fromId: string
  toId: string
  relationship: string
  createdAt: string
}

export interface OpenBrainProposalRecord {
  id: string
  status: OpenBrainProposalStatus
  proposedMemory: Omit<OpenBrainMemoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'fingerprint'>
  sourceIds: string[]
  reason: string
  createdBy: string
  createdAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  reviewReason: string | null
}

export interface OpenBrainWikiPage {
  slug: string
  title: string
  path: string
  markdown: string
  sourceMemoryIds: string[]
  privacyTier: OpenBrainPrivacyTier
}

export interface OpenBrainRuntimeParity {
  runtime: 'Codex' | 'Hermes' | 'OpenCode' | 'ChatGPT' | 'Claude' | 'Cursor'
  status: 'connected' | 'skipped' | 'blocked'
  configPath: string
  note: string
}

export interface OpenBrainSnapshot {
  generatedAt: string
  service: {
    available: boolean
    storage: 'postgres_pgvector' | 'local_jsonl' | 'unconfigured'
    home: string
    databaseConfigured: boolean
    mcpConfigured: boolean
    mcpUrl: string | null
    reason: string | null
    operationalBoundary: string
  }
  overview: {
    sources: number
    memories: number
    pendingProposals: number
    approvedProposals: number
    rejectedProposals: number
    wikiPages: number
    staleSources: number
    privateRecords: number
  }
  health: {
    sourceFreshness: 'green' | 'yellow' | 'red'
    memoryHealth: 'green' | 'yellow' | 'red'
    proposalHealth: 'green' | 'yellow' | 'red'
    wikiOverlay: 'green' | 'yellow' | 'red'
  }
  sources: OpenBrainSourceRecord[]
  memories: OpenBrainMemoryRecord[]
  proposals: OpenBrainProposalRecord[]
  wikiPages: OpenBrainWikiPage[]
  runtimeParity: OpenBrainRuntimeParity[]
  contextPacket: {
    purpose: string
    boundaries: string[]
    requiredInputs: string[]
    currentRisks: string[]
    expectedOutputs: string[]
  }
}

export interface OpenBrainProposalInput {
  kind: OpenBrainMemoryKind
  title: string
  body: string
  privacyTier: OpenBrainPrivacyTier
  confidence?: number
  sourceIds?: string[]
  reason: string
  createdBy?: string
}

const DEFAULT_OPEN_BRAIN_HOME = path.join(homedir(), '.open-brain')
const PORTFOLIO_ROOT = '/Users/vambahsillah/Projects/Portfolio'
const PROPOSALS_FILE = 'proposals.json'
const MEMORIES_FILE = 'memories.json'
const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s,}]+)/gi

export function getOpenBrainHome() {
  return process.env.OPEN_BRAIN_HOME || DEFAULT_OPEN_BRAIN_HOME
}

export async function getOpenBrainSnapshot(openBrainHome = getOpenBrainHome()): Promise<OpenBrainSnapshot> {
  const generatedAt = new Date().toISOString()
  const [inventory, workspaceRoots, persistedMemories, persistedProposals] = await Promise.all([
    listCodexAutomationInventory(),
    getCodexWorkspaceRootReport(),
    readJsonArray<OpenBrainMemoryRecord>(path.join(openBrainHome, MEMORIES_FILE)),
    readJsonArray<OpenBrainProposalRecord>(path.join(openBrainHome, PROPOSALS_FILE)),
  ])

  const sources = dedupeSources([
    ...inventory.automations.map((automation): OpenBrainSourceRecord => ({
      id: `automation:${automation.id}`,
      kind: 'codex_automation',
      title: automation.name,
      summary: sanitizeOpenBrainText(`${automation.category} automation. Risk ${automation.riskLevel}. Context ${automation.contextHealth}.`),
      path: automation.sourceFile,
      privacyTier: 'internal_ops',
      confidence: 0.9,
      lastObservedAt: inventory.generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['codex_automation', automation.id, automation.sourceFile, automation.updatedAt || '']),
    })),
    ...inventory.repairPackets.map((packet): OpenBrainSourceRecord => ({
      id: `repair:${packet.automationId}`,
      kind: 'repair_packet',
      title: `${packet.automationName} repair packet`,
      summary: sanitizeOpenBrainText(packet.summary),
      path: packet.sourceFile,
      privacyTier: 'internal_ops',
      confidence: 0.86,
      lastObservedAt: inventory.generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['repair_packet', packet.automationId, packet.summary]),
    })),
    {
      id: 'workspace-root-report:codex',
      kind: 'workspace_root_report',
      title: 'Codex workspace-root report',
      summary: workspaceRoots.available
        ? `${workspaceRoots.overview.portfolioThreads} Portfolio thread(s), ${workspaceRoots.overview.nonPortfolioThreads} non-Portfolio thread(s), health ${workspaceRoots.health}.`
        : workspaceRoots.reason || 'Codex workspace-root report unavailable.',
      path: workspaceRoots.stateDatabase,
      privacyTier: 'internal_ops',
      confidence: workspaceRoots.available ? 0.88 : 0.45,
      lastObservedAt: workspaceRoots.generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['workspace_root_report', workspaceRoots.generatedAt, JSON.stringify(workspaceRoots.overview)]),
    },
    ...buildRunbookSources(generatedAt),
  ])

  const repairProposals = inventory.repairPackets.map((packet): OpenBrainProposalRecord => {
    const createdAt = inventory.generatedAt
    const title = `${packet.automationName} needs memory/context repair`
    const body = sanitizeOpenBrainText([
      packet.summary,
      `Missing context: ${packet.missingQuestions.join(', ') || 'none'}.`,
      `Recommended actions: ${packet.recommendedActions.join(' ')}`,
    ].join('\n'))
    return {
      id: `proposal:repair:${packet.automationId}`,
      status: 'pending',
      proposedMemory: {
        kind: 'workflow',
        title,
        body,
        privacyTier: 'internal_ops',
        confidence: 0.82,
        sourceIds: [`repair:${packet.automationId}`, `automation:${packet.automationId}`],
      },
      sourceIds: [`repair:${packet.automationId}`, `automation:${packet.automationId}`],
      reason: 'Generated from read-only automation repair packet. Requires approval before durable memory write.',
      createdBy: 'portfolio-open-brain-projection',
      createdAt,
      reviewedAt: null,
      reviewedBy: null,
      reviewReason: null,
    }
  })

  const proposals = mergeProposals(persistedProposals, repairProposals)
  const memories = dedupeMemories([
    ...persistedMemories,
    ...proposals.filter((proposal) => proposal.status === 'approved').map(proposalToMemory),
  ])
  const wikiPages = compileKarpathyWikiOverlay(memories)
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'pending').length
  const approvedProposals = proposals.filter((proposal) => proposal.status === 'approved').length
  const rejectedProposals = proposals.filter((proposal) => proposal.status === 'rejected').length
  const service = getServiceStatus(openBrainHome)

  return {
    generatedAt,
    service,
    overview: {
      sources: sources.length,
      memories: memories.length,
      pendingProposals,
      approvedProposals,
      rejectedProposals,
      wikiPages: wikiPages.length,
      staleSources: sources.filter((source) => isStale(source.lastObservedAt, generatedAt)).length,
      privateRecords: [
        ...sources.map((source) => source.privacyTier),
        ...memories.map((memory) => memory.privacyTier),
        ...proposals.map((proposal) => proposal.proposedMemory.privacyTier),
      ].filter((tier) => tier === 'private').length,
    },
    health: {
      sourceFreshness: classifyFreshness(sources, generatedAt),
      memoryHealth: memories.length > 0 ? 'green' : pendingProposals > 0 ? 'yellow' : 'red',
      proposalHealth: pendingProposals > 10 ? 'red' : pendingProposals > 0 ? 'yellow' : 'green',
      wikiOverlay: wikiPages.length > 0 ? 'green' : approvedProposals > 0 ? 'yellow' : 'red',
    },
    sources,
    memories,
    proposals,
    wikiPages,
    runtimeParity: buildRuntimeParity(openBrainHome),
    contextPacket: buildContextPacket(sources, memories, proposals),
  }
}

export function validateMemoryProposal(input: OpenBrainProposalInput): string[] {
  const errors: string[] = []
  if (!['fact', 'decision', 'preference', 'workflow', 'risk', 'operating_rule'].includes(input.kind)) errors.push('Unsupported memory kind.')
  if (!input.title?.trim()) errors.push('Title is required.')
  if (!input.body?.trim()) errors.push('Body is required.')
  if (!['public_safe', 'client_safe', 'internal_ops', 'private'].includes(input.privacyTier)) errors.push('Privacy tier is required.')
  if (!input.reason?.trim()) errors.push('Proposal reason is required.')
  if (input.privacyTier === 'public_safe' && input.body.match(SECRETISH_PATTERN)) errors.push('Public-safe memory cannot contain secret-like values.')
  return errors
}

export async function createOpenBrainProposal(
  input: OpenBrainProposalInput,
  openBrainHome = getOpenBrainHome(),
): Promise<OpenBrainProposalRecord> {
  const errors = validateMemoryProposal(input)
  if (errors.length > 0) throw new Error(errors.join(' '))
  await mkdir(openBrainHome, { recursive: true })
  const proposalsPath = path.join(openBrainHome, PROPOSALS_FILE)
  const proposals = await readJsonArray<OpenBrainProposalRecord>(proposalsPath)
  const now = new Date().toISOString()
  const proposedMemory = {
    kind: input.kind,
    title: sanitizeOpenBrainText(input.title),
    body: sanitizeOpenBrainText(input.body),
    privacyTier: input.privacyTier,
    confidence: clampConfidence(input.confidence ?? 0.75),
    sourceIds: input.sourceIds || [],
  }
  const proposal: OpenBrainProposalRecord = {
    id: `proposal:${randomUUID()}`,
    status: 'pending',
    proposedMemory,
    sourceIds: proposedMemory.sourceIds,
    reason: sanitizeOpenBrainText(input.reason),
    createdBy: input.createdBy || 'portfolio-admin',
    createdAt: now,
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
  }
  await writeJsonArray(proposalsPath, [...proposals, proposal])
  return proposal
}

export async function reviewOpenBrainProposal(
  id: string,
  status: Extract<OpenBrainProposalStatus, 'approved' | 'rejected'>,
  reviewReason: string,
  reviewedBy = 'portfolio-admin',
  openBrainHome = getOpenBrainHome(),
): Promise<OpenBrainProposalRecord> {
  const proposalsPath = path.join(openBrainHome, PROPOSALS_FILE)
  const proposals = await readJsonArray<OpenBrainProposalRecord>(proposalsPath)
  let index = proposals.findIndex((proposal) => proposal.id === id)
  if (index === -1) {
    const generated = (await getOpenBrainSnapshot(openBrainHome)).proposals.find((proposal) => proposal.id === id)
    if (!generated) throw new Error('Proposal not found in local Open Brain proposal store.')
    proposals.push(generated)
    index = proposals.length - 1
  }
  const reviewed = {
    ...proposals[index],
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy,
    reviewReason: sanitizeOpenBrainText(reviewReason || status),
  }
  proposals[index] = reviewed
  await writeJsonArray(proposalsPath, proposals)
  if (status === 'approved') {
    const memoriesPath = path.join(openBrainHome, MEMORIES_FILE)
    const memories = await readJsonArray<OpenBrainMemoryRecord>(memoriesPath)
    await writeJsonArray(memoriesPath, dedupeMemories([...memories, proposalToMemory(reviewed)]))
  }
  return reviewed
}

export function compileKarpathyWikiOverlay(memories: OpenBrainMemoryRecord[]): OpenBrainWikiPage[] {
  const approved = memories.filter((memory) => memory.privacyTier !== 'private')
  const grouped = new Map<OpenBrainMemoryKind, OpenBrainMemoryRecord[]>()
  for (const memory of approved) {
    grouped.set(memory.kind, [...(grouped.get(memory.kind) || []), memory])
  }

  const pages: OpenBrainWikiPage[] = []
  for (const [kind, records] of grouped.entries()) {
    const title = `${titleCase(kind.replace('_', ' '))} Memory`
    const slug = `${kind.replace(/_/g, '-')}-memory`
    const markdown = [
      `# ${title}`,
      '',
      'Generated Karpathy Wiki overlay from approved Open Brain records. The local Open Brain remains the source of truth.',
      '',
      ...records.map((record) => [
        `## ${record.title}`,
        '',
        record.body,
        '',
        `- Open Brain memory: \`${record.id}\``,
        `- Privacy tier: \`${record.privacyTier}\``,
        `- Sources: ${record.sourceIds.map((sourceId) => `\`${sourceId}\``).join(', ') || 'none'}`,
        '',
      ].join('\n')),
    ].join('\n')
    pages.push({
      slug,
      title,
      path: `docs/open-brain/wiki/${slug}.md`,
      markdown,
      sourceMemoryIds: records.map((record) => record.id),
      privacyTier: records.some((record) => record.privacyTier === 'internal_ops') ? 'internal_ops' : 'public_safe',
    })
  }
  return pages.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function fingerprintOpenBrainRecord(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part)).join('\u001f')).digest('hex')
}

export function sanitizeOpenBrainText(value: string, maxLength = 700) {
  return value.replace(SECRETISH_PATTERN, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function getServiceStatus(openBrainHome: string): OpenBrainSnapshot['service'] {
  const databaseUrl = process.env.OPEN_BRAIN_DATABASE_URL || ''
  const mcpUrl = process.env.OPEN_BRAIN_MCP_URL || ''
  const storage = databaseUrl ? 'postgres_pgvector' : existsSync(openBrainHome) ? 'local_jsonl' : 'unconfigured'
  const available = Boolean(databaseUrl || existsSync(openBrainHome))
  return {
    available,
    storage,
    home: openBrainHome,
    databaseConfigured: Boolean(databaseUrl),
    mcpConfigured: Boolean(mcpUrl),
    mcpUrl: mcpUrl || null,
    reason: available ? null : 'Local Open Brain storage is not configured yet. Set OPEN_BRAIN_DATABASE_URL or initialize OPEN_BRAIN_HOME.',
    operationalBoundary: 'Portfolio is a projection and approval surface. The local Open Brain service remains the source of truth; direct writes to Codex operational state require a separate approved repair step.',
  }
}

function buildRunbookSources(generatedAt: string): OpenBrainSourceRecord[] {
  const runbooks = [
    'docs/memory-context-organization-workflow.md',
    'docs/automations/README.md',
    'docs/automations/organization-runbook.md',
    'docs/automations/credentials-runbook.md',
    'docs/automations/content-voice-runbook.md',
  ]
  return runbooks.map((docPath) => ({
    id: `runbook:${docPath}`,
    kind: 'runbook',
    title: path.basename(docPath),
    summary: `Repo-owned governing document for Portfolio memory, context, and automation workflows.`,
    path: path.join(PORTFOLIO_ROOT, docPath),
    privacyTier: 'internal_ops',
    confidence: 0.8,
    lastObservedAt: generatedAt,
    fingerprint: fingerprintOpenBrainRecord(['runbook', docPath]),
  }))
}

function buildRuntimeParity(openBrainHome: string): OpenBrainRuntimeParity[] {
  const codexConfig = path.join(homedir(), '.codex', 'config.toml')
  const hermesConfig = path.join(homedir(), '.hermes', 'hermes-agent')
  const opencodeConfig = path.join(homedir(), '.config', 'opencode')
  const cursorConfig = path.join(homedir(), '.cursor')
  return [
    {
      runtime: 'Codex',
      status: existsSync(codexConfig) ? 'blocked' : 'skipped',
      configPath: codexConfig,
      note: existsSync(codexConfig)
        ? 'Codex config exists; register the Open Brain MCP server after approval.'
        : 'Codex config was not found on this machine.',
    },
    {
      runtime: 'Hermes',
      status: existsSync(hermesConfig) ? 'blocked' : 'skipped',
      configPath: hermesConfig,
      note: existsSync(hermesConfig)
        ? 'Hermes runtime exists; MCP parity registration still needs an approved operational step.'
        : 'Hermes runtime was not found on this machine.',
    },
    {
      runtime: 'OpenCode',
      status: existsSync(opencodeConfig) ? 'blocked' : 'skipped',
      configPath: opencodeConfig,
      note: existsSync(opencodeConfig)
        ? 'OpenCode-style config exists; connection should be verified by its own doctor/list command.'
        : 'OpenCode config was not found on this machine.',
    },
    {
      runtime: 'ChatGPT',
      status: 'blocked',
      configPath: openBrainHome,
      note: 'Needs an MCP or connector bridge that points at the local Open Brain service.',
    },
    {
      runtime: 'Claude',
      status: 'blocked',
      configPath: openBrainHome,
      note: 'Needs a separate Claude MCP registration; Codex config is not inherited.',
    },
    {
      runtime: 'Cursor',
      status: existsSync(cursorConfig) ? 'blocked' : 'skipped',
      configPath: cursorConfig,
      note: existsSync(cursorConfig)
        ? 'Cursor config exists; MCP registration should be handled separately from Codex.'
        : 'Cursor config was not found on this machine.',
    },
  ]
}

function buildContextPacket(
  sources: OpenBrainSourceRecord[],
  memories: OpenBrainMemoryRecord[],
  proposals: OpenBrainProposalRecord[],
): OpenBrainSnapshot['contextPacket'] {
  return {
    purpose: 'Use the local Open Brain to understand Portfolio Agent Ops context before acting; Portfolio Admin is the projection and approval layer.',
    boundaries: [
      'Do not treat generated wiki pages as the source of truth.',
      'Do not write durable memories from agent inference without approval.',
      'Do not mutate ~/.codex operational state from Portfolio APIs.',
    ],
    requiredInputs: sources.slice(0, 6).map((source) => source.title),
    currentRisks: [
      ...(memories.length === 0 ? ['No approved durable Open Brain memories have been accepted yet.'] : []),
      ...(proposals.some((proposal) => proposal.status === 'pending') ? ['Pending memory proposals need review before wiki overlay generation.'] : []),
    ],
    expectedOutputs: [
      'Context packet before agent action',
      'Approval-gated memory proposal',
      'Generated wiki overlay from approved non-private records',
    ],
  }
}

function mergeProposals(persisted: OpenBrainProposalRecord[], generated: OpenBrainProposalRecord[]) {
  const byId = new Map<string, OpenBrainProposalRecord>()
  for (const proposal of generated) byId.set(proposal.id, proposal)
  for (const proposal of persisted) byId.set(proposal.id, proposal)
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function proposalToMemory(proposal: OpenBrainProposalRecord): OpenBrainMemoryRecord {
  const createdAt = proposal.reviewedAt || proposal.createdAt
  return {
    id: `memory:${proposal.id.replace(/^proposal:/, '')}`,
    ...proposal.proposedMemory,
    sourceIds: proposal.proposedMemory.sourceIds || proposal.sourceIds,
    createdAt,
    updatedAt: createdAt,
    fingerprint: fingerprintOpenBrainRecord([
      proposal.proposedMemory.kind,
      proposal.proposedMemory.title,
      proposal.proposedMemory.body,
      proposal.proposedMemory.privacyTier,
    ]),
  }
}

function dedupeSources(sources: OpenBrainSourceRecord[]) {
  return [...new Map(sources.map((source) => [source.fingerprint, source])).values()]
}

function dedupeMemories(memories: OpenBrainMemoryRecord[]) {
  return [...new Map(memories.map((memory) => [memory.fingerprint, memory])).values()]
}

function classifyFreshness(sources: OpenBrainSourceRecord[], now: string) {
  if (sources.length === 0) return 'red'
  const stale = sources.filter((source) => isStale(source.lastObservedAt, now)).length
  if (stale === 0) return 'green'
  if (stale > sources.length / 2) return 'red'
  return 'yellow'
}

function isStale(lastObservedAt: string, now: string) {
  return Date.parse(now) - Date.parse(lastObservedAt) > 1000 * 60 * 60 * 24 * 14
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value))
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  if (!existsSync(filePath)) return []
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeJsonArray<T>(filePath: string, records: T[]) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}
