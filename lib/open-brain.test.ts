import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compileKarpathyWikiOverlay,
  createOpenBrainProposal,
  fingerprintOpenBrainRecord,
  getOpenBrainSnapshot,
  linkOpenBrainRecords,
  recordOpenBrainEvent,
  recordOpenBrainSource,
  reviewOpenBrainProposal,
  sanitizeOpenBrainText,
  validateMemoryProposal,
  buildOpenBrainRagProjection,
  type OpenBrainMemoryRecord,
} from './open-brain'

vi.mock('./codex-automation-inventory', () => ({
  listCodexAutomationInventory: vi.fn(async () => ({
    available: true,
    sourceDirectory: '/Users/vambahsillah/.codex/automations',
    generatedAt: '2026-05-10T12:00:00.000Z',
    automations: [
      {
        id: 'portfolio-operations-manager',
        name: 'Portfolio Operations Manager',
        category: 'Operations',
        riskLevel: 'high',
        contextHealth: 'yellow',
        sourceFile: '/Users/vambahsillah/.codex/automations/portfolio-operations-manager/automation.toml',
        updatedAt: 1,
      },
    ],
    repairPackets: [
      {
        automationId: 'portfolio-operations-manager',
        automationName: 'Portfolio Operations Manager',
        summary: 'Portfolio Operations Manager needs context repair.',
        missingQuestions: ['boundary'],
        recommendedActions: ['Add an authority boundary.'],
        sourceFile: '/Users/vambahsillah/.codex/automations/portfolio-operations-manager/automation.toml',
      },
    ],
  })),
}))

vi.mock('./codex-workspace-roots', () => ({
  getCodexWorkspaceRootReport: vi.fn(async () => ({
    available: true,
    generatedAt: '2026-05-10T12:00:00.000Z',
    stateDatabase: '/Users/vambahsillah/.codex/state_5.sqlite',
    overview: {
      portfolioThreads: 8,
      nonPortfolioThreads: 2,
    },
    health: 'yellow',
  })),
}))

let tempRoot: string | null = null

async function makeTempRoot() {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'open-brain-'))
  return tempRoot
}

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true })
    tempRoot = null
  }
  vi.unstubAllEnvs()
})

