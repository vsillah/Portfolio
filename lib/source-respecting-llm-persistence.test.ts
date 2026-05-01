import { describe, expect, it } from 'vitest'
import {
  buildAnswerReceiptInsertRows,
  buildMonthlyPayoutInsertRows,
} from './source-respecting-llm-persistence'
import {
  buildAnswerReceipt,
  buildMonthlyPayoutSettlement,
  type LicenseGrant,
  type LicensedWork,
  type RetrievedSourceChunk,
  type SourceChunk,
} from './source-respecting-llm-protocol'

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

describe('source-respecting LLM persistence payloads', () => {
  it('maps answer receipts to database insert rows', () => {
    const receipt = buildAnswerReceipt({
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

    const rows = buildAnswerReceiptInsertRows(receipt)

    expect(rows.answerReceipt).toMatchObject({
      id: receipt.id,
      query_hash: receipt.queryHash,
      model_id: 'allenai/Olmo-3-7B-Instruct',
      creator_pool_usd: 1.2,
      raw_receipt: receipt,
    })
    expect(rows.answerReceiptChunks).toEqual([
      {
        answer_receipt_id: receipt.id,
        source_chunk_external_id: 'chunk-demo',
        creator_external_id: 'creator-demo',
        work_external_id: 'work-demo',
        citation_label: 'Demo challenged work, excerpt 1',
        supported_output_tokens: 100,
        attribution_weight: 1,
        accrued_payout_usd: 1.2,
      },
    ])
  })

  it('maps monthly settlements to payout rows with hold reasons', () => {
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
    const settlement = buildMonthlyPayoutSettlement({
      period: '2026-05',
      receipts: [receipt],
      minimumSettlementUsd: 10,
    })

    const rows = buildMonthlyPayoutInsertRows(settlement)

    expect(rows.monthlyCreatorPayouts).toHaveLength(1)
    expect(rows.monthlyCreatorPayouts[0]).toMatchObject({
      creator_external_id: 'creator-demo',
      settlement_period: '2026-05',
      accrued_payout_usd: 0.6,
      settlement_status: 'held_for_review',
    })
    expect(rows.monthlyCreatorPayouts[0].hold_reason).toContain('minimum settlement threshold')
  })
})
