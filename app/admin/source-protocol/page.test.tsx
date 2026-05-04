import { render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.getByText(/Payouts accrue per answer receipt/i)).toBeInTheDocument()
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
