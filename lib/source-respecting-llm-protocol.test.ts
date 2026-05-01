import { describe, expect, it } from 'vitest'
import {
  buildAnswerReceipt,
  buildCreatorRightsModelReview,
  buildMonthlyPayoutSettlement,
  type CreatorRightsModelCandidate,
  type LicenseGrant,
  type LicensedWork,
  type RetrievedSourceChunk,
  type SourceChunk,
} from './source-respecting-llm-protocol'

const work: LicensedWork = {
  id: 'work-banned-book-1',
  creatorId: 'creator-1',
  title: 'A challenged history text',
  rightsHolderType: 'author',
  banStatus: 'challenged',
  chainOfTitleVerified: true,
}

const grant: LicenseGrant = {
  id: 'grant-1',
  workId: work.id,
  status: 'active',
  allowedUses: ['retrieval', 'citation', 'summarization', 'educational', 'commercial'],
  quoteLimitCharacters: 280,
}

function chunk(id: string, creatorId = 'creator-1'): SourceChunk {
  return {
    id,
    workId: work.id,
    creatorId,
    textHash: `hash-${id}`,
    citationLabel: `Source ${id}`,
    location: 'p. 12',
  }
}

function retrieved(
  id: string,
  supportedOutputTokens: number,
  overrides: Partial<RetrievedSourceChunk> = {}
): RetrievedSourceChunk {
  return {
    chunk: chunk(id),
    licenseGrant: grant,
    retrievalScore: 0.92,
    cited: true,
    supportsAnswer: true,
    supportedOutputTokens,
    quotedCharacters: 120,
    ...overrides,
  }
}

describe('buildAnswerReceipt', () => {
  it('attributes creator payout across cited and allowed source chunks', () => {
    const receipt = buildAnswerReceipt({
      modelId: 'allenai/Olmo-3-7B-Instruct',
      works: [work],
      sources: [retrieved('chunk-a', 30), retrieved('chunk-b', 70)],
      context: {
        intendedUses: ['summarization', 'commercial'],
        queryText: 'What does this author say about access?',
        outputTokenCount: 100,
        netQueryRevenueUsd: 1,
        generatedAt: '2026-05-01T12:00:00.000Z',
      },
    })

    expect(receipt.creatorPoolUsd).toBe(0.6)
    expect(receipt.operationsPoolUsd).toBe(0.25)
    expect(receipt.reservePoolUsd).toBe(0.15)
    expect(receipt.attributedChunks).toHaveLength(2)
    expect(receipt.attributedChunks[0]).toMatchObject({ weight: 0.3, accruedPayoutUsd: 0.18 })
    expect(receipt.attributedChunks[1]).toMatchObject({ weight: 0.7, accruedPayoutUsd: 0.42 })
    expect(receipt.decisions.every((decision) => decision.decision === 'allow')).toBe(true)
  })

  it('blocks attribution when license grant is revoked or chain of title is unverified', () => {
    const receipt = buildAnswerReceipt({
      modelId: 'Qwen/Qwen3-4B-Instruct-2507',
      works: [{ ...work, chainOfTitleVerified: false }],
      sources: [
        retrieved('chunk-a', 100, {
          licenseGrant: {
            ...grant,
            status: 'revoked',
          },
        }),
      ],
      context: {
        intendedUses: ['summarization'],
        queryText: 'Summarize the source.',
        outputTokenCount: 100,
        netQueryRevenueUsd: 1,
      },
    })

    expect(receipt.attributedChunks).toHaveLength(0)
    expect(receipt.decisions[0].decision).toBe('block')
    expect(receipt.decisions[0].reasons.join(' ')).toContain('revoked')
    expect(receipt.decisions[0].reasons.join(' ')).toContain('Chain of title')
  })

  it('flags payout abuse patterns without blocking the audit receipt', () => {
    const receipt = buildAnswerReceipt({
      modelId: 'mistralai/Mistral-7B-Instruct-v0.2',
      works: [work],
      sources: [
        retrieved('chunk-a', 10),
        retrieved('chunk-a', 10),
        retrieved('chunk-a', 10),
        retrieved('chunk-b', 10),
        retrieved('chunk-c', 10),
        retrieved('chunk-d', 10),
        retrieved('chunk-e', 10),
        retrieved('chunk-f', 10),
      ],
      context: {
        intendedUses: ['summarization'],
        queryText: 'Ask about my own book repeatedly.',
        outputTokenCount: 80,
        netQueryRevenueUsd: 1,
        duplicateQueryCount: 5,
        queryingCreatorId: 'creator-1',
      },
    })

    expect(receipt.abuseFlags).toContain('duplicate_query_pattern')
    expect(receipt.abuseFlags).toContain('creator_self_query_payout_risk')
    expect(receipt.abuseFlags).toContain('source_stuffing_review')
  })
})