describe('Open Brain projection', () => {
  it('builds a local-first snapshot from Agent Ops and Codex sources', async () => {
    const root = await makeTempRoot()
    const snapshot = await getOpenBrainSnapshot(root)

    expect(snapshot.service.storage).toBe('local_jsonl')
    expect(snapshot.sources.map((source) => source.kind)).toEqual(expect.arrayContaining([
      'codex_automation',
      'workspace_root_report',
      'repair_packet',
      'runbook',
      'personality_corpus',
      'chatbot_knowledge',
      'rag_projection',
    ]))
    expect(snapshot.events.map((event) => event.kind)).toContain('source_observed')
    expect(snapshot.proposals[0]).toEqual(expect.objectContaining({
      id: 'proposal:repair:portfolio-operations-manager',
      status: 'pending',
    }))
    expect(snapshot.contextPacket.boundaries).toContain('Do not mutate ~/.codex operational state from Portfolio APIs.')
    expect(snapshot.producerGates.map((gate) => gate.id)).toEqual(expect.arrayContaining([
      'producer:personality-corpus',
      'producer:chatbot-knowledge',
      'producer:autoresearch',
      'producer:model-ops',
      'producer:rag-pinecone',
    ]))
    expect(snapshot.overview.producerGates).toBe(snapshot.producerGates.length)
  })

  it('keeps AutoResearch producer traces disabled until explicitly configured', async () => {
    const root = await makeTempRoot()
    let snapshot = await getOpenBrainSnapshot(root)

    expect(snapshot.producerGates.find((gate) => gate.id === 'producer:autoresearch')).toEqual(expect.objectContaining({
      status: 'disabled',
      envVar: 'OPEN_BRAIN_AUTORESEARCH_TRACE',
    }))

    vi.stubEnv('OPEN_BRAIN_AUTORESEARCH_TRACE', 'true')
    snapshot = await getOpenBrainSnapshot(root)

    expect(snapshot.producerGates.find((gate) => gate.id === 'producer:autoresearch')).toEqual(expect.objectContaining({
      status: 'enabled',
      configuredValue: 'true',
    }))
  })

  it('validates privacy tiers and secret-like public text', () => {
    expect(validateMemoryProposal({
      kind: 'workflow',
      title: 'Credential workflow',
      body: 'API_KEY=secret-value should never be public',
      privacyTier: 'public_safe',
      reason: 'test',
    })).toContain('Public-safe memory cannot contain secret-like values.')
  })

  it('creates, approves, and compiles approved non-private memory into wiki pages', async () => {
    const root = await makeTempRoot()
    const proposal = await createOpenBrainProposal({
      kind: 'decision',
      title: 'Portfolio owns projection only',
      body: 'The local Open Brain owns durable memory. Portfolio compiles approved overlays.',
      privacyTier: 'internal_ops',
      confidence: 0.93,
      sourceIds: ['runbook:docs/open-brain-local-service.md'],
      reason: 'Plan decision',
    }, root)

    const approved = await reviewOpenBrainProposal(proposal.id, 'approved', 'Accepted', 'admin', root)
    const snapshot = await getOpenBrainSnapshot(root)

    expect(approved.status).toBe('approved')
    expect(snapshot.memories).toHaveLength(1)
    expect(snapshot.events.map((event) => event.kind)).toEqual(expect.arrayContaining([
      'proposal_created',
      'proposal_approved',
    ]))
    expect(snapshot.wikiPages[0]).toEqual(expect.objectContaining({
      slug: 'decision-memory',
      path: 'docs/open-brain/wiki/decision-memory.md',
    }))
    expect(snapshot.wikiPages[0].markdown).toContain('Portfolio owns projection only')
  })

  it('can approve a generated repair proposal after persisting it locally', async () => {
    const root = await makeTempRoot()

    const approved = await reviewOpenBrainProposal(
      'proposal:repair:portfolio-operations-manager',
      'approved',
      'Repair proposal accepted',
      'admin',
      root,
    )
    const snapshot = await getOpenBrainSnapshot(root)

    expect(approved.status).toBe('approved')
    expect(snapshot.overview.approvedProposals).toBe(1)
    expect(snapshot.memories[0].title).toContain('Portfolio Operations Manager')
  })

  it('does not compile private memories into wiki overlays', () => {
    const memory: OpenBrainMemoryRecord = {
      id: 'memory:private',
      kind: 'fact',
      title: 'Private fact',
      body: 'Private body',
      privacyTier: 'private',
      confidence: 0.9,
      sourceIds: [],
      createdAt: '2026-05-10T12:00:00.000Z',
      updatedAt: '2026-05-10T12:00:00.000Z',
      fingerprint: fingerprintOpenBrainRecord(['private']),
    }

    expect(compileKarpathyWikiOverlay([memory])).toEqual([])
  })

  it('persists source, event, and link records in the local Open Brain home', async () => {
    const root = await makeTempRoot()
    const source = await recordOpenBrainSource({
      id: 'autoresearch:proposal:test',
      kind: 'autoresearch_proposal',
      title: 'Test AutoResearch proposal',
      summary: 'Approval packet created without executing the experiment.',
      path: null,
      privacyTier: 'internal_ops',
      confidence: 0.8,
    }, root)
    await recordOpenBrainEvent({
      id: 'event:autoresearch-proposal-created:test',
      kind: 'autoresearch_proposal_created',
      title: 'AutoResearch proposal created',
      summary: 'Proposal trace only.',
      privacyTier: 'internal_ops',
      confidence: 0.82,
      sourceIds: [source.id],
    }, root)
    const proposal = await createOpenBrainProposal({
      kind: 'workflow',
      title: 'Approved trace linking',
      body: 'Open Brain links approved memory records back to source records.',
      privacyTier: 'internal_ops',
      sourceIds: [source.id],
      reason: 'test',
    }, root)
    const approved = await reviewOpenBrainProposal(proposal.id, 'approved', 'Accepted', 'admin', root)
    const link = await linkOpenBrainRecords({
      fromId: `memory:${approved.id.replace(/^proposal:/, '')}`,
      toId: source.id,
      relationship: 'derived_from',
    }, root)
    const snapshot = await getOpenBrainSnapshot(root)

    expect(snapshot.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: source.id })]))
    expect(snapshot.events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'autoresearch_proposal_created' })]))
    expect(snapshot.links).toEqual([expect.objectContaining({ id: link.id, relationship: 'derived_from' })])
    expect(snapshot.wikiPages.map((page) => page.slug)).toContain('autoresearch-experiment-ledger')
  })

  it('projects only approved public-safe memories into RAG documents', () => {
    const publicMemory: OpenBrainMemoryRecord = {
      id: 'memory:public',
      kind: 'fact',
      title: 'Public-safe profile',
      body: 'Public-safe derived summary only.',
      privacyTier: 'public_safe',
      confidence: 0.9,
      sourceIds: ['personality-corpus:public-safe'],
      createdAt: '2026-05-10T12:00:00.000Z',
      updatedAt: '2026-05-10T12:00:00.000Z',
      fingerprint: fingerprintOpenBrainRecord(['public']),
    }
    const privateMemory: OpenBrainMemoryRecord = {
      ...publicMemory,
      id: 'memory:private',
      title: 'Private profile',
      privacyTier: 'private',
      fingerprint: fingerprintOpenBrainRecord(['private']),
    }
    const projection = buildOpenBrainRagProjection([publicMemory, privateMemory])

    expect(projection.documents).toHaveLength(1)
    expect(projection.documents[0].metadata).toEqual(expect.objectContaining({
      openBrainMemoryId: 'memory:public',
      openBrainSourceIds: ['personality-corpus:public-safe'],
      privacyTier: 'public_safe',
      projectionVersion: 'open-brain-rag-projection-v1',
      deletionKey: 'open-brain:memory:public',
    }))
    expect(projection.pineconeWriteStatus).toBe('blocked_pending_approval')
    expect(projection.excludedPrivateCount).toBe(1)
  })

  it('sanitizes secret-like content', () => {
    expect(sanitizeOpenBrainText('Use API_KEY=secret-value in local testing')).toBe('Use [redacted] in local testing')
  })
})
