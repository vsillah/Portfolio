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
  metadata?: OpenBrainProposalMetadata
}

export interface OpenBrainProposalMetadata {
  relationship?: OpenBrainRelationshipProposalMetadata
}

export interface OpenBrainRelationshipProposalMetadata {
  fromId: string
  toId: string
  relationship: string
  insightId: string
  insightKind: OpenBrainRelationshipInsightKind
  sourceLabel: string
  targetLabel: string
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

export type OpenBrainRelationshipNodeType = 'source' | 'memory' | 'event' | 'wiki' | 'proposal'
export type OpenBrainRelationshipEdgeStrength = 'strong' | 'medium' | 'weak'
export type OpenBrainRelationshipInsightKind = 'strengthen' | 'review' | 'missing_governance' | 'merge_duplicate'

export interface OpenBrainRelationshipNode {
  id: string
  label: string
  type: OpenBrainRelationshipNodeType
  kind: string
  privacyTier: OpenBrainPrivacyTier
  summary: string
  path: string | null
  health: 'green' | 'yellow' | 'red'
  x: number
  y: number
}

export interface OpenBrainRelationshipEdge {
  id: string
  fromId: string
  toId: string
  relationship: string
  strength: OpenBrainRelationshipEdgeStrength
  confidence: number
  evidence: string
  status: 'persisted' | 'inferred' | 'recommended'
}

export interface OpenBrainRelationshipInsight {
  id: string
  kind: OpenBrainRelationshipInsightKind
  severity: 'low' | 'medium' | 'high'
  title: string
  detail: string
  recommendation: string
  actionLabel: string
  sourceNodeId: string | null
  targetNodeId: string | null
}

export interface OpenBrainRelationshipAuditRecord {
  linkId: string
  fromId: string
  toId: string
  relationship: string
  sourceLabel: string
  targetLabel: string
  sourceProposalId: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  eventId: string | null
  createdAt: string
  evidence: string
}

export interface OpenBrainRelationshipMap {
  overview: {
    relationships: number
    strongRelationships: number
    weakRelationships: number
    orphanedRecords: number
    staleSources: number
    proposalSuggestions: number
  }
  nodes: OpenBrainRelationshipNode[]
  edges: OpenBrainRelationshipEdge[]
  insights: OpenBrainRelationshipInsight[]
  audit: OpenBrainRelationshipAuditRecord[]
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
  relationshipMap: OpenBrainRelationshipMap
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
  metadata?: OpenBrainProposalMetadata
}

const DEFAULT_OPEN_BRAIN_HOME = path.join(homedir(), '.open-brain')
const PORTFOLIO_ROOT = path.resolve(process.env.OPEN_BRAIN_PORTFOLIO_ROOT || process.cwd())
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
  const relationshipMap = buildOpenBrainRelationshipMap({
    sources,
    events,
    links,
    memories,
    proposals,
    wikiPages,
    generatedAt,
  })
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
    relationshipMap,
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
    metadata: normalizeOpenBrainProposalMetadata(input.metadata),
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
      relationship: proposal.metadata?.relationship,
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
  let approvedRelationshipLink: OpenBrainLinkRecord | null = null
  if (status === 'approved') {
    const memoriesPath = path.join(openBrainHome, MEMORIES_FILE)
    const memories = await readJsonArray<OpenBrainMemoryRecord>(memoriesPath)
    await writeJsonArray(memoriesPath, dedupeMemories([...memories, proposalToMemory(reviewed)]))
    const relationshipLinkInput = relationshipLinkFromProposal(reviewed)
    if (relationshipLinkInput) {
      approvedRelationshipLink = await linkOpenBrainRecords(relationshipLinkInput, openBrainHome)
    }
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
      relationship: reviewed.metadata?.relationship,
      relationshipLinkId: approvedRelationshipLink?.id,
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

export function buildOpenBrainRelationshipMap({
  sources,
  events,
  links,
  memories,
  proposals,
  wikiPages,
  generatedAt,
}: {
  sources: OpenBrainSourceRecord[]
  events: OpenBrainEventRecord[]
  links: OpenBrainLinkRecord[]
  memories: OpenBrainMemoryRecord[]
  proposals: OpenBrainProposalRecord[]
  wikiPages: OpenBrainWikiPage[]
  generatedAt: string
}): OpenBrainRelationshipMap {
  const visibleEvents = events.filter((event) => event.kind !== 'source_observed')
  const nodes: OpenBrainRelationshipNode[] = [
    ...sources.map((source, index) => sourceToRelationshipNode(source, index, generatedAt)),
    ...memories.map((memory, index) => memoryToRelationshipNode(memory, index)),
    ...visibleEvents.map((event, index) => eventToRelationshipNode(event, index)),
    ...wikiPages.map((page, index) => wikiToRelationshipNode(page, index)),
    ...proposals.map((proposal, index) => proposalToRelationshipNode(proposal, index)),
  ]
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edgeMap = new Map<string, OpenBrainRelationshipEdge>()

  for (const link of links) {
    if (!nodeIds.has(link.fromId) || !nodeIds.has(link.toId)) continue
    addRelationshipEdge(edgeMap, {
      id: link.id,
      fromId: link.fromId,
      toId: link.toId,
      relationship: link.relationship,
      strength: 'strong',
      confidence: 0.94,
      evidence: 'Persisted local Open Brain link record.',
      status: 'persisted',
    })
  }

  for (const memory of memories) {
    for (const sourceId of memory.sourceIds) {
      if (!nodeIds.has(sourceId)) continue
      addRelationshipEdge(edgeMap, {
        id: `edge:memory-source:${fingerprintOpenBrainRecord([memory.id, sourceId]).slice(0, 16)}`,
        fromId: sourceId,
        toId: memory.id,
        relationship: 'supports_memory',
        strength: memory.confidence >= 0.8 ? 'strong' : 'medium',
        confidence: memory.confidence,
        evidence: 'Memory record cites this source id.',
        status: 'inferred',
      })
    }
  }

  for (const proposal of proposals) {
    const proposalNodeId = relationshipProposalNodeId(proposal.id)
    for (const sourceId of proposal.sourceIds) {
      if (!nodeIds.has(sourceId)) continue
      addRelationshipEdge(edgeMap, {
        id: `edge:proposal-source:${fingerprintOpenBrainRecord([proposal.id, sourceId]).slice(0, 16)}`,
        fromId: sourceId,
        toId: proposalNodeId,
        relationship: 'proposes_context',
        strength: proposal.status === 'pending' ? 'medium' : 'weak',
        confidence: proposal.proposedMemory.confidence,
        evidence: 'Memory proposal cites this source id and still requires review.',
        status: 'inferred',
      })
    }
  }

  for (const page of wikiPages) {
    const wikiNodeId = relationshipWikiNodeId(page.slug)
    for (const memoryId of page.sourceMemoryIds) {
      if (!nodeIds.has(memoryId)) continue
      addRelationshipEdge(edgeMap, {
        id: `edge:wiki-memory:${fingerprintOpenBrainRecord([page.slug, memoryId]).slice(0, 16)}`,
        fromId: memoryId,
        toId: wikiNodeId,
        relationship: 'compiled_overlay',
        strength: 'strong',
        confidence: 0.86,
        evidence: 'Wiki overlay is compiled from this approved memory.',
        status: 'inferred',
      })
    }
  }

  for (const event of visibleEvents) {
    for (const sourceId of event.sourceIds) {
      if (!nodeIds.has(sourceId)) continue
      addRelationshipEdge(edgeMap, {
        id: `edge:event-source:${fingerprintOpenBrainRecord([event.id, sourceId]).slice(0, 16)}`,
        fromId: sourceId,
        toId: event.id,
        relationship: 'observed_event',
        strength: event.confidence >= 0.75 ? 'medium' : 'weak',
        confidence: event.confidence,
        evidence: 'Event record cites this source id.',
        status: 'inferred',
      })
    }
  }

  const edges = [...edgeMap.values()]
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.fromId)
    connectedNodeIds.add(edge.toId)
  }

