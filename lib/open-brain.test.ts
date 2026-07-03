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
  recordAgentOpsWorkItemProducerTraces,
  recordCodexAutomationProducerTraces,
  recordPersonalityCorpusProducerTrace,
  recordVercelAutoResearchProducerTraces,
  reviewOpenBrainProposal,
  sanitizeOpenBrainText,
  validateMemoryProposal,
  buildOpenBrainRagProjection,
  type OpenBrainMemoryRecord,
} from './open-brain'
import type { VercelResearchPlan } from './vercel-deployment-research'

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

vi.mock('./agent-work-items', () => ({
  listAgentWorkItems: vi.fn(async () => [
    {
      id: 'work-1',
      title: 'Review Open Brain handoff path',
      objective: 'Sensitive objective should stay out of producer output.',
      status: 'blocked',
      priority: 'high',
      owner_agent_key: 'integration-captain',
      owner_runtime: 'codex',
      source_type: 'agent_run',
      source_id: 'run-1',
      source_label: 'Agent run',
      source_run_id: 'run-1',
      active_run_id: null,
      parent_work_item_id: null,
      branch_name: null,
      worktree_path: null,
      pr_number: null,
      pr_url: null,
      expected_files: [],
      touched_files: [],
      overlap_group: null,
      dependency_ids: [],
      blocker_summary: 'Sensitive blocker should stay out of producer output.',
      validation_summary: null,
      approval_id: null,
      metadata: {},
      idempotency_key: 'work-1',
      created_at: '2026-06-01T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
      completed_at: null,
    },
    {
      id: 'work-2',
      title: 'Queued low-risk worker',
      objective: 'Queued objective.',
      status: 'queued',
      priority: 'medium',
      owner_agent_key: null,
      owner_runtime: 'manual',
      source_type: null,
      source_id: null,
      source_label: null,
      source_run_id: null,
      active_run_id: null,
      parent_work_item_id: null,
      branch_name: null,
      worktree_path: null,
      pr_number: null,
      pr_url: null,
      expected_files: [],
      touched_files: [],
      overlap_group: null,
      dependency_ids: [],
      blocker_summary: null,
      validation_summary: null,
      approval_id: null,
      metadata: {},
      idempotency_key: 'work-2',
      created_at: '2026-06-01T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
      completed_at: null,
    },
  ]),
  getAgentWorkItem: vi.fn(async (id: string) => id === 'work-1'
    ? {
      id: 'work-1',
      latest_handoff: {
        id: 'handoff-1',
        run_id: 'run-1',
        work_item_id: 'work-1',
        from_agent_key: 'chief-of-staff',
        to_agent_key: 'integration-captain',
        handoff_type: 'agent_work_item_handoff',
        summary: 'Sensitive handoff summary should stay out of producer output.',
        acceptance_criteria: 'Sensitive acceptance criteria should stay out.',
        status: 'pending',
        created_at: '2026-06-02T12:30:00.000Z',
        accepted_at: null,
        completed_at: null,
        metadata: {},
      },
    }
    : { id, latest_handoff: null }),
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
      'producer:agent-ops-work-items',
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
          decision_trust_enforcement: {
            mode: 'soft_gate',
            gate: 'human_review',
            may_proceed: false,
            requires_approval: true,
            should_block: false,
            approval_type: 'payment_make_vendor_payment',
            reason: 'Soft-gate mode requires human approval before this Decision Trust frame can produce a side effect.',
            evidence: {
              decision_id: 'decision-payment',
              linked_run_id: 'run-trust',
              selected_candidate: 'make_vendor_payment',
              missing_evidence: ['Human approval decision'],
            },
          },
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
        decisionTrustEnforcement: expect.objectContaining({
          mode: 'soft_gate',
          gate: 'human_review',
          requiresApproval: true,
          shouldBlock: false,
        }),
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

  it('does not promote blocked decision trust relationship metadata into a durable link', async () => {
    const root = await makeTempRoot()
    const proposal = await createOpenBrainProposal({
      kind: 'workflow',
      title: 'Blocked vendor trust link',
      body: 'A blocked vendor decision can be reviewed without creating positive trust evidence.',
      privacyTier: 'internal_ops',
      confidence: 0.84,
      sourceIds: ['event:decision-trust:blocked-vendor'],
      reason: 'Decision trust block should suppress relationship promotion.',
      metadata: {
        relationship: {
          fromId: 'event:decision-trust:blocked-vendor',
          toId: 'vendor:unknown-payments',
          relationship: 'trusted_for_decision',
          insightId: 'insight:decision-trust:blocked-vendor',
          insightKind: 'decision_trust_review',
          sourceLabel: 'Blocked vendor decision',
          targetLabel: 'Unknown Payments',
        },
        decisionTrust: {
          decisionId: 'decision-blocked-vendor',
          linkedRunId: 'run-blocked-vendor',
          selectedCandidate: 'unknown-payments.example',
          recommendedGate: 'block',
          scores: {
            relationshipTrust: 0.12,
            decisionRisk: 0.94,
            evidenceCompleteness: 0.38,
          },
          evidenceSummary: 'Domain mismatch with excessive unexplained payment permissions.',
        },
      },
    }, root)

    const approved = await reviewOpenBrainProposal(proposal.id, 'approved', 'Review captured; no trust promotion.', 'admin', root)
    const snapshot = await getOpenBrainSnapshot(root)
    const approvalEvent = snapshot.events.find((event) => (
      event.kind === 'proposal_approved' &&
      event.metadata?.proposalId === proposal.id
    ))

    expect(approved.metadata?.decisionTrust).toEqual(expect.objectContaining({
      decisionId: 'decision-blocked-vendor',
      recommendedGate: 'block',
    }))
    expect(snapshot.links).toHaveLength(0)
    expect(approvalEvent?.metadata).toEqual(expect.objectContaining({
      relationship: expect.objectContaining({
        fromId: 'event:decision-trust:blocked-vendor',
        toId: 'vendor:unknown-payments',
        relationship: 'trusted_for_decision',
      }),
      decisionTrust: expect.objectContaining({
        decisionId: 'decision-blocked-vendor',
        linkedRunId: 'run-blocked-vendor',
        recommendedGate: 'block',
      }),
      decisionTrustRelationshipLinkBlocked: true,
      relationshipLinkBlockedReason: 'decision_trust_block',
    }))
    expect(approvalEvent?.metadata).not.toHaveProperty('relationshipLinkId')
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
      sourceMemoryIds: [expect.stringMatching(/^memory:/)],
      sourceIds: ['runbook:docs/open-brain-local-service.md'],
      sourceEventIds: [],
      approvalState: 'approved_memory_only',
    }))
    expect(snapshot.wikiPages[0].markdown).toContain('Portfolio owns projection only')
    expect(snapshot.wikiPages[0].markdown).toContain('Approval state: `approved_memory_only`')
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

  it('does not compile private AutoResearch events into wiki overlays', () => {
    const publicEvent = {
      id: 'event:autoresearch-public',
      kind: 'autoresearch_proposal_created' as const,
      title: 'Public-safe AutoResearch proposal',
      summary: 'Sanitized proposal trace only.',
      privacyTier: 'internal_ops' as const,
      confidence: 0.82,
      sourceIds: ['source:autoresearch-public'],
      createdAt: '2026-05-10T12:00:00.000Z',
      fingerprint: fingerprintOpenBrainRecord(['event:autoresearch-public']),
    }
    const privateEvent = {
      id: 'event:autoresearch-private',
      kind: 'autoresearch_proposal_created' as const,
      title: 'Private AutoResearch proposal',
      summary: 'Raw private experiment details.',
      privacyTier: 'private' as const,
      confidence: 0.82,
      sourceIds: ['source:autoresearch-private'],
      createdAt: '2026-05-10T12:00:00.000Z',
      fingerprint: fingerprintOpenBrainRecord(['event:autoresearch-private']),
    }

    const pages = compileKarpathyWikiOverlay([], [publicEvent, privateEvent])

    expect(pages).toHaveLength(1)
    expect(pages[0]).toEqual(expect.objectContaining({
      slug: 'autoresearch-experiment-ledger',
      sourceIds: ['source:autoresearch-public'],
      sourceEventIds: ['event:autoresearch-public'],
      approvalState: 'source_event_preview',
    }))
    expect(pages[0].markdown).toContain('Sanitized proposal trace only.')
    expect(pages[0].markdown).not.toContain('Raw private experiment details.')
    expect(pages[0].markdown).not.toContain('event:autoresearch-private')
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
    expect(snapshot.wikiPages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slug: 'autoresearch-experiment-ledger',
        sourceIds: [source.id],
        sourceEventIds: ['event:autoresearch-proposal-created:test'],
        approvalState: 'source_event_preview',
      }),
    ]))
  })

  it('records the personality corpus producer trace without raw private content', async () => {
    const root = await makeTempRoot()
    const first = await recordPersonalityCorpusProducerTrace(root, '2026-06-02T12:00:00.000Z')
    const second = await recordPersonalityCorpusProducerTrace(root, '2026-06-02T12:00:00.000Z')
    const snapshot = await getOpenBrainSnapshot(root)

    expect(first.status).toBe('recorded')
    expect(second.status).toBe('recorded')
    expect(first.overview).toEqual({
      sourcesRecorded: 1,
      eventsRecorded: 1,
      proposalsRecorded: 1,
      rawPrivateExportsIncluded: false,
      durableMemoryPromoted: false,
    })
    expect(first.source).toEqual(expect.objectContaining({
      id: 'personality-corpus:public-safe',
      kind: 'personality_corpus',
      privacyTier: 'public_safe',
    }))
    expect(first.event).toEqual(expect.objectContaining({
      id: 'event:source-observed:personality-corpus:public-safe',
      kind: 'source_observed',
      sourceIds: ['personality-corpus:public-safe'],
      metadata: expect.objectContaining({
        producerId: 'producer:personality-corpus',
        rawPrivateExportsIncluded: false,
      }),
    }))
    expect(first.proposals).toEqual([
      expect.objectContaining({
        id: 'proposal:personality-corpus:personality-corpus-public-safe',
        status: 'pending',
        proposedMemory: expect.objectContaining({
          kind: 'workflow',
          title: 'Approve personality corpus as public-safe projection input',
          privacyTier: 'public_safe',
          sourceIds: ['personality-corpus:public-safe'],
        }),
        sourceIds: ['personality-corpus:public-safe'],
        createdBy: 'open-brain-personality-corpus-producer',
      }),
    ])
    expect(first.event?.summary).not.toContain('Anthropic_chat_data')
    expect(first.event?.summary).not.toContain('ChatGPT')
    expect(first.proposals[0].proposedMemory.body).not.toContain('Anthropic_chat_data')
    expect(first.proposals[0].proposedMemory.body).not.toContain('ChatGPT')
    expect(snapshot.sources.filter((source) => source.id === 'personality-corpus:public-safe')).toHaveLength(1)
    expect(snapshot.events.filter((event) => event.id === 'event:source-observed:personality-corpus:public-safe')).toHaveLength(1)
    expect(snapshot.proposals.filter((proposal) => proposal.id === 'proposal:personality-corpus:personality-corpus-public-safe')).toHaveLength(1)
    expect(snapshot.memories.filter((memory) => memory.id === 'memory:personality-corpus:personality-corpus-public-safe')).toHaveLength(0)
  })

  it('records Codex automation producer traces without raw prompt content', async () => {
    const root = await makeTempRoot()
    const first = await recordCodexAutomationProducerTraces(root, '2026-06-02T12:00:00.000Z')
    const second = await recordCodexAutomationProducerTraces(root, '2026-06-02T12:00:00.000Z')
    const snapshot = await getOpenBrainSnapshot(root)

    expect(first.status).toBe('recorded')
    expect(second.status).toBe('recorded')
    expect(first.overview).toEqual({
      sourcesRecorded: 2,
      eventsRecorded: 2,
      rawPromptsIncluded: false,
    })
    expect(first.sources.map((source) => source.id)).toEqual(expect.arrayContaining([
      'automation:portfolio-operations-manager',
      'repair:portfolio-operations-manager',
    ]))
    expect(first.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'event:source-observed:automation:portfolio-operations-manager',
        metadata: expect.objectContaining({
          producerId: 'producer:codex-automation-inventory',
          rawPromptsIncluded: false,
        }),
      }),
    ]))
    expect(first.events.map((event) => event.summary).join(' ')).not.toContain('Add an authority boundary.')
    expect(snapshot.sources.filter((source) => source.id === 'automation:portfolio-operations-manager')).toHaveLength(1)
    expect(snapshot.events.filter((event) => event.id === 'event:source-observed:automation:portfolio-operations-manager')).toHaveLength(1)
  })

  it('records Agent Ops work item and handoff traces with review proposals', async () => {
    const root = await makeTempRoot()
    const first = await recordAgentOpsWorkItemProducerTraces(root, '2026-06-02T13:00:00.000Z')
    const second = await recordAgentOpsWorkItemProducerTraces(root, '2026-06-02T13:00:00.000Z')
    const snapshot = await getOpenBrainSnapshot(root)

    expect(first.status).toBe('recorded')
    expect(second.status).toBe('recorded')
    expect(first.overview).toEqual({
      workItemsObserved: 2,
      handoffsObserved: 1,
      proposalsRecorded: 1,
      rawWorkItemBodyIncluded: false,
      rawHandoffBodyIncluded: false,
    })
    expect(first.sources.map((source) => source.id)).toEqual(expect.arrayContaining([
      'work-item:work-1',
      'work-item:work-2',
      'handoff:handoff-1',
    ]))
    expect(first.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'event:source-observed:work-item:work-1',
        metadata: expect.objectContaining({
          producerId: 'producer:agent-ops-work-items',
          rawWorkItemBodyIncluded: false,
          rawHandoffBodyIncluded: false,
        }),
      }),
    ]))
    expect(first.proposals).toEqual([
      expect.objectContaining({
        id: 'proposal:agent-ops-work-item-review:work-1',
        status: 'pending',
        proposedMemory: expect.objectContaining({
          kind: 'risk',
          sourceIds: ['work-item:work-1'],
        }),
      }),
    ])
    const serialized = JSON.stringify(first)
    expect(serialized).not.toContain('Sensitive objective')
    expect(serialized).not.toContain('Sensitive blocker')
    expect(serialized).not.toContain('Sensitive handoff summary')
    expect(serialized).not.toContain('Sensitive acceptance criteria')
    expect(snapshot.sources.filter((source) => source.id === 'work-item:work-1')).toHaveLength(1)
    expect(snapshot.events.filter((event) => event.id === 'event:source-observed:work-item:work-1')).toHaveLength(1)
    expect(snapshot.proposals.filter((proposal) => proposal.id === 'proposal:agent-ops-work-item-review:work-1')).toHaveLength(1)
  })

  it('records Vercel AutoResearch proposals without executing experiments', async () => {
    const root = await makeTempRoot()
    const plan: VercelResearchPlan = {
      generatedAt: '2026-06-02T14:00:00.000Z',
      approvalType: 'vercel_deployment_research_proposal',
      thresholds: {
        queueWatchSeconds: 60,
        queueBlockedSeconds: 300,
        buildWatchSeconds: 600,
        buildBlockedSeconds: 900,
      },
      summaries: [],
      findings: [],
      operatingRules: ['Do not mutate hosted settings without approval.'],
      proposals: [
        {
          id: 'settings-review',
          title: 'Review preview deployment settings',
          hypothesis: 'Queue pressure may be reduced by a reviewed settings packet.',
          expectedImpact: 'Reduce integration waiting time without changing settings automatically.',
          scorecardBaseline: {
            project: 'portfolio',
            target: 'preview',
            queueSeconds: 90,
            buildSeconds: 300,
            totalSeconds: 390,
          },
          touchedFiles: ['docs/vercel-deployment-runbook.md'],
          touchedSettings: ['Vercel preview deployment setting'],
          riskLevel: 'high',
          approvalState: 'approval_required',
          approvalQuestion: 'Approve preparing the settings packet only?',
          rollbackPath: 'Close the packet and keep current Vercel settings.',
          evidence: ['queue 90s'],
          experimentTrace: {
            mode: 'hosted_settings_packet',
            experimentConfig: {
              scope: 'Prepare a settings proposal packet only; do not mutate hosted Vercel configuration.',
              commands: ['npm run deploy:metrics', 'npm run deploy:research:plan -- --json'],
              changedFiles: ['docs/vercel-deployment-runbook.md'],
              changedSettings: ['Vercel preview deployment setting'],
              sideEffectsAllowed: false,
            },
            metricGate: {
              metric: 'Deployment queue time',
              target: 'Stay below queue watch threshold.',
              current: 'portfolio/preview queued for 90s.',
              passCondition: 'Human review confirms the proposed next action and required evidence before execution.',
            },
            resultSummary: {
              status: 'not_run',
              notes: 'No experiment was executed by this AutoResearch planner.',
              metrics: ['queue 90s'],
            },
            rollbackPath: 'Close the packet and keep current Vercel settings.',
            promotionRecommendation: {
              recommendation: 'hold_for_approval',
              reason: 'Approval is required before any hosted setting review proceeds.',
              nextApprovalRequired: true,
            },
            forbiddenActions: [
              'execute_experiment_without_approval',
              'merge_branch',
              'deploy_to_production',
              'mutate_hosted_config',
              'write_durable_open_brain_memory',
            ],
          },
        },
      ],
    }

    const first = await recordVercelAutoResearchProducerTraces(plan, root, plan.generatedAt)
    const second = await recordVercelAutoResearchProducerTraces(plan, root, plan.generatedAt)
    const snapshot = await getOpenBrainSnapshot(root)

    expect(first.status).toBe('recorded')
    expect(second.status).toBe('recorded')
    expect(first.overview).toEqual({
      proposalsObserved: 1,
      approvalRequired: 1,
      memoryProposalsRecorded: 1,
      experimentsExecuted: false,
      hostedConfigMutated: false,
    })
    expect(first.sources).toEqual([
      expect.objectContaining({
        id: 'autoresearch:vercel:settings-review',
        kind: 'autoresearch_proposal',
      }),
    ])
    expect(first.events).toEqual([
      expect.objectContaining({
        id: 'event:autoresearch-proposal-created:settings-review',
        kind: 'autoresearch_proposal_created',
        metadata: expect.objectContaining({
          producerId: 'producer:autoresearch',
          hypothesis: 'Queue pressure may be reduced by a reviewed settings packet.',
          rollbackPath: 'Close the packet and keep current Vercel settings.',
          metricGate: expect.objectContaining({
            metric: 'Deployment queue time',
          }),
          promotionRecommendation: expect.objectContaining({
            recommendation: 'hold_for_approval',
            nextApprovalRequired: true,
          }),
          experimentTrace: expect.objectContaining({
            mode: 'hosted_settings_packet',
            resultSummary: expect.objectContaining({ status: 'not_run' }),
          }),
          experimentsExecuted: false,
          hostedConfigMutated: false,
        }),
      }),
    ])
    expect(first.proposals).toEqual([
      expect.objectContaining({
        id: 'proposal:autoresearch:settings-review',
        proposedMemory: expect.objectContaining({
          kind: 'risk',
          sourceIds: ['autoresearch:vercel:settings-review'],
          body: expect.stringContaining('Promotion recommendation: hold_for_approval'),
        }),
      }),
    ])
    expect(snapshot.sources.filter((source) => source.id === 'autoresearch:vercel:settings-review')).toHaveLength(1)
    expect(snapshot.events.filter((event) => event.id === 'event:autoresearch-proposal-created:settings-review')).toHaveLength(1)
    expect(snapshot.proposals.filter((proposal) => proposal.id === 'proposal:autoresearch:settings-review')).toHaveLength(1)
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
        sourceIds: ['source:automation'],
        sourceEventIds: [],
        approvalState: 'approved_memory_only' as const,
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
      expect.objectContaining({
        fromId: 'source:automation',
        toId: 'wiki:operating-rules',
        relationship: 'compiled_from_source',
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
