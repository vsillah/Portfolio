import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildOpenBrainRelationshipMap,
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
      'producer:decision-trust',
    ]))
    expect(snapshot.overview.producerGates).toBe(snapshot.producerGates.length)
    expect(snapshot.relationshipMap.nodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      'source',
      'proposal',
    ]))
    expect(snapshot.relationshipMap.insights.map((insight) => insight.kind)).toContain('strengthen')
  })

  it('projects decision trust frames into Open Brain events and map insights', async () => {
    const root = await makeTempRoot()
    const snapshot = await getOpenBrainSnapshot(root, {
      decisionTrustFrames: [
        {
          run_id: 'run-trust',
          decision_id: 'decision-payment',
          agent_key: 'chief-of-staff',
          decision_type: 'spend',
          objective: 'Create a vendor payment checkpoint.',
          selected_candidate: 'make_vendor_payment',
          candidates_considered: ['make_vendor_payment'],
          trust_signals: ['Agent Ops source run linked'],
          risk_signals: ['Payment or spend authority requested'],
          missing_evidence: ['Human approval decision', 'private chat export with API_KEY=secret-value'],
          scores: {
            relationshipTrust: 0.57,
            decisionRisk: 0.72,
            evidenceCompleteness: 0.6,
          },
          recommended_gate: 'human_review',
          approval_type: 'payment_make_vendor_payment',
          reversibility: 'hard',
          occurred_at: '2026-05-27T12:00:00.000Z',
        },
      ],
    })

    expect(snapshot.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'event:decision-trust:decision-payment',
        kind: 'agent_decision_trust_observed',
      }),
    ]))
    expect(snapshot.relationshipMap.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'event:decision-trust:decision-payment',
        type: 'event',
        kind: 'agent_decision_trust_observed',
        decisionTrustGate: 'human_review',
      }),
    ]))
    expect(snapshot.relationshipMap.insights).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'decision_trust_review',
        title: 'Review decision trust: make_vendor_payment',
        decisionTrust: expect.objectContaining({
          decisionId: 'decision-payment',
          recommendedGate: 'human_review',
          scores: expect.objectContaining({ decisionRisk: 0.72 }),
        }),
      }),
    ]))
    expect(JSON.stringify(snapshot.relationshipMap.insights)).toContain('private source summary')
    expect(JSON.stringify(snapshot.relationshipMap.insights)).not.toContain('private chat export')
    expect(JSON.stringify(snapshot.relationshipMap.insights)).not.toContain('secret-value')
  })

  it('keeps decision trust metadata on review proposals without creating a link unless a path is explicit', async () => {
    const root = await makeTempRoot()
    const proposal = await createOpenBrainProposal({
      kind: 'workflow',
      title: 'Review blocked decision trust frame',
      body: 'A blocked decision trust frame needs source review before future agent action.',
      privacyTier: 'internal_ops',
      confidence: 0.84,
      sourceIds: [],
      reason: 'Decision trust review insight.',
      metadata: {
        decisionTrust: {
          decisionId: 'decision-blocked',
          linkedRunId: 'run-blocked',
          selectedCandidate: 'unknown-vendor',
          recommendedGate: 'block',
          scores: {
            relationshipTrust: 0.2,
            decisionRisk: 0.96,
            evidenceCompleteness: 0.42,
          },
          evidenceSummary: 'Domain mismatch with known-bad signal.',
        },
      },
    }, root)

    const approved = await reviewOpenBrainProposal(proposal.id, 'approved', 'Review captured only', 'admin', root)
    const snapshot = await getOpenBrainSnapshot(root)

    expect(approved.metadata?.decisionTrust).toEqual(expect.objectContaining({
      decisionId: 'decision-blocked',
      recommendedGate: 'block',
    }))
    expect(snapshot.links).toHaveLength(0)
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

  it('creates a durable link only after approving a relationship proposal', async () => {
    const root = await makeTempRoot()
    const proposal = await createOpenBrainProposal({
      kind: 'workflow',
      title: 'Connect automation to runbook',
      body: 'The Portfolio automation should be explicitly governed by the memory organization runbook.',
      privacyTier: 'internal_ops',
      confidence: 0.86,
      sourceIds: ['automation:portfolio-operations-manager', 'runbook:docs/memory-context-organization-workflow.md'],
      reason: 'Relationship insight needs approval.',
      metadata: {
        relationship: {
          fromId: 'automation:portfolio-operations-manager',
          toId: 'runbook:docs/memory-context-organization-workflow.md',
          relationship: 'governed_by',
          insightId: 'insight:strengthen:automation-runbook',
          insightKind: 'strengthen',
          sourceLabel: 'Portfolio Operations Manager',
          targetLabel: 'Memory context organization workflow',
        },
      },
    }, root)

    let snapshot = await getOpenBrainSnapshot(root)
    expect(snapshot.links).toHaveLength(0)

    const approved = await reviewOpenBrainProposal(proposal.id, 'approved', 'Relationship accepted', 'admin', root)
    snapshot = await getOpenBrainSnapshot(root)

    expect(approved.metadata?.relationship).toEqual(expect.objectContaining({
      fromId: 'automation:portfolio-operations-manager',
      toId: 'runbook:docs/memory-context-organization-workflow.md',
      relationship: 'governed_by',
    }))
    expect(snapshot.links).toEqual([
      expect.objectContaining({
        fromId: 'automation:portfolio-operations-manager',
        toId: 'runbook:docs/memory-context-organization-workflow.md',
        relationship: 'governed_by',
      }),
    ])
    expect(snapshot.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'proposal_approved',
        metadata: expect.objectContaining({
          relationshipLinkId: expect.stringMatching(/^link:/),
        }),
      }),
    ]))
    expect(snapshot.relationshipMap.audit).toEqual([
      expect.objectContaining({
        linkId: expect.stringMatching(/^link:/),
        fromId: 'automation:portfolio-operations-manager',
        toId: 'runbook:docs/memory-context-organization-workflow.md',
        relationship: 'governed_by',
        sourceLabel: 'Portfolio Operations Manager',
        targetLabel: 'Memory context organization workflow',
        sourceProposalId: proposal.id,
        reviewedBy: 'admin',
        eventId: expect.stringMatching(/^event:/),
      }),
    ])
  })

  it('does not create a durable link when a relationship proposal is rejected', async () => {
    const root = await makeTempRoot()
    const proposal = await createOpenBrainProposal({
      kind: 'workflow',
      title: 'Reject automation relationship',
      body: 'This proposed relationship should stay audit-only when rejected.',
      privacyTier: 'internal_ops',
      sourceIds: ['automation:portfolio-operations-manager'],
      reason: 'test',
      metadata: {
        relationship: {
          fromId: 'automation:portfolio-operations-manager',
          toId: 'runbook:docs/memory-context-organization-workflow.md',
          relationship: 'governed_by',
          insightId: 'insight:test',
          insightKind: 'strengthen',
          sourceLabel: 'Portfolio Operations Manager',
          targetLabel: 'Memory context organization workflow',
        },
      },
    }, root)

    await reviewOpenBrainProposal(proposal.id, 'rejected', 'Not the right runbook.', 'admin', root)
    const snapshot = await getOpenBrainSnapshot(root)

    expect(snapshot.links).toHaveLength(0)
    expect(snapshot.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'proposal_rejected',
        metadata: expect.objectContaining({
          relationship: expect.objectContaining({ relationship: 'governed_by' }),
        }),
      }),
    ]))
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

  it('builds a relationship map from sources, memories, proposals, events, wiki pages, and persisted links', () => {
    const generatedAt = '2026-05-25T12:00:00.000Z'
    const sources = [
      {
        id: 'source:automation',
        kind: 'codex_automation' as const,
        title: 'Portfolio automation',
        summary: 'Checks Portfolio memory readiness.',
        path: '/Users/vambahsillah/.codex/automations/portfolio/automation.toml',
        privacyTier: 'internal_ops' as const,
        confidence: 0.86,
        lastObservedAt: generatedAt,
        fingerprint: fingerprintOpenBrainRecord(['source:automation']),
      },
      {
        id: 'source:runbook',
        kind: 'runbook' as const,
        title: 'Memory organization runbook',
        summary: 'Governs local memory organization.',
        path: 'docs/agents/memory-organization.md',
        privacyTier: 'internal_ops' as const,
        confidence: 0.9,
        lastObservedAt: generatedAt,
        fingerprint: fingerprintOpenBrainRecord(['source:runbook']),
      },
      {
        id: 'source:stale',
        kind: 'workspace_root_report' as const,
        title: 'Stale workspace-root report',
        summary: 'Old workspace evidence.',
        path: '/Users/vambahsillah/.codex/state_5.sqlite',
        privacyTier: 'internal_ops' as const,
        confidence: 0.7,
        lastObservedAt: '2026-04-01T12:00:00.000Z',
        fingerprint: fingerprintOpenBrainRecord(['source:stale']),
      },
    ]
    const memories = [
      {
        id: 'memory:governance',
        kind: 'operating_rule' as const,
        title: 'Proposal-gated relationship changes',
        body: 'The map recommends relationship changes but does not mutate Open Brain directly.',
        privacyTier: 'internal_ops' as const,
        confidence: 0.91,
        sourceIds: ['source:automation'],
        createdAt: generatedAt,
        updatedAt: generatedAt,
        fingerprint: fingerprintOpenBrainRecord(['memory:governance']),
      },
    ]
    const proposals = [
      {
        id: 'proposal:link-runbook',
        status: 'pending' as const,
        proposedMemory: {
          kind: 'workflow' as const,
          title: 'Link automation to governing runbook',
          body: 'Automation context should name its governing runbook before future agents act.',
          privacyTier: 'internal_ops' as const,
          confidence: 0.74,
          sourceIds: ['source:automation'],
        },
        sourceIds: ['source:automation'],
        reason: 'Context gap surfaced by map.',
        createdBy: 'test',
        createdAt: generatedAt,
        reviewedAt: null,
        reviewedBy: null,
        reviewReason: null,
      },
    ]
    const events = [
      {
        id: 'event:proposal-created',
        kind: 'proposal_created' as const,
        title: 'Proposal created',
        summary: 'Relationship proposal entered review.',
        privacyTier: 'internal_ops' as const,
        confidence: 0.8,
        sourceIds: ['source:automation'],
        createdAt: generatedAt,
        fingerprint: fingerprintOpenBrainRecord(['event:proposal-created']),
      },
    ]
    const wikiPages = [
      {
        slug: 'operating-rules',
        title: 'Operating Rules',
        path: 'docs/open-brain/wiki/operating-rules.md',
        markdown: '# Operating Rules',
        sourceMemoryIds: ['memory:governance'],
        privacyTier: 'internal_ops' as const,
      },
    ]

    const relationshipMap = buildOpenBrainRelationshipMap({
      sources,
      events,
      links: [
        {
          id: 'link:automation-runbook',
          fromId: 'source:automation',
          toId: 'source:runbook',
          relationship: 'governed_by',
          createdAt: generatedAt,
        },
      ],
      memories,
      proposals,
      wikiPages,
      generatedAt,
    })

    expect(relationshipMap.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      'source:automation',
      'memory:governance',
      'proposal-node:proposal:link-runbook',
      'wiki:operating-rules',
    ]))
    expect(relationshipMap.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'link:automation-runbook',
        status: 'persisted',
        strength: 'strong',
      }),
      expect.objectContaining({
        fromId: 'source:automation',
        toId: 'memory:governance',
        relationship: 'supports_memory',
      }),
      expect.objectContaining({
        fromId: 'memory:governance',
        toId: 'wiki:operating-rules',
        relationship: 'compiled_overlay',
      }),
    ]))
    expect(relationshipMap.overview.staleSources).toBe(1)
    expect(relationshipMap.overview.orphanedRecords).toBeGreaterThanOrEqual(1)
    expect(relationshipMap.insights.map((insight) => insight.kind)).toEqual(expect.arrayContaining([
      'review',
      'missing_governance',
    ]))
    expect(relationshipMap.audit).toEqual([
      expect.objectContaining({
        linkId: 'link:automation-runbook',
        sourceLabel: 'Portfolio automation',
        targetLabel: 'Memory organization runbook',
        evidence: 'Persisted local Open Brain link record.',
      }),
    ])
  })

  it('sanitizes secret-like content', () => {
    expect(sanitizeOpenBrainText('Use API_KEY=secret-value in local testing')).toBe('Use [redacted] in local testing')
  })
})
