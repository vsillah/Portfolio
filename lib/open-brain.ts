import { createHash, randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import { listCodexAutomationInventory } from './codex-automation-inventory'
import { getCodexWorkspaceRootReport } from './codex-workspace-roots'
import { getModelOpsProjection, type ModelOpsProjection } from './model-ops-open-brain'

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
  | 'model_ops_report'
  | 'model_ops_dashboard'
  | 'model_ops_swap_request'
  | 'personality_corpus'
  | 'chatbot_knowledge'
  | 'rag_projection'
  | 'pinecone_projection'
  | 'autoresearch_proposal'
  | 'autoresearch_result'
  | 'open_brain_runtime'
export type OpenBrainMemoryKind = 'fact' | 'decision' | 'preference' | 'workflow' | 'risk' | 'operating_rule'
export type OpenBrainProposalStatus = 'pending' | 'approved' | 'rejected'
export type OpenBrainEventKind =
  | 'source_observed'
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'projection_compiled'
  | 'autoresearch_proposal_created'
  | 'rag_projection_staged'

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

export interface OpenBrainEventRecord {
  id: string
  kind: OpenBrainEventKind
  title: string
  summary: string
  privacyTier: OpenBrainPrivacyTier
  confidence: number
  sourceIds: string[]
  createdAt: string
  fingerprint: string
  metadata?: Record<string, unknown>
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

export interface OpenBrainRagProjectionDocument {
  id: string
  title: string
  text: string
  metadata: {
    openBrainMemoryId: string
    openBrainSourceIds: string[]
    privacyTier: Extract<OpenBrainPrivacyTier, 'public_safe'>
    sourceHash: string
    projectionVersion: string
    deletionKey: string
    rollbackKey: string
  }
}

export interface OpenBrainRuntimeParity {
  runtime: 'Codex' | 'Hermes' | 'OpenCode' | 'ChatGPT' | 'Claude' | 'Cursor'
  status: 'connected' | 'skipped' | 'blocked'
  configPath: string
  note: string
}

export interface OpenBrainProducerGate {
  id: string
  label: string
  status: 'enabled' | 'disabled' | 'shadow_only' | 'approval_gated' | 'blocked'
  sourceKind: OpenBrainSourceKind
  eventKind: OpenBrainEventKind | null
  privacyTier: OpenBrainPrivacyTier
  envVar: string | null
  configuredValue: string | null
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
    events: number
    links: number
    ragProjectionDocuments: number
    staleSources: number
    privateRecords: number
    producerGates: number
    enabledProducerGates: number
  }
  health: {
    sourceFreshness: 'green' | 'yellow' | 'red'
    memoryHealth: 'green' | 'yellow' | 'red'
    proposalHealth: 'green' | 'yellow' | 'red'
    wikiOverlay: 'green' | 'yellow' | 'red'
  }
  sources: OpenBrainSourceRecord[]
  events: OpenBrainEventRecord[]
  links: OpenBrainLinkRecord[]
  memories: OpenBrainMemoryRecord[]
  proposals: OpenBrainProposalRecord[]
  wikiPages: OpenBrainWikiPage[]
  ragProjection: {
    version: string
    documents: OpenBrainRagProjectionDocument[]
    eligibleMemoryCount: number
    excludedPrivateCount: number
    pineconeWriteStatus: 'blocked_pending_approval'
  }
  runtimeParity: OpenBrainRuntimeParity[]
  producerGates: OpenBrainProducerGate[]
  modelOps: ModelOpsProjection
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
const SOURCES_FILE = 'sources.json'
const EVENTS_FILE = 'events.json'
const LINKS_FILE = 'links.json'
const RAG_PROJECTION_VERSION = 'open-brain-rag-projection-v1'
const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s,}]+)/gi

export function getOpenBrainHome() {
  return process.env.OPEN_BRAIN_HOME || DEFAULT_OPEN_BRAIN_HOME
}