describe('buildMonthlyPayoutSettlement', () => {
  it('aggregates per-use accruals into monthly creator settlements', () => {
    const firstReceipt = buildAnswerReceipt({
      modelId: 'allenai/Olmo-3-7B-Instruct',
      works: [work],
      sources: [retrieved('chunk-a', 50), retrieved('chunk-b', 50)],
      context: {
        intendedUses: ['summarization', 'commercial'],
        queryText: 'What did the source say first?',
        outputTokenCount: 100,
        netQueryRevenueUsd: 10,
        generatedAt: '2026-05-02T12:00:00.000Z',
      },
    })
    const secondReceipt = buildAnswerReceipt({
      modelId: 'allenai/Olmo-3-7B-Instruct',
      works: [work],
      sources: [retrieved('chunk-c', 100)],
      context: {
        intendedUses: ['summarization', 'commercial'],
        queryText: 'What did the source say next?',
        outputTokenCount: 100,
        netQueryRevenueUsd: 10,
        generatedAt: '2026-05-03T12:00:00.000Z',
      },
    })

    const settlement = buildMonthlyPayoutSettlement({
      period: '2026-05',
      receipts: [firstReceipt, secondReceipt],
      minimumSettlementUsd: 10,
      generatedAt: '2026-06-01T08:30:00.000Z',
    })

    expect(settlement.totalAccruedUsd).toBe(12)
    expect(settlement.totalPayableUsd).toBe(12)
    expect(settlement.payouts).toHaveLength(1)
    expect(settlement.payouts[0]).toMatchObject({
      creatorId: 'creator-1',
      period: '2026-05',
      attributedChunkCount: 3,
      attributedTokenCount: 200,
      accruedPayoutUsd: 12,
      settlementStatus: 'pending',
    })
  })

  it('holds monthly settlements below the minimum threshold for review', () => {
    const receipt = buildAnswerReceipt({
      modelId: 'allenai/Olmo-3-7B-Instruct',
      works: [work],
      sources: [retrieved('chunk-a', 100)],
      context: {
        intendedUses: ['summarization'],
        queryText: 'Low-value query.',
        outputTokenCount: 100,
        netQueryRevenueUsd: 1,
      },
    })

    const settlement = buildMonthlyPayoutSettlement({
      period: '2026-05',
      receipts: [receipt],
      minimumSettlementUsd: 10,
    })

    expect(settlement.totalAccruedUsd).toBe(0.6)
    expect(settlement.totalPayableUsd).toBe(0)
    expect(settlement.heldCreatorIds).toEqual(['creator-1'])
    expect(settlement.payouts[0].settlementStatus).toBe('held_for_review')
  })
})

describe('buildCreatorRightsModelReview', () => {
  it('recommends promotion only when quality and license governance gates both pass', () => {
    const candidates: CreatorRightsModelCandidate[] = [
      {
        modelId: 'allenai/Olmo-3-7B-Instruct',
        license: 'apache-2.0',
        citationFaithfulness: 4.2,
        refusalDiscipline: 4,
        quoteAccuracy: 4.2,
        sourceCoverage: 4,
        latencyScore: 3.8,
        costScore: 3.8,
        licenseGovernanceScore: 4.8,
      },
      {
        modelId: 'Qwen/Qwen3-4B-Instruct-2507',
        license: 'apache-2.0',
        citationFaithfulness: 4.4,
        refusalDiscipline: 4.2,
        quoteAccuracy: 4.4,
        sourceCoverage: 4.3,
        latencyScore: 4.5,
        costScore: 4.6,
        licenseGovernanceScore: 4.8,
      },
    ]

    const review = buildCreatorRightsModelReview({
      incumbentModelId: 'allenai/Olmo-3-7B-Instruct',
      candidates,
      reviewedAt: '2026-05-01T12:00:00.000Z',
    })

    expect(review.recommendation).toBe('review_candidate_for_promotion')
    expect(review.recommendedModelId).toBe('Qwen/Qwen3-4B-Instruct-2507')
    expect(review.qualityGatePassed).toBe(true)
    expect(review.licenseGovernanceGatePassed).toBe(true)
  })

  it('keeps the incumbent when a better quality candidate has weaker governance fit', () => {
    const review = buildCreatorRightsModelReview({
      incumbentModelId: 'allenai/Olmo-3-7B-Instruct',
      candidates: [
        {
          modelId: 'allenai/Olmo-3-7B-Instruct',
          license: 'apache-2.0',
          citationFaithfulness: 4,
          refusalDiscipline: 4,
          quoteAccuracy: 4,
          sourceCoverage: 4,
          latencyScore: 4,
          costScore: 4,
          licenseGovernanceScore: 4.8,
        },
        {
          modelId: 'CohereLabs/c4ai-command-r7b-12-2024',
          license: 'cc-by-nc-4.0',
          citationFaithfulness: 4.6,
          refusalDiscipline: 4.4,
          quoteAccuracy: 4.5,
          sourceCoverage: 4.5,
          latencyScore: 4.2,
          costScore: 4,
          licenseGovernanceScore: 2.2,
        },
      ],
    })

    expect(review.recommendation).toBe('keep_incumbent')
    expect(review.recommendedModelId).toBe('allenai/Olmo-3-7B-Instruct')
    expect(review.licenseGovernanceGatePassed).toBe(false)
  })
})
