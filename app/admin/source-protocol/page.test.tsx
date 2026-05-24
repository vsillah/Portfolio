import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ADMIN_NAV } from '@/lib/admin-nav'
import SourceProtocolPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'test-admin-token' })),
}))

const overview = {
  available: true,
  generatedAt: '2026-05-03T12:00:00.000Z',
  summary: {
    creators: 1,
    portalAccounts: 1,
    works: 1,
    activeGrants: 1,
    retrievableChunks: 1,
    answerReceipts: 1,
    monthlyPayouts: 1,
    openDisputes: 0,
    heldPayouts: 0,
    accruedPayoutUsd: 0.006,
  },
  creators: [],
  portalAccounts: [
    {
      id: '8f111111-1111-4111-8111-111111111111',
      creator_id: '7f111111-1111-4111-8111-111111111111',
      user_id: '6f111111-1111-4111-8111-111111111111',
      user_email: 'creator@example.com',
      creator_display_name: 'Demo Creator',
      status: 'active',
      can_view_earnings: true,
      can_view_receipts: true,
      created_at: '2026-05-03T12:00:00.000Z',
    },
  ],
  works: [],
  licenseGrants: [],
  chunks: [],
  receipts: [
    {
      id: 'receipt-demo-001',
      model_id: 'allenai/Olmo-3-7B-Instruct',
      generated_at: '2026-05-03T12:00:00.000Z',
      creator_pool_usd: 0.006,
      cited_chunk_ids: ['chunk-1'],
    },
  ],
  receiptChunks: [
    {
      answer_receipt_id: 'receipt-demo-001',
      citation_label: 'Demo citation',
      accrued_payout_usd: 0.006,
    },
  ],
  monthlyPayouts: [],
  disputes: [],
  modelReviews: [],
  bannedBooksCorpus: {
    generatedAt: '2026-05-24T00:00:00.000Z',
    scope: 'U.S. school and library bans/challenges first.',
    licenseModel: 'RAG only.',
    sourceSpine: [
      {
        name: 'ALA Most Challenged Books',
        role: 'Annual challenged-title evidence.',
      },
    ],
    swarmAgents: [
      {
        key: 'banned-book-source-registry',
        name: 'Amina, Source Registry Lead',
        lane: 'Discovery evidence',
        output: 'Source evidence only.',
        boundary: 'No rights-holder guesses.',
        approvalGate: 'Source evidence required.',
      },
    ],
    summary: {
      stagedRecords: 1,
      sourceSpineCount: 1,
      outreachPacketCount: 3,
      rightsReadyRecords: 1,
      outreachReadyRecords: 1,
      activeLicenseRecords: 0,
      retrievableRecords: 0,
      blockedRecords: 0,
    },
    outreachPackets: [
      {
        key: 'author_direct_rag_permission',
        audience: 'author',
        subject: 'Permission request: rights-cleared retrieval for your challenged work',
        purpose: 'Ask the author for RAG-only participation.',
        permissionAsk: ['Allow retrieval and citation.'],
        guardrails: ['No fine-tuning in v1.'],
        approvalGate: 'Human approval required before sending.',
        followUpCadenceDays: [7, 21, 45],
      },
      {
        key: 'publisher_permissions_rag_license',
        audience: 'publisher',
        subject: 'Permissions inquiry: RAG-only access license for challenged-title preservation',
        purpose: 'Ask publisher permissions staff to confirm rights path.',
        permissionAsk: ['Confirm digital excerpt rights.'],
        guardrails: ['No production retrieval before active grant.'],
        approvalGate: 'Governance review required.',
        followUpCadenceDays: [10, 30, 60],
      },
      {
        key: 'estate_permissions_rag_license',
        audience: 'estate',
        subject: 'Estate permissions inquiry: preserving access with revocable RAG-only use',
        purpose: 'Ask the estate for cautious permission.',
        permissionAsk: ['Confirm estate authority.'],
        guardrails: ['Chain of title required.'],
        approvalGate: 'Shaka governance review required.',
        followUpCadenceDays: [14, 45, 90],
      },
    ],
    records: [
      {
        id: 'demo-book',
        canonicalTitle: 'Demo Challenged Book',
        authors: ['Demo Author'],
        banStatus: 'challenged',
        jurisdictionContext: 'U.S. school challenge evidence.',
        rightsholderCandidate: {
          name: 'Demo Author or publisher',
          confidence: 'medium',
        },
        outreachStatus: 'not_started',
        licenseStatus: 'not_requested',
        ingestionStatus: 'not_started',
        nextAction: 'Draft RAG-only permission packet.',
      },
    ],
    safeguards: ['Do not ingest full text before license approval.'],
  },
}

describe('SourceProtocolPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => overview,
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the read-only source protocol overview', async () => {
    render(<SourceProtocolPage />)

    expect(await screen.findByRole('heading', { name: 'Source Protocol' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Banned Books Rights-Ready Corpus' })).toBeInTheDocument()
    expect(screen.getByText('Amina, Source Registry Lead')).toBeInTheDocument()
    expect(screen.getByText('Permission request: rights-cleared retrieval for your challenged work')).toBeInTheDocument()
    expect(screen.getByText('Demo Challenged Book')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Portal Access/i })[0])

    expect(screen.getByText(/Payouts accrue per answer receipt/i)).toBeInTheDocument()
    expect(screen.getByText('Demo Creator')).toBeInTheDocument()
    expect(screen.getByText('creator@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Receipts/i })[0])

    expect(screen.getByText('allenai/Olmo-3-7B-Instruct')).toBeInTheDocument()
    expect(screen.getByText(/1 cited \/ 1 attributed/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/source-protocol/overview', {
        headers: { Authorization: 'Bearer test-admin-token' },
      })
    })
  })

  it('shows the missing schema state without failing the page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        available: false,
        generatedAt: '2026-05-03T12:00:00.000Z',
        reason: 'Source protocol schema has not been applied in this environment.',
        migration: 'migrations/20260501193000_source_respecting_llm.sql',
      }),
    })))

    render(<SourceProtocolPage />)

    expect(await screen.findByText('Source protocol schema is not available here')).toBeInTheDocument()
    expect(screen.getByText(/20260501193000_source_respecting_llm/i)).toBeInTheDocument()
  })

  it('is linked from Quality & insights admin navigation', () => {
    const qualityCategory = ADMIN_NAV.categories.find((category) => category.label === 'Quality & insights')

    expect(qualityCategory?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Source Protocol',
          href: '/admin/source-protocol',
        }),
      ])
    )
  })
})
