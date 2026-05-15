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

    const nextActions = await screen.findByRole('region', { name: 'Open Brain next actions' })
    expect(nextActions).toBeInTheDocument()
    expect(within(nextActions).getByText('Memory proposals need review')).toBeInTheDocument()
    expect(within(nextActions).getByText('Pending proposals')).toBeInTheDocument()
    expect(within(nextActions).getByText('Stale sources')).toBeInTheDocument()
    expect(within(nextActions).getByText('Producer gates')).toBeInTheDocument()
    expect(within(nextActions).getByText('Runtime parity')).toBeInTheDocument()

    fireEvent.click(within(nextActions).getByRole('button', { name: /Review proposals/i }))

    expect(screen.getByText('Adopt action-first governance reviews')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
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
})
