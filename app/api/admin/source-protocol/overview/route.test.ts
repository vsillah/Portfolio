import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryResult = {
  data?: unknown[]
  count?: number | null
  error?: unknown
}

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  supabaseAdmin: null as { from: ReturnType<typeof vi.fn> } | null,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin
  },
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/source-protocol/overview', {
    headers: { authorization: 'Bearer token' },
  })
}

function tableQuery(
  table: string,
  counts: Record<string, number>,
  rows: Record<string, unknown[]>,
  countErrors: Record<string, unknown> = {}
) {
  return {
    select: vi.fn((columns: string, options?: { count?: string; head?: boolean }) => {
      if (options?.count === 'exact' && options.head) {
        let result = {
          count: counts[table] ?? 0,
          error: countErrors[table] ?? null,
        }

        const query = {
          eq: vi.fn((column: string, value: string | boolean) => {
            result = {
              count: counts[`${table}:${column}=${String(value)}`] ?? 0,
              error: countErrors[`${table}:${column}=${String(value)}`] ?? countErrors[table] ?? null,
            }
            return query
          }),
          then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
        }
        return query
      }

      return {
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: rows[table] ?? [],
          error: null,
        }),
      }
    }),
  }
}

describe('GET /api/admin/source-protocol/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T10:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.supabaseAdmin = { from: mocks.from }
    mocks.from.mockImplementation((table: string) => tableQuery(table, {}, {}))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth before querying source protocol tables', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a server error when the admin Supabase client is unavailable', async () => {
    mocks.supabaseAdmin = null

    const response = await GET(request() as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Supabase admin client unavailable' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns the missing schema state when source protocol tables are absent', async () => {
    mocks.from.mockImplementation((table: string) =>
      tableQuery(
        table,
        {},
        {},
        {
          source_creators: {
            code: '42P01',
            message: 'relation "source_creators" does not exist',
          },
        }
      )
    )

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      available: false,
      generatedAt: '2026-05-04T10:00:00.000Z',
      reason: 'Source protocol schema has not been applied in this environment.',
      migration: 'migrations/20260501193000_source_respecting_llm.sql',
    })
  })

  it('aggregates summary counts and accrued payouts from table results', async () => {
    mocks.from.mockImplementation((table: string) =>
      tableQuery(
        table,
        {
          source_creators: 2,
          source_creator_portal_accounts: 1,
          licensed_works: 3,
          'license_grants:status=active': 4,
          'source_chunks:is_retrievable=true': 5,
          answer_receipts: 6,
          monthly_creator_payouts: 7,
          'creator_rights_disputes:status=open': 8,
          'monthly_creator_payouts:settlement_status=held_for_review': 2,
        },
        {
          source_creators: [{ id: 'creator-1', display_name: 'Creator One' }],
          source_creator_portal_accounts: [{ id: 'portal-1', creator_id: 'creator-1' }],
          licensed_works: [{ id: 'work-1', title: 'Licensed Work' }],
          license_grants: [{ id: 'grant-1', status: 'active' }],
          source_chunks: [{ id: 'chunk-1', is_retrievable: true }],
          answer_receipts: [{ id: 'receipt-1', creator_pool_usd: 0.02 }],
          answer_receipt_chunks: [{ answer_receipt_id: 'receipt-1', accrued_payout_usd: 0.001 }],
          monthly_creator_payouts: [
            { id: 'payout-1', accrued_payout_usd: 0.1234564 },
            { id: 'payout-2', accrued_payout_usd: 0.0000004 },
          ],
          creator_rights_disputes: [{ id: 'dispute-1', status: 'open' }],
          creator_rights_model_reviews: [{ id: 'review-1', recommendation: 'keep' }],
        }
      )
    )

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      available: true,
      generatedAt: '2026-05-04T10:00:00.000Z',
      summary: {
        creators: 2,
        portalAccounts: 1,
        works: 3,
        activeGrants: 4,
        retrievableChunks: 5,
        answerReceipts: 6,
        monthlyPayouts: 7,
        openDisputes: 8,
        heldPayouts: 2,
        accruedPayoutUsd: 0.123457,
      },
      creators: [{ id: 'creator-1', display_name: 'Creator One' }],
      monthlyPayouts: [
        { id: 'payout-1', accrued_payout_usd: 0.1234564 },
        { id: 'payout-2', accrued_payout_usd: 0.0000004 },
      ],
      modelReviews: [{ id: 'review-1', recommendation: 'keep' }],
      bannedBooksCorpus: {
        summary: {
          stagedRecords: expect.any(Number),
          outreachPacketCount: 3,
          rightsReadyRecords: expect.any(Number),
          retrievableRecords: 0,
        },
        outreachPackets: expect.arrayContaining([
          expect.objectContaining({ key: 'author_direct_rag_permission' }),
          expect.objectContaining({ key: 'publisher_permissions_rag_license' }),
          expect.objectContaining({ key: 'estate_permissions_rag_license' }),
        ]),
        sourceIngestionQueue: {
          mode: 'metadata_only_dry_run',
          summary: {
            sourceCount: 3,
            candidateCount: 5,
            existingRecordMatches: 1,
            stageableCandidates: 0,
            evidenceReviewRequired: 4,
            blockedFullTextActions: 5,
          },
        },
        swarmAgents: expect.arrayContaining([
          expect.objectContaining({ key: 'banned-book-source-registry' }),
          expect.objectContaining({ key: 'rights-governance-review' }),
        ]),
      },
    })
    expect(mocks.from).toHaveBeenCalledWith('source_creators')
    expect(mocks.from).toHaveBeenCalledWith('answer_receipt_chunks')
    expect(mocks.from).toHaveBeenCalledWith('creator_rights_model_reviews')
  })
})
