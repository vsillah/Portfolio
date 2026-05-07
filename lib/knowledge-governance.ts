import crypto from 'crypto'

export const KNOWLEDGE_TARGET_INDEX = 'amadutown-knowledge-v1'
export const LEGACY_PINECONE_INDEX = 'publications'

export const KNOWLEDGE_NAMESPACES = [
  'public_chatbot',
  'voice_story',
  'sales_context',
  'internal_ops',
  'legacy_quarantine',
] as const

export type KnowledgeNamespace = (typeof KNOWLEDGE_NAMESPACES)[number]

export const KNOWLEDGE_PRIVACY_TIERS = [
  'public',
  'public_safe',
  'client_safe',
  'internal',
  'private',
] as const

export type KnowledgePrivacyTier = (typeof KNOWLEDGE_PRIVACY_TIERS)[number]

export type KnowledgeSourceType =
  | 'portfolio_doc'
  | 'public_safe_corpus'
  | 'publication'
  | 'case_study'
  | 'sales_proof'
  | 'ops_runbook'
  | 'legacy_pinecone'
  | 'excluded_private'

export interface KnowledgeSourceManifestEntry {
  sourceId: string
  title: string
  sourceType: KnowledgeSourceType
  namespace: KnowledgeNamespace
  privacyTier: KnowledgePrivacyTier
  canonicalPathOrUrl: string
  intendedConsumers: string[]
  approvedForRag: boolean
  notes?: string
}

export interface KnowledgeChunkMetadata {
  sourceId: string
  title: string
  sourceType: KnowledgeSourceType
  namespace: KnowledgeNamespace
  privacyTier: KnowledgePrivacyTier
  canonicalPathOrUrl: string
  contentFingerprint: string
  chunkIndex: number
  chunkCount: number
  ingestRunId: string
}

export type RagRoute =
  | 'public_chatbot'
  | 'public_chatbot_voice'
  | 'outreach_email'
  | 'admin_internal'
  | 'legacy_health'

export interface RagRoutePolicy {
  route: RagRoute
  preferredKnowledge: 'curated_first' | 'pinecone_first' | 'internal_only' | 'legacy_probe'
  allowedNamespaces: KnowledgeNamespace[]
  maxPrivacyTier: KnowledgePrivacyTier
  approvalRequiredForCutover: boolean
}

const privacyRank: Record<KnowledgePrivacyTier, number> = {
  public: 1,
  public_safe: 2,
  client_safe: 3,
  internal: 4,
  private: 5,
}

export const RAG_ROUTE_POLICIES: Record<RagRoute, RagRoutePolicy> = {
  public_chatbot: {
    route: 'public_chatbot',
    preferredKnowledge: 'curated_first',
    allowedNamespaces: ['public_chatbot'],
    maxPrivacyTier: 'public_safe',
    approvalRequiredForCutover: true,
  },
  public_chatbot_voice: {
    route: 'public_chatbot_voice',
    preferredKnowledge: 'curated_first',
    allowedNamespaces: ['public_chatbot', 'voice_story'],
    maxPrivacyTier: 'public_safe',
    approvalRequiredForCutover: true,
  },
  outreach_email: {
    route: 'outreach_email',
    preferredKnowledge: 'pinecone_first',
    allowedNamespaces: ['sales_context', 'voice_story'],
    maxPrivacyTier: 'client_safe',
    approvalRequiredForCutover: true,
  },
  admin_internal: {
    route: 'admin_internal',
    preferredKnowledge: 'internal_only',
    allowedNamespaces: ['internal_ops'],
    maxPrivacyTier: 'internal',
    approvalRequiredForCutover: true,
  },
  legacy_health: {
    route: 'legacy_health',
    preferredKnowledge: 'legacy_probe',
    allowedNamespaces: ['legacy_quarantine'],
    maxPrivacyTier: 'internal',
    approvalRequiredForCutover: false,
  },
}

export interface KnowledgeManifestValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  countsByNamespace: Record<KnowledgeNamespace, number>
  countsByPrivacyTier: Record<KnowledgePrivacyTier, number>
}

