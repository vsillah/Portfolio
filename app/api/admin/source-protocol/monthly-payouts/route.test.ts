import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAnswerReceipt,
  buildMonthlyPayoutSettlement,
  type LicenseGrant,
  type LicensedWork,
  type RetrievedSourceChunk,
  type SourceChunk,
} from '@/lib/source-respecting-llm-protocol'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  supabaseAdmin: null as { from: ReturnType<typeof vi.fn> } | null,
  requireSourceProtocolBearer: vi.fn(),
}))

vi.mock('@/lib/source-protocol-auth', () => ({
  requireSourceProtocolBearer: mocks.requireSourceProtocolBearer,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin
  },
}))

import { POST } from './route'

const work: LicensedWork = {
  id: 'work-demo',
  creatorId: 'creator-demo',
  title: 'Demo challenged work',
  rightsHolderType: 'author',
  banStatus: 'challenged',
  chainOfTitleVerified: true,
}

const grant: LicenseGrant = {
  id: 'grant-demo',
  workId: work.id,
  status: 'active',
  allowedUses: ['retrieval', 'citation', 'summarization', 'commercial'],
}

const sourceChunk: SourceChunk = {
  id: 'chunk-demo',
  workId: work.id,
  creatorId: work.creatorId,
  textHash: 'hash-demo',
  citationLabel: 'Demo challenged work, excerpt 1',
}

const retrieved: RetrievedSourceChunk = {
  chunk: sourceChunk,
  licenseGrant: grant,
  retrievalScore: 0.95,
  cited: true,
  supportsAnswer: true,
  supportedOutputTokens: 100,
}

function settlementPayload(minimumSettlementUsd = 10) {
  const receipt = buildAnswerReceipt({
    modelId: 'allenai/Olmo-3-7B-Instruct',
    works: [work],
    sources: [retrieved],
    context: {
      intendedUses: ['summarization'],
      queryText: 'Low revenue demo query.',
      outputTokenCount: 100,
      netQueryRevenueUsd: 1,
    },
  })
  return buildMonthlyPayoutSettlement({
    period: '2026-05',
    receipts: [receipt],
    minimumSettlementUsd,
  })
}

function request(body: unknown) {
  return new NextRequest('https://example.com/api/admin/source-protocol/monthly-payouts', {
    method: 'POST',
    headers: {
      authorization: 'Bearer source-secret',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/source-protocol/monthly-payouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSourceProtocolBearer.mockReturnValue(null)
    mocks.supabaseAdmin = { from: mocks.from }
  })

  it('returns unauthorized when the bearer guard rejects the request', async () => {
    mocks.requireSourceProtocolBearer.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await POST(request({ settlement: settlementPayload() }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a server error when the admin Supabase client is unavailable', async () => {
    mocks.supabaseAdmin = null

    const response = await POST(request({ settlement: settlementPayload() }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Supabase admin client unavailable' })
  })

  it('rejects payloads without a settlement period and payouts array', async () => {
    const response = await POST(request({ settlement: { payouts: [] } }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'settlement is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('short-circuits when the settlement maps to zero payout rows', async () => {
    const response = await POST(request({
      settlement: {
        period: '2026-05',
        generatedAt: '2026-05-31T12:00:00.000Z',
        minimumSettlementUsd: 10,
        totalAccruedUsd: 0,
        totalPayableUsd: 0,
        heldCreatorIds: [],
        payouts: [],
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      period: '2026-05',
      payouts: 0,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('upserts monthly creator payouts on creator_external_id,settlement_period', async () => {
    const settlement = settlementPayload()
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })

    const response = await POST(request({ settlement }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      period: '2026-05',
      payouts: 1,
      totalAccruedUsd: settlement.totalAccruedUsd,
      totalPayableUsd: settlement.totalPayableUsd,
    })
    expect(mocks.from).toHaveBeenCalledWith('monthly_creator_payouts')
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          creator_external_id: 'creator-demo',
          settlement_period: '2026-05',
          settlement_status: 'held_for_review',
        }),
      ],
      { onConflict: 'creator_external_id,settlement_period' }
    )
  })

  it('surfaces upsert failures as 500 responses', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } })
    mocks.from.mockReturnValue({ upsert })

    const response = await POST(request({ settlement: settlementPayload() }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'upsert failed' })
  })
})
