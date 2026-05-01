import { createHash } from 'node:crypto'

export const CREATOR_RIGHTS_MODEL_CANDIDATES = [
  'allenai/Olmo-3-7B-Instruct',
  'Qwen/Qwen3-4B-Instruct-2507',
  'Qwen/Qwen2.5-7B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.2',
  'meta-llama/Llama-3.1-8B-Instruct',
  'CohereLabs/c4ai-command-r7b-12-2024',
] as const

export type CreatorCategory =
  | 'banned_author'
  | 'challenged_author'
  | 'black_history_museum_contributor'
  | 'archive_contributor'
  | 'oral_historian'
  | 'community_memory_steward'
  | 'publisher'
  | 'estate'

export type RightsHolderType =
  | 'author'
  | 'publisher'
  | 'estate'
  | 'translator'
  | 'illustrator'
  | 'museum'
  | 'archive'
  | 'community_steward'

export type LicenseUse =
  | 'citation'
  | 'summarization'
  | 'excerpt'
  | 'retrieval'
  | 'commercial'
  | 'educational'
  | 'fine_tuning'

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'disputed' | 'pending_review'

export type ProtocolDecision = 'allow' | 'restrict' | 'block'

export interface Creator {
  id: string
  displayName: string
  categories: CreatorCategory[]
  rightsHolderTypes: RightsHolderType[]
  verified: boolean
  protectedIdentity?: boolean
}

export interface LicensedWork {
  id: string
  creatorId: string
  title: string
  rightsHolderType: RightsHolderType
  banStatus?: 'banned' | 'challenged' | 'restricted' | 'not_banned' | 'unknown'
  chainOfTitleVerified: boolean
  communityConsentRequired?: boolean
  communityConsentVerified?: boolean
}

export interface LicenseGrant {
  id: string
  workId: string
  status: LicenseStatus
  allowedUses: LicenseUse[]
  blockedTopics?: string[]
  expiresAt?: string
  quoteLimitCharacters?: number
}

export interface SourceChunk {
  id: string
  workId: string
  creatorId: string
  textHash: string
  citationLabel: string
  location?: string
  sensitiveTopics?: string[]
}

export interface RetrievedSourceChunk {
  chunk: SourceChunk
  licenseGrant: LicenseGrant
  retrievalScore: number
  cited: boolean
  supportsAnswer: boolean
  supportedOutputTokens: number
  quotedCharacters?: number
}

export interface UsageContext {
  intendedUses: LicenseUse[]
  queryText: string
  outputTokenCount: number
  netQueryRevenueUsd: number
  generatedAt?: string
  duplicateQueryCount?: number
  queryingCreatorId?: string
}

export interface SourceUseDecision {
  chunkId: string
  decision: ProtocolDecision
  reasons: string[]
}

export interface AttributionWeight {
  chunkId: string
  creatorId: string
  workId: string
  citationLabel: string
  supportedOutputTokens: number
  weight: number
  payoutUsd: number
}

export interface AnswerReceipt {
  id: string
  queryHash: string
  modelId: string
  generatedAt: string
  outputTokenCount: number
  netQueryRevenueUsd: number
  creatorPoolUsd: number
  operationsPoolUsd: number
  reservePoolUsd: number
  retrievedChunkIds: string[]
  citedChunkIds: string[]
  attributedChunks: AttributionWeight[]
  decisions: SourceUseDecision[]
  abuseFlags: string[]
}

export interface CreatorRightsModelCandidate {
  modelId: string
  license: string
  citationFaithfulness: number
  refusalDiscipline: number
  quoteAccuracy: number
  sourceCoverage: number
  latencyScore: number
  costScore: number
  licenseGovernanceScore: number
  notes?: string[]
}

export interface CreatorRightsModelReview {
  reviewedAt: string
  incumbentModelId: string
  recommendedModelId: string
  recommendation: 'keep_incumbent' | 'review_candidate_for_promotion'
  qualityGatePassed: boolean
  licenseGovernanceGatePassed: boolean
  reviewPacket: string[]
  candidates: Array<CreatorRightsModelCandidate & { qualityScore: number; totalScore: number }>
}