export async function getOpenBrainSnapshot(openBrainHome = getOpenBrainHome()): Promise<OpenBrainSnapshot> {
  const generatedAt = new Date().toISOString()
  const [
    inventory,
    workspaceRoots,
    persistedMemories,
    persistedProposals,
    persistedSources,
    persistedEvents,
    persistedLinks,
    modelOps,
  ] = await Promise.all([
    listCodexAutomationInventory(),
    getCodexWorkspaceRootReport(),
    readJsonArray<OpenBrainMemoryRecord>(path.join(openBrainHome, MEMORIES_FILE)),
    readJsonArray<OpenBrainProposalRecord>(path.join(openBrainHome, PROPOSALS_FILE)),
    readJsonArray<OpenBrainSourceRecord>(path.join(openBrainHome, SOURCES_FILE)),
    readJsonArray<OpenBrainEventRecord>(path.join(openBrainHome, EVENTS_FILE)),
    readJsonArray<OpenBrainLinkRecord>(path.join(openBrainHome, LINKS_FILE)),
    getModelOpsProjection(),
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
    ...buildModelOpsSources(modelOps),
    ...(await buildKnowledgeProjectionSources(generatedAt)),
    ...persistedSources,
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
  const events = dedupeEvents([
    ...buildObservedSourceEvents(sources, generatedAt),
    ...persistedEvents,
  ])
  const links = dedupeLinks(persistedLinks)
  const wikiPages = compileKarpathyWikiOverlay(memories, events)
  const ragProjection = buildOpenBrainRagProjection(memories)
  const runtimeParity = await buildRuntimeParity(openBrainHome)
  const producerGates = buildProducerGates(modelOps)
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'pending').length
  const approvedProposals = proposals.filter((proposal) => proposal.status === 'approved').length
  const rejectedProposals = proposals.filter((proposal) => proposal.status === 'rejected').length
  const service = getServiceStatus(openBrainHome, runtimeParity.some((runtime) => runtime.status === 'connected'))

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
      events: events.length,
      links: links.length,
      ragProjectionDocuments: ragProjection.documents.length,
      staleSources: sources.filter((source) => isStale(source.lastObservedAt, generatedAt)).length,
      privateRecords: [
        ...sources.map((source) => source.privacyTier),
        ...events.map((event) => event.privacyTier),
        ...memories.map((memory) => memory.privacyTier),
        ...proposals.map((proposal) => proposal.proposedMemory.privacyTier),
      ].filter((tier) => tier === 'private').length,
      producerGates: producerGates.length,
      enabledProducerGates: producerGates.filter((gate) => gate.status === 'enabled').length,
    },
    health: {
      sourceFreshness: classifyFreshness(sources, generatedAt),
      memoryHealth: memories.length > 0 ? 'green' : pendingProposals > 0 ? 'yellow' : 'red',
      proposalHealth: pendingProposals > 10 ? 'red' : pendingProposals > 0 ? 'yellow' : 'green',
      wikiOverlay: wikiPages.length > 0 ? 'green' : approvedProposals > 0 ? 'yellow' : 'red',
    },
    sources,
    events,
    links,
    memories,
    proposals,
    wikiPages,
    ragProjection,
    runtimeParity,
    producerGates,
    modelOps,
    contextPacket: buildContextPacket(sources, memories, proposals, modelOps, producerGates),
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
  await recordOpenBrainEvent({
    kind: 'proposal_created',
    title: `Memory proposal created: ${proposal.proposedMemory.title}`,
    summary: proposal.reason,
    privacyTier: proposal.proposedMemory.privacyTier,
    confidence: proposal.proposedMemory.confidence,
    sourceIds: proposal.sourceIds,
    metadata: {
      proposalId: proposal.id,
      createdBy: proposal.createdBy,
      memoryKind: proposal.proposedMemory.kind,
    },
  }, openBrainHome)
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
  await recordOpenBrainEvent({
    kind: status === 'approved' ? 'proposal_approved' : 'proposal_rejected',
    title: `Memory proposal ${status}: ${reviewed.proposedMemory.title}`,
    summary: reviewed.reviewReason || status,
    privacyTier: reviewed.proposedMemory.privacyTier,
    confidence: reviewed.proposedMemory.confidence,
    sourceIds: reviewed.sourceIds,
    metadata: {
      proposalId: reviewed.id,
      reviewedBy: reviewed.reviewedBy,
      memoryKind: reviewed.proposedMemory.kind,
    },
  }, openBrainHome)
  return reviewed
}

