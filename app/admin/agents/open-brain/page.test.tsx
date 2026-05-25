import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OpenBrainPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const openBrainSnapshot = {
  generatedAt: '2026-05-15T12:00:00.000Z',
  service: {
    available: true,
    storage: 'local_jsonl',
    home: '/Users/vambahsillah/.open-brain',
    databaseConfigured: false,
    mcpConfigured: true,
    mcpUrl: 'http://localhost:4000/mcp',
    reason: null,
    operationalBoundary: 'Portfolio is a projection and approval surface.',
  },
  overview: {
    sources: 2,
    memories: 1,
    pendingProposals: 1,
    approvedProposals: 1,
    rejectedProposals: 0,
    wikiPages: 0,
    events: 2,
    links: 0,
    ragProjectionDocuments: 1,
    staleSources: 1,
    privateRecords: 0,
    producerGates: 2,
    enabledProducerGates: 1,
  },
  health: {
    sourceFreshness: 'yellow',
    memoryHealth: 'green',
    proposalHealth: 'yellow',
    wikiOverlay: 'yellow',
  },
  sources: [{
    id: 'source-1',
    kind: 'automation',
    title: 'Morning review source',
    summary: 'Automation context source.',
    path: '/tmp/source.json',
    privacyTier: 'internal',
    lastObservedAt: '2026-05-14T12:00:00.000Z',
    confidence: 0.9,
    metadata: {},
  }],
  events: [],
  links: [],
  memories: [],
  proposals: [{
    id: 'proposal-1',
    status: 'pending',
    proposedMemory: {
      kind: 'workflow',
      title: 'Adopt action-first governance reviews',
      body: 'Governance pages should show the next action before the archive.',
      privacyTier: 'internal',
      confidence: 0.9,
      sourceIds: ['source-1'],
    },
    sourceIds: ['source-1'],
    reason: 'Captured from Agent Ops review.',
    createdBy: 'codex',
    createdAt: '2026-05-15T11:00:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
  }],
  wikiPages: [],
  ragProjection: {
    version: 'v1',
    documents: [],
    eligibleMemoryCount: 1,
    excludedPrivateCount: 0,
    pineconeWriteStatus: 'blocked_pending_approval',
  },
  runtimeParity: [
    { runtime: 'Codex', status: 'connected', configPath: '/tmp/codex.toml', note: 'Connected.' },
    { runtime: 'Hermes', status: 'blocked', configPath: '/tmp/hermes.toml', note: 'Bridge missing.' },
  ],
  producerGates: [
    {
      id: 'producer-1',
      label: 'Automation reports',
      status: 'enabled',
      sourceKind: 'automation',
      eventKind: 'automation_run',
      privacyTier: 'internal',
      envVar: null,
      configuredValue: null,
      note: 'Enabled.',
    },
    {
      id: 'producer-2',
      label: 'Private exports',
      status: 'blocked',
      sourceKind: 'codex_thread',
      eventKind: null,
      privacyTier: 'private',
      envVar: 'OPEN_BRAIN_PRIVATE_EXPORTS',
      configuredValue: null,
      note: 'Approval required.',
    },
  ],
  relationshipMap: {
    overview: {
      relationships: 3,
      strongRelationships: 1,
      weakRelationships: 1,
      orphanedRecords: 1,
      staleSources: 1,
      proposalSuggestions: 2,
    },
    nodes: [
      {
        id: 'source-1',
        label: 'Morning review source',
        type: 'source',
        kind: 'codex_automation',
        privacyTier: 'internal_ops',
        summary: 'Automation context source.',
        path: '/tmp/source.json',
        health: 'yellow',
        x: 20,
        y: 40,
      },
      {
        id: 'memory-1',
        label: 'Action-first operating rule',
        type: 'memory',
        kind: 'operating_rule',
        privacyTier: 'internal_ops',
        summary: 'Next steps name the owner.',
        path: null,
        health: 'green',
        x: 76,
        y: 36,
      },
      {
        id: 'proposal-node:proposal-1',
        label: 'Adopt action-first governance reviews',
        type: 'proposal',
        kind: 'workflow',
        privacyTier: 'internal_ops',
        summary: 'Review pending proposal.',
        path: null,
        health: 'yellow',
        x: 65,
        y: 76,
      },
    ],
    edges: [
      {
        id: 'edge-1',
        fromId: 'source-1',
        toId: 'memory-1',
        relationship: 'supports_memory',
        strength: 'strong',
        confidence: 0.9,
        evidence: 'Memory cites source.',
        status: 'inferred',
      },
      {
        id: 'edge-2',
        fromId: 'source-1',
        toId: 'proposal-node:proposal-1',
        relationship: 'proposes_context',
        strength: 'weak',
        confidence: 0.5,
        evidence: 'Proposal cites source.',
        status: 'inferred',
      },
    ],
    insights: [
      {
        id: 'insight-1',
        kind: 'strengthen',
        severity: 'medium',
        title: 'Strengthen automation-to-runbook governance',
        detail: 'Automation source needs an explicit governing runbook link.',
        recommendation: 'Create a relationship proposal before future agents act on it.',
        actionLabel: 'Propose link',
        sourceNodeId: 'source-1',
        targetNodeId: null,
      },
    ],
  },
  modelOps: {
    available: true,
    generatedAt: '2026-05-15T12:00:00.000Z',
    projectName: 'Portfolio',
    sourceRoot: '/Users/vambahsillah/Projects/Portfolio',
    reason: null,
    currentLocalDefault: 'local:model',
    currentFrontierFallback: 'frontier:model',
    currentEmbeddingModel: 'embedding',
    monitor: {
      name: 'Model Ops',
      cadence: 'daily',
      latestReportPath: null,
      productionGate: 'approval required',
    },
    routerDecisions: [],
    candidates: [],
    benchmarkResults: [],
    ragQualityRuns: [],
    swapRequests: [],
    culturalResourceReviews: [],
  },
  contextPacket: {
    purpose: 'Use Open Brain as local memory source of truth.',
    boundaries: ['Do not promote private raw data.'],
    requiredInputs: ['Approved source records.'],
    currentRisks: ['Stale source review.'],
    expectedOutputs: ['Approved memory proposals.'],
  },
}