export function normalizeKnowledgeContent(content: string): string {
  return content.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function createContentFingerprint(content: string): string {
  return crypto.createHash('sha256').update(normalizeKnowledgeContent(content)).digest('hex')
}

export function createKnowledgeChunkId(input: {
  sourceId: string
  contentFingerprint: string
  chunkIndex: number
}): string {
  return `${input.sourceId}:${input.contentFingerprint}:${input.chunkIndex}`
}

export function buildKnowledgeChunkMetadata(input: {
  source: KnowledgeSourceManifestEntry
  chunkText: string
  chunkIndex: number
  chunkCount: number
  ingestRunId: string
}): KnowledgeChunkMetadata {
  return {
    sourceId: input.source.sourceId,
    title: input.source.title,
    sourceType: input.source.sourceType,
    namespace: input.source.namespace,
    privacyTier: input.source.privacyTier,
    canonicalPathOrUrl: input.source.canonicalPathOrUrl,
    contentFingerprint: createContentFingerprint(input.chunkText),
    chunkIndex: input.chunkIndex,
    chunkCount: input.chunkCount,
    ingestRunId: input.ingestRunId,
  }
}

export function routePolicyFor(route: RagRoute): RagRoutePolicy {
  return RAG_ROUTE_POLICIES[route]
}

export function isPrivacyTierAllowed(
  privacyTier: KnowledgePrivacyTier,
  maxPrivacyTier: KnowledgePrivacyTier,
): boolean {
  return privacyRank[privacyTier] <= privacyRank[maxPrivacyTier]
}

export function validateKnowledgeSourceManifest(
  entries: KnowledgeSourceManifestEntry[],
): KnowledgeManifestValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sourceIds = new Set<string>()
  const countsByNamespace = zeroCounts(KNOWLEDGE_NAMESPACES)
  const countsByPrivacyTier = zeroCounts(KNOWLEDGE_PRIVACY_TIERS)

  for (const entry of entries) {
    if (!entry.sourceId.trim()) errors.push('Manifest entry is missing sourceId.')
    if (!entry.title.trim()) errors.push(`${entry.sourceId || '(missing sourceId)'} is missing title.`)
    if (!entry.canonicalPathOrUrl.trim()) errors.push(`${entry.sourceId} is missing canonicalPathOrUrl.`)
    if (!entry.intendedConsumers.length) errors.push(`${entry.sourceId} is missing intendedConsumers.`)

    if (sourceIds.has(entry.sourceId)) {
      errors.push(`Duplicate knowledge sourceId: ${entry.sourceId}.`)
    }
    sourceIds.add(entry.sourceId)

    countsByNamespace[entry.namespace] += 1
    countsByPrivacyTier[entry.privacyTier] += 1

    if (entry.namespace === 'public_chatbot' && !isPrivacyTierAllowed(entry.privacyTier, 'public_safe')) {
      errors.push(`${entry.sourceId} cannot use ${entry.privacyTier} in public_chatbot.`)
    }

    if (entry.namespace === 'voice_story' && !isPrivacyTierAllowed(entry.privacyTier, 'public_safe')) {
      errors.push(`${entry.sourceId} cannot use ${entry.privacyTier} in voice_story.`)
    }

    if (entry.namespace === 'sales_context' && !isPrivacyTierAllowed(entry.privacyTier, 'client_safe')) {
      errors.push(`${entry.sourceId} cannot use ${entry.privacyTier} in sales_context.`)
    }

    if (entry.namespace === 'legacy_quarantine' && entry.approvedForRag) {
      warnings.push(`${entry.sourceId} is in legacy_quarantine but marked approvedForRag.`)
    }

    if (entry.sourceType === 'excluded_private' && entry.approvedForRag) {
      errors.push(`${entry.sourceId} is excluded_private and cannot be approved for RAG.`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    countsByNamespace,
    countsByPrivacyTier,
  }
}

export function buildKnowledgeGovernanceStatus(entries: KnowledgeSourceManifestEntry[]) {
  const validation = validateKnowledgeSourceManifest(entries)
  const approvedSources = entries.filter((entry) => entry.approvedForRag)
  const publicUnsafeApproved = approvedSources.filter(
    (entry) =>
      ['public_chatbot', 'voice_story'].includes(entry.namespace) &&
      !isPrivacyTierAllowed(entry.privacyTier, 'public_safe'),
  )

  return {
    targetIndex: KNOWLEDGE_TARGET_INDEX,
    legacyIndex: LEGACY_PINECONE_INDEX,
    mode: 'shadow_not_cutover',
    approvalGate: 'production_cutover_required',
    manifest: {
      sourceCount: entries.length,
      approvedSourceCount: approvedSources.length,
      excludedSourceCount: entries.filter((entry) => !entry.approvedForRag).length,
      countsByNamespace: validation.countsByNamespace,
      countsByPrivacyTier: validation.countsByPrivacyTier,
    },
    validation: {
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      publicUnsafeApprovedCount: publicUnsafeApproved.length,
    },
    routePolicies: Object.values(RAG_ROUTE_POLICIES),
  }
}

function zeroCounts<T extends readonly string[]>(keys: T): Record<T[number], number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>
}