export async function recordOpenBrainSource(
  source: Omit<OpenBrainSourceRecord, 'lastObservedAt' | 'fingerprint'> & {
    lastObservedAt?: string
    fingerprint?: string
  },
  openBrainHome = getOpenBrainHome(),
): Promise<OpenBrainSourceRecord> {
  const now = new Date().toISOString()
  const record: OpenBrainSourceRecord = {
    ...source,
    title: sanitizeOpenBrainText(source.title, 180),
    summary: sanitizeOpenBrainText(source.summary),
    lastObservedAt: source.lastObservedAt || now,
    fingerprint: source.fingerprint || fingerprintOpenBrainRecord([
      source.kind,
      source.id,
      source.title,
      source.summary,
      source.path || '',
    ]),
  }
  const filePath = path.join(openBrainHome, SOURCES_FILE)
  const sources = await readJsonArray<OpenBrainSourceRecord>(filePath)
  await writeJsonArray(filePath, dedupeSources([...sources, record]))
  return record
}

export async function recordOpenBrainEvent(
  input: Omit<OpenBrainEventRecord, 'id' | 'createdAt' | 'fingerprint'> & {
    id?: string
    createdAt?: string
    fingerprint?: string
  },
  openBrainHome = getOpenBrainHome(),
): Promise<OpenBrainEventRecord> {
  const now = new Date().toISOString()
  const record: OpenBrainEventRecord = {
    id: input.id || `event:${randomUUID()}`,
    kind: input.kind,
    title: sanitizeOpenBrainText(input.title, 180),
    summary: sanitizeOpenBrainText(input.summary),
    privacyTier: input.privacyTier,
    confidence: clampConfidence(input.confidence),
    sourceIds: input.sourceIds,
    createdAt: input.createdAt || now,
    fingerprint: input.fingerprint || fingerprintOpenBrainRecord([
      input.kind,
      input.title,
      input.summary,
      input.sourceIds.join(','),
      input.createdAt || now,
    ]),
    metadata: input.metadata,
  }
  const filePath = path.join(openBrainHome, EVENTS_FILE)
  const events = await readJsonArray<OpenBrainEventRecord>(filePath)
  await writeJsonArray(filePath, dedupeEvents([...events, record]))
  return record
}

export async function linkOpenBrainRecords(
  input: Omit<OpenBrainLinkRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  openBrainHome = getOpenBrainHome(),
): Promise<OpenBrainLinkRecord> {
  const record: OpenBrainLinkRecord = {
    id: input.id || `link:${fingerprintOpenBrainRecord([input.fromId, input.toId, input.relationship]).slice(0, 16)}`,
    fromId: input.fromId,
    toId: input.toId,
    relationship: sanitizeOpenBrainText(input.relationship, 160),
    createdAt: input.createdAt || new Date().toISOString(),
  }
  const filePath = path.join(openBrainHome, LINKS_FILE)
  const links = await readJsonArray<OpenBrainLinkRecord>(filePath)
  await writeJsonArray(filePath, dedupeLinks([...links, record]))
  return record
}