const PAYOUT_SPLIT = {
  creators: 0.6,
  operations: 0.25,
  reserve: 0.15,
} as const

const REQUIRED_RETRIEVAL_USES: LicenseUse[] = ['retrieval', 'citation']

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function money(value: number): number {
  return Number(value.toFixed(6))
}

function isExpired(grant: LicenseGrant, at: Date): boolean {
  return Boolean(grant.expiresAt && new Date(grant.expiresAt).getTime() <= at.getTime())
}

function intersects(left: string[] = [], right: string[] = []): boolean {
  const lowered = new Set(left.map((value) => value.toLowerCase()))
  return right.some((value) => lowered.has(value.toLowerCase()))
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)]
}

export function evaluateSourceUse(
  source: RetrievedSourceChunk,
  context: UsageContext,
  work?: LicensedWork
): SourceUseDecision {
  const at = new Date(context.generatedAt ?? Date.now())
  const reasons: string[] = []
  const grant = source.licenseGrant
  const requiredUses = unique([...REQUIRED_RETRIEVAL_USES, ...context.intendedUses])

  if (grant.status !== 'active') reasons.push(`License grant is ${grant.status}.`)
  if (isExpired(grant, at)) reasons.push('License grant is expired.')
  if (grant.workId !== source.chunk.workId) reasons.push('License grant does not match source work.')
  if (requiredUses.some((use) => !grant.allowedUses.includes(use))) {
    reasons.push('License grant does not cover every intended use.')
  }
  if (intersects(grant.blockedTopics, source.chunk.sensitiveTopics)) {
    reasons.push('Source chunk matches a blocked topic.')
  }
  if (
    typeof grant.quoteLimitCharacters === 'number' &&
    typeof source.quotedCharacters === 'number' &&
    source.quotedCharacters > grant.quoteLimitCharacters
  ) {
    reasons.push('Quoted text exceeds the license quote limit.')
  }
  if (work && !work.chainOfTitleVerified) reasons.push('Chain of title has not been verified.')
  if (work?.communityConsentRequired && !work.communityConsentVerified) {
    reasons.push('Community consent is required and has not been verified.')
  }

  return {
    chunkId: source.chunk.id,
    decision: reasons.length === 0 ? 'allow' : 'block',
    reasons,
  }
}

export function buildAnswerReceipt(input: {
  modelId: string
  sources: RetrievedSourceChunk[]
  context: UsageContext
  works?: LicensedWork[]
}): AnswerReceipt {
  const worksById = new Map((input.works ?? []).map((work) => [work.id, work]))
  const decisions = input.sources.map((source) =>
    evaluateSourceUse(source, input.context, worksById.get(source.chunk.workId))
  )
  const allowedChunkIds = new Set(
    decisions.filter((decision) => decision.decision === 'allow').map((decision) => decision.chunkId)
  )
  const attributableSources = input.sources.filter(
    (source) => allowedChunkIds.has(source.chunk.id) && source.cited && source.supportsAnswer
  )
  const supportedTokenTotal = attributableSources.reduce(
    (total, source) => total + Math.max(0, source.supportedOutputTokens),
    0
  )
  const creatorPoolUsd = money(input.context.netQueryRevenueUsd * PAYOUT_SPLIT.creators)
  const attributedChunks = attributableSources.map((source) => {
    const supportedOutputTokens = Math.max(0, source.supportedOutputTokens)
    const weight = supportedTokenTotal > 0 ? supportedOutputTokens / supportedTokenTotal : 0

    return {
      chunkId: source.chunk.id,
      creatorId: source.chunk.creatorId,
      workId: source.chunk.workId,
      citationLabel: source.chunk.citationLabel,
      supportedOutputTokens,
      weight: Number(weight.toFixed(6)),
      payoutUsd: money(creatorPoolUsd * weight),
    }
  })

  return {
    id: hash(`${input.modelId}:${input.context.queryText}:${Date.now()}`).slice(0, 24),
    queryHash: hash(input.context.queryText),
    modelId: input.modelId,
    generatedAt: input.context.generatedAt ?? new Date().toISOString(),
    outputTokenCount: input.context.outputTokenCount,
    netQueryRevenueUsd: money(input.context.netQueryRevenueUsd),
    creatorPoolUsd,
    operationsPoolUsd: money(input.context.netQueryRevenueUsd * PAYOUT_SPLIT.operations),
    reservePoolUsd: money(input.context.netQueryRevenueUsd * PAYOUT_SPLIT.reserve),
    retrievedChunkIds: input.sources.map((source) => source.chunk.id),
    citedChunkIds: input.sources.filter((source) => source.cited).map((source) => source.chunk.id),
    attributedChunks,
    decisions,
    abuseFlags: detectUsageAbuse(input.sources, input.context),
  }
}

