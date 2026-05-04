import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreatorSourceProtocolPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/SiteThemeCorner', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'creator-token' })),
}))

const linkedStatement = {
  available: true,
  linked: true,
  generatedAt: '2026-05-04T09:00:00.000Z',
  portal: {
    status: 'active',
    can_view_earnings: true,
    can_view_receipts: true,
    accepted_at: '2026-05-04T09:00:00.000Z',
  },
  creator: {
    display_name: 'Demo Creator',
    categories: ['banned_author'],
    rights_holder_types: ['author'],
    verification_status: 'verified',
    protected_identity: false,
    public_bio: null,
  },
  summary: {
    works: 1,
    activeGrants: 1,
    retrievableChunks: 1,
    attributedReceipts: 1,
    monthlyPayouts: 1,
    accruedPayoutUsd: 0.006,
    attributedTokenCount: 12,
    heldPayouts: 0,
    openDisputes: 0,
  },
  works: [
    {
      id: 'work-1',
      title: 'Demo Work',
      review_status: 'approved',
      ban_status: 'challenged',
      chain_of_title_verified: true,
      community_consent_required: false,
      community_consent_verified: false,
    },
  ],
  licenseGrants: [
    {
      id: 'grant-1',
      work_id: 'work-1',
      status: 'active',
      allowed_uses: ['retrieval', 'citation'],
    },
  ],
  chunks: [
    {
      id: 'chunk-1',
      work_id: 'work-1',
      citation_label: 'Demo Work, p. 1',
      is_retrievable: true,
    },
  ],
  payouts: [
    {
      id: 'payout-1',
      settlement_period: '2026-05',
      settlement_status: 'simulation',
      attributed_token_count: 12,
      accrued_payout_usd: 0.006,
      hold_reason: null,
    },
  ],
  attributedChunks: [
    {
      answer_receipt_id: 'receipt-demo-001',
      source_chunk_external_id: 'chunk-1',
      citation_label: 'Demo Work, p. 1',
      supported_output_tokens: 12,
      attribution_weight: 1,
      accrued_payout_usd: 0.006,
    },
  ],
  disputes: [],
}

describe('CreatorSourceProtocolPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => linkedStatement,
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders linked creator rights and payout statement', async () => {
    render(<CreatorSourceProtocolPage />)

    expect(await screen.findByRole('heading', { name: 'Creator Statement' })).toBeInTheDocument()
    expect(screen.getByText('Demo Creator')).toBeInTheDocument()
    expect(screen.getByText(/Usage is calculated per approved answer receipt/i)).toBeInTheDocument()
    expect(screen.getByText('Demo Work')).toBeInTheDocument()
    expect(screen.getByText('$0.006')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/source-protocol/creator/statement', {
        headers: { Authorization: 'Bearer creator-token' },
      })
    })
  })

  it('renders the unlinked account state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        available: true,
        linked: false,
        generatedAt: '2026-05-04T09:00:00.000Z',
        reason: 'No active creator portal account is linked to this login yet.',
      }),
    })))

    render(<CreatorSourceProtocolPage />)

    expect(await screen.findByText('Your login is not linked to a creator account yet')).toBeInTheDocument()
    expect(screen.getByText(/No active creator portal account/i)).toBeInTheDocument()
  })

  it('renders the missing schema state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        available: false,
        linked: false,
        generatedAt: '2026-05-04T09:00:00.000Z',
        reason: 'Source protocol creator portal schema has not been applied in this environment.',
        migration: 'supabase/migrations/20260504092130_source_protocol_creator_portal.sql',
      }),
    })))

    render(<CreatorSourceProtocolPage />)

    expect(await screen.findByText('Creator portal schema is not available yet')).toBeInTheDocument()
    expect(screen.getByText(/20260504092130_source_protocol_creator_portal/i)).toBeInTheDocument()
  })
})