export function buildOpenBrainRagProjection(memories: OpenBrainMemoryRecord[]): OpenBrainSnapshot['ragProjection'] {
  const publicSafe = memories.filter((memory) => memory.privacyTier === 'public_safe')
  const documents = publicSafe.map((memory): OpenBrainRagProjectionDocument => ({
    id: `open-brain-rag:${memory.id}`,
    title: memory.title,
    text: memory.body,
    metadata: {
      openBrainMemoryId: memory.id,
      openBrainSourceIds: memory.sourceIds,
      privacyTier: 'public_safe',
      sourceHash: memory.fingerprint,
      projectionVersion: RAG_PROJECTION_VERSION,
      deletionKey: `open-brain:${memory.id}`,
      rollbackKey: `open-brain:${memory.fingerprint}`,
    },
  }))

  return {
    version: RAG_PROJECTION_VERSION,
    documents,
    eligibleMemoryCount: publicSafe.length,
    excludedPrivateCount: memories.filter((memory) => memory.privacyTier !== 'public_safe').length,
    pineconeWriteStatus: 'blocked_pending_approval',
  }
}

export function compileKarpathyWikiOverlay(
  memories: OpenBrainMemoryRecord[],
  events: OpenBrainEventRecord[] = [],
): OpenBrainWikiPage[] {
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

  const autoresearchEvents = events.filter((event) =>
    event.privacyTier !== 'private' && event.kind.startsWith('autoresearch_')
  )
  if (autoresearchEvents.length > 0) {
    pages.push({
      slug: 'autoresearch-experiment-ledger',
      title: 'AutoResearch Experiment Ledger',
      path: 'docs/open-brain/wiki/autoresearch-experiment-ledger.md',
      markdown: [
        '# AutoResearch Experiment Ledger',
        '',
        'Generated Karpathy Wiki overlay from Open Brain source/event records. The local Open Brain remains the source of truth.',
        '',
        ...autoresearchEvents.map((event) => [
          `## ${event.title}`,
          '',
          event.summary,
          '',
          `- Open Brain event: \`${event.id}\``,
          `- Privacy tier: \`${event.privacyTier}\``,
          `- Sources: ${event.sourceIds.map((sourceId) => `\`${sourceId}\``).join(', ') || 'none'}`,
          '',
        ].join('\n')),
      ].join('\n'),
      sourceMemoryIds: [],
      privacyTier: autoresearchEvents.some((event) => event.privacyTier === 'internal_ops') ? 'internal_ops' : 'public_safe',
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

function getServiceStatus(openBrainHome: string, runtimeMcpConfigured = false): OpenBrainSnapshot['service'] {
  const databaseUrl = process.env.OPEN_BRAIN_DATABASE_URL || ''
  const mcpUrl = process.env.OPEN_BRAIN_MCP_URL || ''
  const storage = databaseUrl ? 'postgres_pgvector' : existsSync(openBrainHome) ? 'local_jsonl' : 'unconfigured'
  const available = Boolean(databaseUrl || existsSync(openBrainHome))
  return {
    available,
    storage,
    home: openBrainHome,
    databaseConfigured: Boolean(databaseUrl),
    mcpConfigured: Boolean(mcpUrl || runtimeMcpConfigured),
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

async function buildKnowledgeProjectionSources(generatedAt: string): Promise<OpenBrainSourceRecord[]> {
  const personalityPath = path.join(PORTFOLIO_ROOT, 'docs/vambah-personality-public-safe.md')
  const chatbotPath = path.join(PORTFOLIO_ROOT, 'lib/chatbot-knowledge.ts')
  const ragManifestPath = path.join(PORTFOLIO_ROOT, 'lib/knowledge-source-manifest.ts')
  const sources: OpenBrainSourceRecord[] = []

  if (existsSync(personalityPath)) {
    const content = await readFile(personalityPath, 'utf8').catch(() => '')
    sources.push({
      id: 'personality-corpus:public-safe',
      kind: 'personality_corpus',
      title: 'Personality corpus public-safe pack',
      summary: 'Public-safe derived personality corpus pack used by content agents and chatbot knowledge. Raw private exports are excluded.',
      path: personalityPath,
      privacyTier: 'public_safe',
      confidence: 0.9,
      lastObservedAt: generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['personality_corpus', personalityPath, content]),
    })
  }

  if (existsSync(chatbotPath)) {
    const content = await readFile(chatbotPath, 'utf8').catch(() => '')
    sources.push({
      id: 'chatbot-knowledge:local-bundle',
      kind: 'chatbot_knowledge',
      title: 'Portfolio chatbot knowledge bundle',
      summary: 'Local /api/knowledge bundle remains a public-safe projection and should not become canonical memory.',
      path: chatbotPath,
      privacyTier: 'public_safe',
      confidence: 0.86,
      lastObservedAt: generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['chatbot_knowledge', chatbotPath, content]),
    })
  }

  if (existsSync(ragManifestPath)) {
    const content = await readFile(ragManifestPath, 'utf8').catch(() => '')
    sources.push({
      id: 'rag-projection:knowledge-source-manifest',
      kind: 'rag_projection',
      title: 'Governed RAG source manifest',
      summary: 'Repo-owned RAG manifest stages approved public-safe/client-safe projections; Pinecone writes remain approval-gated.',
      path: ragManifestPath,
      privacyTier: 'internal_ops',
      confidence: 0.88,
      lastObservedAt: generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['rag_projection', ragManifestPath, content]),
    })
  }

  return sources
}

function buildObservedSourceEvents(sources: OpenBrainSourceRecord[], generatedAt: string): OpenBrainEventRecord[] {
  return sources.map((source) => ({
    id: `event:source-observed:${source.id}`,
    kind: 'source_observed',
    title: `Observed source: ${source.title}`,
    summary: source.summary,
    privacyTier: source.privacyTier,
    confidence: source.confidence,
    sourceIds: [source.id],
    createdAt: generatedAt,
    fingerprint: fingerprintOpenBrainRecord(['source_observed', source.id, source.fingerprint]),
    metadata: {
      sourceKind: source.kind,
      path: source.path,
    },
  }))
}

function buildModelOpsSources(modelOps: ModelOpsProjection): OpenBrainSourceRecord[] {
  if (!modelOps.available) {
    return [{
      id: 'model-ops:dashboard:missing',
      kind: 'model_ops_dashboard',
      title: 'Model Ops dashboard data unavailable',
      summary: sanitizeOpenBrainText(modelOps.reason || 'Local LLM Model Ops reports are not available.'),
      path: modelOps.sourceRoot,
      privacyTier: 'internal_ops',
      confidence: 0.4,
      lastObservedAt: modelOps.generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['model_ops_missing', modelOps.sourceRoot, modelOps.reason || '']),
    }]
  }

  return [
    {
      id: 'model-ops:dashboard:latest',
      kind: 'model_ops_dashboard',
      title: `${modelOps.projectName} dashboard data`,
      summary: sanitizeOpenBrainText(`${modelOps.routerDecisions.length} router decision(s), ${modelOps.benchmarkResults.length} benchmark result(s), ${modelOps.ragQualityRuns.length} RAG quality run(s).`),
      path: path.join(modelOps.sourceRoot, 'reports/latest-dashboard-data.json'),
      privacyTier: 'internal_ops',
      confidence: 0.9,
      lastObservedAt: modelOps.generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['model_ops_dashboard', modelOps.generatedAt, modelOps.routerDecisions.length]),
    },
    {
      id: 'model-ops:monitor:latest',
      kind: 'model_ops_report',
      title: modelOps.monitor.name,
      summary: sanitizeOpenBrainText(`${modelOps.monitor.cadence}. ${modelOps.monitor.productionGate}`),
      path: modelOps.monitor.latestReportPath,
      privacyTier: 'internal_ops',
      confidence: 0.86,
      lastObservedAt: modelOps.generatedAt,
      fingerprint: fingerprintOpenBrainRecord(['model_ops_monitor', modelOps.monitor.latestReportPath || '', modelOps.generatedAt]),
    },
    ...modelOps.swapRequests.map((request): OpenBrainSourceRecord => ({
      id: `model-ops:swap-request:${request.id}`,
      kind: 'model_ops_swap_request',
      title: request.title,
      summary: `Approval state ${request.approvalState}; linked router decision(s): ${request.routerDecisionIds.join(', ') || 'none'}.`,
      path: request.sourcePath,
      privacyTier: 'internal_ops',
      confidence: 0.8,
      lastObservedAt: request.sourceGeneratedAt || modelOps.generatedAt,
      fingerprint: request.fingerprint,
    })),
  ]
}

async function buildRuntimeParity(openBrainHome: string): Promise<OpenBrainRuntimeParity[]> {
  const codexConfig = path.join(homedir(), '.codex', 'config.toml')
  const hermesConfig = path.join(homedir(), '.hermes', 'config.yaml')
  const opencodeConfig = path.join(homedir(), '.config', 'opencode')
  const cursorConfig = path.join(homedir(), '.cursor')
  const [codexConfigText, hermesConfigText] = await Promise.all([
    readOptionalText(codexConfig),
    readOptionalText(hermesConfig),
  ])
  const codexConnected = hasOpenBrainMcpRegistration(codexConfigText, openBrainHome)
  const hermesConnected = hasOpenBrainMcpRegistration(hermesConfigText, openBrainHome)
  return [
    {
      runtime: 'Codex',
      status: codexConnected ? 'connected' : existsSync(codexConfig) ? 'blocked' : 'skipped',
      configPath: codexConfig,
      note: codexConnected
        ? 'Codex config includes the open-brain MCP stdio server and local OPEN_BRAIN_HOME.'
        : existsSync(codexConfig)
        ? 'Codex config exists, but the Open Brain MCP registration was not detected.'
        : 'Codex config was not found on this machine.',
    },
    {
      runtime: 'Hermes',
      status: hermesConnected ? 'connected' : existsSync(hermesConfig) ? 'blocked' : 'skipped',
      configPath: hermesConfig,
      note: hermesConnected
        ? 'Hermes config includes the open-brain MCP stdio server and local OPEN_BRAIN_HOME.'
        : existsSync(hermesConfig)
        ? 'Hermes config exists, but the Open Brain MCP registration was not detected.'
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

function buildProducerGates(modelOps: ModelOpsProjection): OpenBrainProducerGate[] {
  const autoresearchTrace = process.env.OPEN_BRAIN_AUTORESEARCH_TRACE || null
  return [
    {
      id: 'producer:personality-corpus',
      label: 'Personality corpus',
      status: 'enabled',
      sourceKind: 'personality_corpus',
      eventKind: 'source_observed',
      privacyTier: 'public_safe',
      envVar: null,
      configuredValue: null,
      note: 'Public-safe derived corpus pack may be observed as an Open Brain source. Raw private exports remain excluded.',
    },
    {
      id: 'producer:chatbot-knowledge',
      label: 'Chatbot knowledge',
      status: 'enabled',
      sourceKind: 'chatbot_knowledge',
      eventKind: 'source_observed',
      privacyTier: 'public_safe',
      envVar: null,
      configuredValue: null,
      note: 'Portfolio /api/knowledge is a projection source only; durable memory still requires approval.',
    },
    {
      id: 'producer:autoresearch',
      label: 'AutoResearch traces',
      status: autoresearchTrace === 'true' || autoresearchTrace === '1' ? 'enabled' : 'disabled',
      sourceKind: 'autoresearch_proposal',
      eventKind: 'autoresearch_proposal_created',
      privacyTier: 'internal_ops',
      envVar: 'OPEN_BRAIN_AUTORESEARCH_TRACE',
      configuredValue: autoresearchTrace,
      note: autoresearchTrace === 'true' || autoresearchTrace === '1'
        ? 'AutoResearch can emit source/event traces and approval packets, but cannot execute experiments automatically.'
        : 'AutoResearch trace emission is off until OPEN_BRAIN_AUTORESEARCH_TRACE=true is explicitly configured.',
    },
    {
      id: 'producer:model-ops',
      label: 'Model Ops projection',
      status: modelOps.available ? 'enabled' : 'blocked',
      sourceKind: modelOps.available ? 'model_ops_dashboard' : 'model_ops_report',
      eventKind: 'source_observed',
      privacyTier: 'internal_ops',
      envVar: null,
      configuredValue: null,
      note: modelOps.available
        ? 'Model Ops reports can be observed as source records; model swaps remain approval-gated.'
        : modelOps.reason || 'Model Ops report data is not currently available.',
    },
    {
      id: 'producer:rag-pinecone',
      label: 'RAG and Pinecone',
      status: 'approval_gated',
      sourceKind: 'rag_projection',
      eventKind: 'rag_projection_staged',
      privacyTier: 'public_safe',
      envVar: null,
      configuredValue: null,
      note: 'RAG staging can use approved public-safe projections. Pinecone writes remain blocked until a separate approval step.',
    },
  ]
}

function buildContextPacket(
  sources: OpenBrainSourceRecord[],
  memories: OpenBrainMemoryRecord[],
  proposals: OpenBrainProposalRecord[],
  modelOps: ModelOpsProjection,
  producerGates: OpenBrainProducerGate[],
): OpenBrainSnapshot['contextPacket'] {
  return {
    purpose: 'Use the local Open Brain to understand Portfolio Agent Ops context before acting; Portfolio Admin is the projection and approval layer.',
    boundaries: [
      'Do not treat generated wiki pages as the source of truth.',
      'Do not write durable memories from agent inference without approval.',
      'Do not mutate ~/.codex operational state from Portfolio APIs.',
      'Do not bifurcate local open-source and frontier model routing surfaces; use the unified router decision record.',
      'Do not change production model defaults without an approved Model Ops swap request.',
    ],
    requiredInputs: sources.slice(0, 6).map((source) => source.title),
    currentRisks: [
      ...(memories.length === 0 ? ['No approved durable Open Brain memories have been accepted yet.'] : []),
      ...(proposals.some((proposal) => proposal.status === 'pending') ? ['Pending memory proposals need review before wiki overlay generation.'] : []),
      ...(!modelOps.available ? ['Model Ops reports are not available to the Open Brain projection.'] : []),
      ...(modelOps.available && modelOps.routerDecisions.some((decision) => decision.approvalState === 'approval_required')
        ? ['Model Ops has approval-gated router decisions that cannot be applied automatically.']
        : []),
      ...(producerGates.some((gate) => gate.status === 'blocked')
        ? ['One or more Open Brain producer gates are blocked and should not emit records yet.']
        : []),
    ],
    expectedOutputs: [
      'Context packet before agent action',
      'Approval-gated memory proposal',
      'Generated wiki overlay from approved non-private records',
      'Unified router decision before local, frontier, hybrid, tool, or approval-gated model execution',
    ],
  }
}

async function readOptionalText(filePath: string) {
  if (!existsSync(filePath)) return null
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function hasOpenBrainMcpRegistration(configText: string | null, openBrainHome: string) {
  if (!configText) return false
  return configText.includes('open-brain') && configText.includes('OPEN_BRAIN_HOME') && configText.includes(openBrainHome)
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

function dedupeEvents(events: OpenBrainEventRecord[]) {
  return [...new Map(events.map((event) => [event.fingerprint, event])).values()]
}

function dedupeLinks(links: OpenBrainLinkRecord[]) {
  return [...new Map(links.map((link) => [link.id, link])).values()]
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