export function detectUsageAbuse(sources: RetrievedSourceChunk[], context: UsageContext): string[] {
  const flags: string[] = []
  const retrievedIds = sources.map((source) => source.chunk.id)
  const uniqueRetrievedIds = new Set(retrievedIds)
  const citedSources = sources.filter((source) => source.cited)

  if ((context.duplicateQueryCount ?? 0) >= 5) flags.push('duplicate_query_pattern')
  if (
    context.queryingCreatorId &&
    citedSources.some((source) => source.chunk.creatorId === context.queryingCreatorId)
  ) {
    flags.push('creator_self_query_payout_risk')
  }
  if (retrievedIds.length > 0 && uniqueRetrievedIds.size / retrievedIds.length < 0.75) {
    flags.push('duplicate_source_retrieval')
  }
  if (sources.length >= 8 && citedSources.length / sources.length > 0.85) {
    flags.push('source_stuffing_review')
  }

  return flags
}

function qualityScore(candidate: CreatorRightsModelCandidate): number {
  return Number(
    (
      candidate.citationFaithfulness * 0.28 +
      candidate.refusalDiscipline * 0.2 +
      candidate.quoteAccuracy * 0.18 +
      candidate.sourceCoverage * 0.14 +
      candidate.latencyScore * 0.1 +
      candidate.costScore * 0.1
    ).toFixed(3)
  )
}

export function buildCreatorRightsModelReview(input: {
  incumbentModelId: string
  candidates: CreatorRightsModelCandidate[]
  reviewedAt?: string
}): CreatorRightsModelReview {
  const scored = input.candidates
    .map((candidate) => {
      const candidateQualityScore = qualityScore(candidate)
      return {
        ...candidate,
        qualityScore: candidateQualityScore,
        totalScore: Number((candidateQualityScore * 0.7 + candidate.licenseGovernanceScore * 0.3).toFixed(3)),
      }
    })
    .sort((a, b) => b.totalScore - a.totalScore)

  const incumbent = scored.find((candidate) => candidate.modelId === input.incumbentModelId)
  const leader = [...scored].sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore
    return b.licenseGovernanceScore - a.licenseGovernanceScore
  })[0]
  const qualityGatePassed = Boolean(leader && incumbent && leader.qualityScore >= incumbent.qualityScore)
  const licenseGovernanceGatePassed = Boolean(
    leader && incumbent && leader.licenseGovernanceScore >= incumbent.licenseGovernanceScore
  )
  const shouldReviewPromotion =
    Boolean(leader) &&
    leader.modelId !== input.incumbentModelId &&
    qualityGatePassed &&
    licenseGovernanceGatePassed

  return {
    reviewedAt: input.reviewedAt ?? new Date().toISOString(),
    incumbentModelId: input.incumbentModelId,
    recommendedModelId: shouldReviewPromotion ? leader.modelId : input.incumbentModelId,
    recommendation: shouldReviewPromotion ? 'review_candidate_for_promotion' : 'keep_incumbent',
    qualityGatePassed,
    licenseGovernanceGatePassed,
    reviewPacket: [
      'Scan current primary model sources, including official model cards, release notes, and Hugging Face metadata.',
      'Run the fixed creator-rights golden set for citation faithfulness, refusal discipline, quote accuracy, and source coverage.',
      'Compare cost and latency against the incumbent with the same prompts and retrieval context.',
      'Promote only when quality and license/governance gates both pass; otherwise keep incumbent and record the gap.',
      'Write rollback steps and known regressions before any production or default-model change.',
    ],
    candidates: scored,
  }
}
