import type {
  AnswerReceipt,
  MonthlyPayoutSettlement,
} from './source-respecting-llm-protocol'

export interface PersistableAnswerReceiptRows {
  answerReceipt: {
    id: string
    query_hash: string
    model_id: string
    generated_at: string
    output_token_count: number
    net_query_revenue_usd: number
    creator_pool_usd: number
    operations_pool_usd: number
    reserve_pool_usd: number
    retrieved_chunk_ids: string[]
    cited_chunk_ids: string[]
    decisions: unknown
    abuse_flags: string[]
    raw_receipt: AnswerReceipt
  }
  answerReceiptChunks: Array<{
    answer_receipt_id: string
    source_chunk_external_id: string
    creator_external_id: string
    work_external_id: string
    citation_label: string
    supported_output_tokens: number
    attribution_weight: number
    accrued_payout_usd: number
  }>
}

export interface PersistableMonthlyPayoutRows {
  monthlyCreatorPayouts: Array<{
    creator_external_id: string
    settlement_period: string
    answer_receipt_ids: string[]
    attributed_chunk_count: number
    attributed_token_count: number
    accrued_payout_usd: number
    settlement_status: 'simulation' | 'pending' | 'approved' | 'paid' | 'held_for_review'
    hold_reason: string | null
  }>
}

export function buildAnswerReceiptInsertRows(receipt: AnswerReceipt): PersistableAnswerReceiptRows {
  return {
    answerReceipt: {
      id: receipt.id,
      query_hash: receipt.queryHash,
      model_id: receipt.modelId,
      generated_at: receipt.generatedAt,
      output_token_count: receipt.outputTokenCount,
      net_query_revenue_usd: receipt.netQueryRevenueUsd,
      creator_pool_usd: receipt.creatorPoolUsd,
      operations_pool_usd: receipt.operationsPoolUsd,
      reserve_pool_usd: receipt.reservePoolUsd,
      retrieved_chunk_ids: receipt.retrievedChunkIds,
      cited_chunk_ids: receipt.citedChunkIds,
      decisions: receipt.decisions,
      abuse_flags: receipt.abuseFlags,
      raw_receipt: receipt,
    },
    answerReceiptChunks: receipt.attributedChunks.map((chunk) => ({
      answer_receipt_id: receipt.id,
      source_chunk_external_id: chunk.chunkId,
      creator_external_id: chunk.creatorId,
      work_external_id: chunk.workId,
      citation_label: chunk.citationLabel,
      supported_output_tokens: chunk.supportedOutputTokens,
      attribution_weight: chunk.weight,
      accrued_payout_usd: chunk.accruedPayoutUsd,
    })),
  }
}

export function buildMonthlyPayoutInsertRows(
  settlement: MonthlyPayoutSettlement
): PersistableMonthlyPayoutRows {
  return {
    monthlyCreatorPayouts: settlement.payouts.map((payout) => ({
      creator_external_id: payout.creatorId,
      settlement_period: settlement.period,
      answer_receipt_ids: payout.answerReceiptIds,
      attributed_chunk_count: payout.attributedChunkCount,
      attributed_token_count: payout.attributedTokenCount,
      accrued_payout_usd: payout.accruedPayoutUsd,
      settlement_status: payout.settlementStatus,
      hold_reason:
        payout.settlementStatus === 'held_for_review'
          ? `Accrued payout below minimum settlement threshold of $${settlement.minimumSettlementUsd}.`
          : null,
    })),
  }
}
