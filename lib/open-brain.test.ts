import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compileKarpathyWikiOverlay,
  createOpenBrainProposal,
  fingerprintOpenBrainRecord,
  getOpenBrainSnapshot,
  reviewOpenBrainProposal,
  sanitizeOpenBrainText,
  validateMemoryProposal,
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
    ]))
    expect(snapshot.proposals[0]).toEqual(expect.objectContaining({
      id: 'proposal:repair:portfolio-operations-manager',
      status: 'pending',
    }))
    expect(snapshot.contextPacket.boundaries).toContain('Do not mutate ~/.codex operational state from Portfolio APIs.')
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

  it('sanitizes secret-like content', () => {
    expect(sanitizeOpenBrainText('Use API_KEY=secret-value in local testing')).toBe('Use [redacted] in local testing')
  })
})