describe('OpenBrainPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wiki/compile')) {
        return { ok: true, json: async () => ({ pages: [{ slug: 'one' }] }) }
      }
      return { ok: true, json: async () => openBrainSnapshot }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Open Brain next actions and routes operators to the right view', async () => {
    render(<OpenBrainPage />)

    const metrics = await screen.findByRole('region', { name: 'Open Brain actionable metrics' })
    expect(metrics).toBeInTheDocument()
    expect(within(metrics).getByText('Actionable signals')).toBeInTheDocument()
    expect(within(metrics).getByText('Pending proposals')).toBeInTheDocument()
    expect(within(metrics).getByText('Stale sources')).toBeInTheDocument()
    expect(within(metrics).getByText('Producer gates')).toBeInTheDocument()
    expect(within(metrics).getByText('Runtime parity')).toBeInTheDocument()
    expect(within(metrics).getAllByText('1/2')).toHaveLength(2)
    expect(within(metrics).getByRole('button', { name: 'Open producer gate status' })).toHaveTextContent('1/2')
    expect(within(metrics).queryByText('Approved')).not.toBeInTheDocument()
    expect(within(metrics).queryByText('Rejected')).not.toBeInTheDocument()
    expect(within(metrics).queryByText('RAG docs')).not.toBeInTheDocument()

    const nextActions = await screen.findByRole('region', { name: 'Open Brain next actions' })
    expect(nextActions).toBeInTheDocument()
    expect(within(nextActions).getByText('Open Brain operator packet')).toBeInTheDocument()
    expect(within(nextActions).getByText('Memory proposals need review')).toBeInTheDocument()
    expect(within(nextActions).getByText('Why this matters')).toBeInTheDocument()
    expect(within(nextActions).getByText(/Unreviewed proposals are not durable memory yet/i)).toBeInTheDocument()
    expect(within(nextActions).getByText('Recommended action')).toBeInTheDocument()
    expect(within(nextActions).getByText(/Review the pending proposal queue first/i)).toBeInTheDocument()
    expect(within(nextActions).getByText('Safety boundary')).toBeInTheDocument()
    expect(within(nextActions).getByText(/does not publish private raw exports/i)).toBeInTheDocument()
    expect(within(nextActions).getByText('Evidence home')).toBeInTheDocument()
    expect(within(nextActions).getByText(/Proposal review history and status live in the Proposals view/i)).toBeInTheDocument()

    fireEvent.click(within(nextActions).getByRole('button', { name: /Review proposals/i }))

    expect(screen.getByText('Adopt action-first governance reviews')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
  })

  it('routes the actionable Open Brain metric cards to underlying data', async () => {
    render(<OpenBrainPage />)

    const metrics = await screen.findByRole('region', { name: 'Open Brain actionable metrics' })
    fireEvent.click(within(metrics).getByRole('button', { name: 'Open stale source records' }))

    expect(screen.getByText('Morning review source')).toBeInTheDocument()
    expect(screen.getByText('/tmp/source.json')).toBeInTheDocument()
  })

  it('keeps wiki compilation as an explicit gated action', async () => {
    render(<OpenBrainPage />)

    const nextActions = await screen.findByRole('region', { name: 'Open Brain next actions' })
    fireEvent.click(within(nextActions).getByRole('button', { name: /Compile wiki preview/i }))

    expect(await screen.findByText('1 wiki page preview(s) compiled. Approval is required before repo writes.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/open-brain/wiki/compile', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    }))
  })

  it('renders the relationship map as a proposal-only Open Brain view', async () => {
    render(<OpenBrainPage />)

    const tabs = await screen.findByRole('button', { name: 'Map' })
    fireEvent.click(tabs)

    const map = await screen.findByRole('region', { name: 'Open Brain relationship map' })
    expect(within(map).getByText('Relationships')).toBeInTheDocument()
    expect(within(map).getByText('Weak links')).toBeInTheDocument()
    expect(within(map).getByText('Orphaned records')).toBeInTheDocument()
    expect(within(map).getByText('Relationship insights')).toBeInTheDocument()
    expect(within(map).getByText('Strengthen automation-to-runbook governance')).toBeInTheDocument()
    expect(within(map).getByText('Morning review source')).toBeInTheDocument()

    fireEvent.click(within(map).getByRole('button', { name: 'Propose link' }))

    expect(screen.getByText('Propose link is proposal-only in v1. No Open Brain link was changed from this map.')).toBeInTheDocument()
  })
})
