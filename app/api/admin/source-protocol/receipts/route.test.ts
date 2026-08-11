import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAnswerReceipt,
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
import { NextResponse } from 'next/server'

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

function receiptPayload() {
  return buildAnswerReceipt({
    modelId: 'allenai/Olmo-3-7B-Instruct',
    works: [work],
    sources: [retrieved],
    context: {
      intendedUses: ['summarization', 'commercial'],
      queryText: 'What does the demo source say?',
      outputTokenCount: 100,
      netQueryRevenueUsd: 2,
      generatedAt: '2026-05-01T12:00:00.000Z',
    },
  })
}

function request(body: unknown) {
  return new NextRequest('https://example.com/api/admin/source-protocol/receipts', {
    method: 'POST',
    headers: {
      authorization: 'Bearer source-secret',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/source-protocol/receipts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSourceProtocolBearer.mockReturnValue(null)
    mocks.supabaseAdmin = { from: mocks.from }
  })

  afterEach(() => {
    mocks.supabaseAdmin = { from: mocks.from }
  })

  it('returns unauthorized when the bearer guard rejects the request', async () => {
    mocks.requireSourceProtocolBearer.mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await POST(request({ receipt: receiptPayload() }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a server error when the admin Supabase client is unavailable', async () => {
    mocks.supabaseAdmin = null

    const response = await POST(request({ receipt: receiptPayload() }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Supabase admin client unavailable' })
  })

  it('rejects payloads without a receipt id and attributedChunks array', async () => {
    const response = await POST(request({ receipt: { attributedChunks: [] } }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'receipt is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('upserts the receipt, replaces chunks, and returns attribution counts', async () => {
    const receipt = receiptPayload()
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq })
    const insert = vi.fn().mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'answer_receipts') return { upsert }
      if (table === 'answer_receipt_chunks') return { delete: del, insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({ receipt }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      receiptId: receipt.id,
      attributedChunks: 1,
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: receipt.id,
        model_id: 'allenai/Olmo-3-7B-Instruct',
        raw_receipt: receipt,
      }),
      { onConflict: 'id' }
    )
    expect(eq).toHaveBeenCalledWith('answer_receipt_id', receipt.id)
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        answer_receipt_id: receipt.id,
        source_chunk_external_id: 'chunk-demo',
        creator_external_id: 'creator-demo',
      }),
    ])
  })

  it('skips chunk insert when the receipt has no attributed chunks', async () => {
    const receipt = {
      ...receiptPayload(),
      attributedChunks: [],
    }
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq })
    const insert = vi.fn()

    mocks.from.mockImplementation((table: string) => {
      if (table === 'answer_receipts') return { upsert }
      if (table === 'answer_receipt_chunks') return { delete: del, insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({ receipt }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      receiptId: receipt.id,
      attributedChunks: 0,
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('surfaces upsert failures as 500 responses', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } })
    mocks.from.mockReturnValue({ upsert })

    const response = await POST(request({ receipt: receiptPayload() }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'upsert failed' })
  })
})