  const staleSources = sources.filter((source) => isStale(source.lastObservedAt, generatedAt))
  const orphanedNodes = nodes.filter((node) => !connectedNodeIds.has(node.id))
  const weakEdges = edges.filter((edge) => edge.strength === 'weak')
  const insights = buildRelationshipInsights({
    nodes,
    edges,
    orphanedNodes,
    staleSources,
    sources,
    memories,
    proposals,
  })
  const audit = buildRelationshipAudit({ links, proposals, events, nodes })

  return {
    overview: {
      relationships: edges.length,
      strongRelationships: edges.filter((edge) => edge.strength === 'strong').length,
      weakRelationships: weakEdges.length,
      orphanedRecords: orphanedNodes.length,
      staleSources: staleSources.length,
      proposalSuggestions: insights.length,
    },
    nodes,
    edges,
    insights,
    audit,
  }
}

function buildRelationshipAudit({
  links,
  proposals,
  events,
  nodes,
}: {
  links: OpenBrainLinkRecord[]
  proposals: OpenBrainProposalRecord[]
  events: OpenBrainEventRecord[]
  nodes: OpenBrainRelationshipNode[]
}): OpenBrainRelationshipAuditRecord[] {
  const nodeLabels = new Map(nodes.map((node) => [node.id, node.label]))
  const approvalEvents = events.filter((event) => event.kind === 'proposal_approved')

  return links
    .map((link): OpenBrainRelationshipAuditRecord => {
      const approvalEvent = approvalEvents.find((event) => eventApprovesLink(event, link))
      const sourceProposalId = stringFromMetadata(approvalEvent?.metadata?.proposalId)
      const proposal = sourceProposalId
        ? proposals.find((candidate) => candidate.id === sourceProposalId)
        : proposals.find((candidate) => proposalMatchesLink(candidate, link))
      const relationship = proposal?.metadata?.relationship

      return {
        linkId: link.id,
        fromId: link.fromId,
        toId: link.toId,
        relationship: link.relationship,
        sourceLabel: relationship?.sourceLabel || nodeLabels.get(link.fromId) || link.fromId,
        targetLabel: relationship?.targetLabel || nodeLabels.get(link.toId) || link.toId,
        sourceProposalId: proposal?.id || sourceProposalId || null,
        reviewedBy: proposal?.reviewedBy || stringFromMetadata(approvalEvent?.metadata?.reviewedBy),
        reviewedAt: proposal?.reviewedAt || approvalEvent?.createdAt || null,
        eventId: approvalEvent?.id || null,
        createdAt: link.createdAt,
        evidence: approvalEvent
          ? 'Approval event recorded the relationship link id.'
          : proposal
            ? 'Approved relationship proposal matches this persisted link.'
            : 'Persisted local Open Brain link record.',
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function eventApprovesLink(event: OpenBrainEventRecord, link: OpenBrainLinkRecord) {
  const metadata = event.metadata || {}
  if (stringFromMetadata(metadata.relationshipLinkId) === link.id) return true
  const relationship = relationshipMetadataFromUnknown(metadata.relationship)
  return Boolean(
    relationship &&
    relationship.fromId === link.fromId &&
    relationship.toId === link.toId &&
    relationship.relationship === link.relationship,
  )
}

function proposalMatchesLink(proposal: OpenBrainProposalRecord, link: OpenBrainLinkRecord) {
  const relationship = proposal.metadata?.relationship
  return Boolean(
    proposal.status === 'approved' &&
    relationship &&
    relationship.fromId === link.fromId &&
    relationship.toId === link.toId &&
    relationship.relationship === link.relationship,
  )
}

function relationshipMetadataFromUnknown(value: unknown): OpenBrainRelationshipProposalMetadata | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const insightKind = stringFromMetadata(candidate.insightKind)
  if (!['strengthen', 'review', 'missing_governance', 'merge_duplicate'].includes(insightKind || '')) return null
  const fromId = stringFromMetadata(candidate.fromId)
  const toId = stringFromMetadata(candidate.toId)
  const relationship = stringFromMetadata(candidate.relationship)
  if (!fromId || !toId || !relationship) return null
  return {
    fromId,
    toId,
    relationship,
    insightId: stringFromMetadata(candidate.insightId) || 'relationship-map-insight',
    insightKind: insightKind as OpenBrainRelationshipInsightKind,
    sourceLabel: stringFromMetadata(candidate.sourceLabel) || fromId,
    targetLabel: stringFromMetadata(candidate.targetLabel) || toId,
  }
}

function stringFromMetadata(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
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

function sourceToRelationshipNode(source: OpenBrainSourceRecord, index: number, generatedAt: string): OpenBrainRelationshipNode {
  const point = relationshipPoint('source', source.kind, index)
  return {
    id: source.id,
    label: source.title,
    type: 'source',
    kind: source.kind,
    privacyTier: source.privacyTier,
    summary: source.summary,
    path: source.path,
    health: source.privacyTier === 'private' ? 'red' : isStale(source.lastObservedAt, generatedAt) ? 'yellow' : 'green',
    x: point.x,
    y: point.y,
  }
}

function memoryToRelationshipNode(memory: OpenBrainMemoryRecord, index: number): OpenBrainRelationshipNode {
  const point = relationshipPoint('memory', memory.kind, index)
  return {
    id: memory.id,
    label: memory.title,
    type: 'memory',
    kind: memory.kind,
    privacyTier: memory.privacyTier,
    summary: memory.body,
    path: null,
    health: memory.privacyTier === 'private' ? 'red' : memory.confidence >= 0.75 ? 'green' : 'yellow',
    x: point.x,
    y: point.y,
  }
}

function eventToRelationshipNode(event: OpenBrainEventRecord, index: number): OpenBrainRelationshipNode {
  const point = relationshipPoint('event', event.kind, index)
  return {
    id: event.id,
    label: event.title,
    type: 'event',
    kind: event.kind,
    privacyTier: event.privacyTier,
    summary: event.summary,
    path: typeof event.metadata?.path === 'string' ? event.metadata.path : null,
    health: event.privacyTier === 'private' ? 'red' : event.confidence >= 0.75 ? 'green' : 'yellow',
    x: point.x,
    y: point.y,
  }
}

function wikiToRelationshipNode(page: OpenBrainWikiPage, index: number): OpenBrainRelationshipNode {
  const point = relationshipPoint('wiki', page.slug, index)
  return {
    id: relationshipWikiNodeId(page.slug),
    label: page.title,
    type: 'wiki',
    kind: 'wiki_page',
    privacyTier: page.privacyTier,
    summary: `Compiled wiki overlay at ${page.path}.`,
    path: page.path,
    health: page.privacyTier === 'private' ? 'red' : page.sourceMemoryIds.length > 0 ? 'green' : 'yellow',
    x: point.x,
    y: point.y,
  }
}

function proposalToRelationshipNode(proposal: OpenBrainProposalRecord, index: number): OpenBrainRelationshipNode {
  const point = relationshipPoint('proposal', proposal.status, index)
  return {
    id: relationshipProposalNodeId(proposal.id),
    label: proposal.proposedMemory.title,
    type: 'proposal',
    kind: proposal.proposedMemory.kind,
    privacyTier: proposal.proposedMemory.privacyTier,
    summary: proposal.reason,
    path: null,
    health: proposal.status === 'approved' ? 'green' : proposal.status === 'pending' ? 'yellow' : 'red',
    x: point.x,
    y: point.y,
  }
}

function relationshipPoint(type: OpenBrainRelationshipNodeType, kind: string, index: number) {
  if (type === 'source') return sourceRelationshipPoint(kind, index)

  const points: Record<OpenBrainRelationshipNodeType, { x: number; y: number }[]> = {
    source: [{ x: 50, y: 50 }],
    memory: [
      { x: 36, y: 82 },
      { x: 52, y: 82 },
      { x: 68, y: 82 },
      { x: 84, y: 82 },
    ],
    event: [
      { x: 12, y: 90 },
      { x: 28, y: 90 },
      { x: 44, y: 90 },
      { x: 60, y: 90 },
    ],
    wiki: [
      { x: 12, y: 72 },
      { x: 28, y: 72 },
      { x: 44, y: 72 },
    ],
    proposal: [
      { x: 36, y: 90 },
      { x: 56, y: 90 },
      { x: 76, y: 90 },
      { x: 92, y: 82 },
    ],
  }
  const selected = points[type][index % points[type].length]
  const rowOffset = Math.floor(index / points[type].length) * 4
  return {
    x: Math.max(8, Math.min(92, selected.x + rowOffset)),
    y: Math.max(12, Math.min(92, selected.y - rowOffset)),
  }
}

function sourceRelationshipPoint(kind: string, index: number) {
  const columns = [12, 31, 50, 69, 88]
  const row = Math.floor(index / columns.length)
  const kindNudge = kind === 'runbook' ? 2 : kind === 'repair_packet' ? -2 : 0
  const x = columns[index % columns.length] + (row % 2 === 1 ? 2 : 0) + kindNudge
  const y = 12 + row * 10
  return {
    x: Math.max(8, Math.min(92, x)),
    y: Math.max(12, Math.min(92, y)),
  }
}

function relationshipWikiNodeId(slug: string) {
  return `wiki:${slug}`
}

function relationshipProposalNodeId(id: string) {
  return `proposal-node:${id}`
}

function addRelationshipEdge(map: Map<string, OpenBrainRelationshipEdge>, edge: OpenBrainRelationshipEdge) {
  const existing = map.get(edge.id)
  if (!existing || relationshipStrengthRank(edge.strength) > relationshipStrengthRank(existing.strength)) {
    map.set(edge.id, edge)
  }
}

function relationshipStrengthRank(strength: OpenBrainRelationshipEdgeStrength) {
  return strength === 'strong' ? 3 : strength === 'medium' ? 2 : 1
}

function buildRelationshipInsights({
  nodes,
  edges,
  orphanedNodes,
  staleSources,
  sources,
  memories,
  proposals,
}: {
  nodes: OpenBrainRelationshipNode[]
  edges: OpenBrainRelationshipEdge[]
  orphanedNodes: OpenBrainRelationshipNode[]
  staleSources: OpenBrainSourceRecord[]
  sources: OpenBrainSourceRecord[]
  memories: OpenBrainMemoryRecord[]
  proposals: OpenBrainProposalRecord[]
}): OpenBrainRelationshipInsight[] {
  const insights: OpenBrainRelationshipInsight[] = []
  const runbookNode = nodes.find((node) => node.type === 'source' && node.kind === 'runbook')
  const automationNode = nodes.find((node) => node.type === 'source' && node.kind === 'codex_automation')
  const workspaceNode = nodes.find((node) => node.type === 'source' && node.kind === 'workspace_root_report')

  if (automationNode && runbookNode && !edges.some((edge) => edge.fromId === automationNode.id && edge.toId === runbookNode.id)) {
    insights.push({
      id: 'insight:strengthen:automation-runbook',
      kind: 'strengthen',
      severity: 'medium',
      title: 'Strengthen automation-to-runbook governance',
      detail: 'Codex automation sources and Portfolio runbooks appear in the same Open Brain projection but do not have a persisted relationship.',
      recommendation: 'Create a relationship proposal linking the automation source to the governing runbook before future agents act on it.',
      actionLabel: 'Propose link',
      sourceNodeId: automationNode.id,
      targetNodeId: runbookNode.id,
    })
  }

  if (workspaceNode && runbookNode && !edges.some((edge) => edge.fromId === workspaceNode.id && edge.toId === runbookNode.id)) {
    insights.push({
      id: 'insight:strengthen:workspace-runbook',
      kind: 'strengthen',
      severity: 'medium',
      title: 'Tie workspace-root state to its governing runbook',
      detail: 'The workspace-root report is central to current Codex context, but its governing document is not explicitly linked.',
      recommendation: 'Propose a durable link from workspace-root state to the memory/context organization workflow.',
      actionLabel: 'Propose link',
      sourceNodeId: workspaceNode.id,
      targetNodeId: runbookNode.id,
    })
  }

  for (const source of staleSources.slice(0, 2)) {
    insights.push({
      id: `insight:review:stale:${source.id}`,
      kind: 'review',
      severity: 'medium',
      title: `Review stale source: ${source.title}`,
      detail: 'This source is older than the freshness threshold and may make wiki or RAG overlays look more current than they are.',
      recommendation: 'Refresh the source through its owning producer before promoting related context.',
      actionLabel: 'Review source',
      sourceNodeId: source.id,
      targetNodeId: null,
    })
  }

  for (const orphan of orphanedNodes.filter((node) => node.type !== 'wiki').slice(0, 2)) {
    insights.push({
      id: `insight:missing-governance:${orphan.id}`,
      kind: 'missing_governance',
      severity: orphan.type === 'proposal' ? 'high' : 'medium',
      title: `Connect orphaned ${orphan.type}: ${orphan.label}`,
      detail: 'This record has no visible relationship edge in the current projection.',
      recommendation: 'Add a source, governing document, or explicit persisted link before relying on it as agent context.',
      actionLabel: 'Open source',
      sourceNodeId: orphan.id,
      targetNodeId: runbookNode?.id || null,
    })
  }

  const duplicateTitle = findDuplicateMemoryTitle(memories)
  if (duplicateTitle) {
    insights.push({
      id: `insight:merge:${fingerprintOpenBrainRecord([duplicateTitle]).slice(0, 12)}`,
      kind: 'merge_duplicate',
      severity: 'low',
      title: `Review duplicate memory title: ${duplicateTitle}`,
      detail: 'Multiple durable memories share a normalized title and may describe the same operating rule.',
      recommendation: 'Review the memories and propose a merge only after confirming they share the same source basis.',
      actionLabel: 'Review duplicate',
      sourceNodeId: null,
      targetNodeId: null,
    })
  }

  if (insights.length === 0 && proposals.some((proposal) => proposal.status === 'pending')) {
    const proposal = proposals.find((candidate) => candidate.status === 'pending')
    insights.push({
      id: 'insight:review:pending-proposals',
      kind: 'review',
      severity: 'medium',
      title: 'Review pending memory proposals',
      detail: 'Pending memory proposals are visible in the relationship map but are not durable memory yet.',
      recommendation: 'Approve or reject sourced proposals before compiling wiki overlays.',
      actionLabel: 'Review proposals',
      sourceNodeId: proposal ? relationshipProposalNodeId(proposal.id) : null,
      targetNodeId: null,
    })
  }

  return insights.slice(0, 6)
}

function findDuplicateMemoryTitle(memories: OpenBrainMemoryRecord[]) {
  const titles = new Map<string, number>()
  for (const memory of memories) {
    const normalized = memory.title.toLowerCase().replace(/\s+/g, ' ').trim()
    titles.set(normalized, (titles.get(normalized) || 0) + 1)
  }
  return [...titles.entries()].find(([, count]) => count > 1)?.[0] || null
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

function normalizeOpenBrainProposalMetadata(metadata: OpenBrainProposalMetadata | undefined): OpenBrainProposalMetadata | undefined {
  if (!metadata?.relationship) return undefined
  const relationship = metadata.relationship
  if (!relationship.fromId?.trim() || !relationship.toId?.trim() || !relationship.relationship?.trim()) return undefined
  if (!['strengthen', 'review', 'missing_governance', 'merge_duplicate'].includes(relationship.insightKind)) return undefined
  return {
    relationship: {
      fromId: sanitizeOpenBrainText(relationship.fromId, 220),
      toId: sanitizeOpenBrainText(relationship.toId, 220),
      relationship: sanitizeOpenBrainText(relationship.relationship, 160),
      insightId: sanitizeOpenBrainText(relationship.insightId || 'relationship-map-insight', 220),
      insightKind: relationship.insightKind,
      sourceLabel: sanitizeOpenBrainText(relationship.sourceLabel || relationship.fromId, 180),
      targetLabel: sanitizeOpenBrainText(relationship.targetLabel || relationship.toId, 180),
    },
  }
}

function relationshipLinkFromProposal(proposal: OpenBrainProposalRecord) {
  const relationship = proposal.metadata?.relationship
  if (!relationship?.fromId || !relationship.toId || !relationship.relationship) return null
  if (proposal.proposedMemory.privacyTier === 'private') return null
  return {
    id: `link:${fingerprintOpenBrainRecord([relationship.fromId, relationship.toId, relationship.relationship]).slice(0, 16)}`,
    fromId: relationship.fromId,
    toId: relationship.toId,
    relationship: relationship.relationship,
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
