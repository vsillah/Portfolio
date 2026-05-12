import stagedCorpus from '@/data/source-protocol/banned-books-rights-ready-corpus.json'
import type {
  CreatorCategory,
  LicenseUse,
  LicensedWork,
  RightsHolderType,
} from './source-respecting-llm-protocol'

export type BannedBookSwarmLaneKey =
  | 'banned-book-source-registry'
  | 'book-normalization'
  | 'rights-holder-mapping'
  | 'creator-outreach'
  | 'payout-modeling'
  | 'corpus-ingestion-indexing'
  | 'rights-governance-review'
  | 'evidence-qa-audit'

export type BannedBookEvidenceType =
  | 'challenge_list'
  | 'school_ban_index'
  | 'challenge_context'
  | 'district_record'
  | 'publisher_statement'
  | 'author_statement'

export type BannedBookBanStatus = 'banned' | 'challenged' | 'restricted' | 'unknown'
export type BannedBookOutreachStatus = 'not_started' | 'ready' | 'drafted' | 'sent' | 'responded' | 'blocked'
export type BannedBookLicenseStatus = 'not_requested' | 'pending_review' | 'active' | 'revoked' | 'disputed'
export type BannedBookIngestionStatus = 'not_started' | 'blocked' | 'staged' | 'indexed_shadow' | 'retrievable'
export type BannedBookRightsConfidence = 'low' | 'medium' | 'high'

export type BannedBookSourceSpineEntry = {
  name: string
  url: string
  role: string
}

export type BannedBookEvidence = {
  sourceName: string
  sourceUrl: string
  evidenceType: BannedBookEvidenceType
  note: string
}

export type BannedBookRightsholderCandidate = {
  name: string
  type: RightsHolderType
  contactPath: string
  confidence: BannedBookRightsConfidence
}

export type BannedBookStagedRecord = {
  id: string
  canonicalTitle: string
  authors: string[]
  editionAliases: string[]
  isbnCandidates: string[]
  banStatus: BannedBookBanStatus
  jurisdictionContext: string
  affectedAudience: string
  evidence: BannedBookEvidence[]
  rightsholderCandidate: BannedBookRightsholderCandidate
  outreachStatus: BannedBookOutreachStatus
  licenseStatus: BannedBookLicenseStatus
  ingestionStatus: BannedBookIngestionStatus
  chainOfTitleStatus: 'unknown' | 'pending' | 'verified'
  sensitivityFlags: string[]
  notes: string
}

export type BannedBookSwarmAgent = {
  key: BannedBookSwarmLaneKey
  name: string
  lane: string
  responsibility: string
  output: string
  boundary: string
  approvalGate: string
}

export type BannedBooksCorpusProjection = {
  generatedAt: string
  scope: string
  licenseModel: string
  sourceSpine: BannedBookSourceSpineEntry[]
  swarmAgents: BannedBookSwarmAgent[]
  summary: {
    stagedRecords: number
    sourceSpineCount: number
    rightsReadyRecords: number
    outreachReadyRecords: number
    activeLicenseRecords: number
    retrievableRecords: number
    blockedRecords: number
  }
  records: Array<BannedBookStagedRecord & {
    normalizedKey: string
    rightsReady: boolean
    outreachReady: boolean
    retrievableEligible: boolean
    sourceProtocolDraft: {
      creator: {
        displayName: string
        categories: CreatorCategory[]
        rightsHolderTypes: RightsHolderType[]
        verificationStatus: 'pending' | 'verified' | 'needs_review'
      }
      work: Pick<
        LicensedWork,
        'id' | 'creatorId' | 'title' | 'rightsHolderType' | 'banStatus' | 'chainOfTitleVerified'
      > & {
        reviewStatus: 'staged' | 'approved' | 'blocked' | 'disputed' | 'revoked'
        sourceType: 'manual'
        sensitivityFlags: string[]
      }
      licenseGrant: {
        status: BannedBookLicenseStatus
        allowedUses: LicenseUse[]
        quoteLimitCharacters: number
        fineTuningAllowed: false
      }
      chunkPolicy: {
        canChunk: boolean
        canEmbed: boolean
        canRetrieve: boolean
        reason: string
      }
    }
    nextAction: string
  }>
  safeguards: string[]
}

export const BANNED_BOOKS_SWARM_AGENTS: BannedBookSwarmAgent[] = [
  {
    key: 'banned-book-source-registry',
    name: 'Amina, Source Registry Lead',
    lane: 'Discovery evidence',
    responsibility: 'Collect title-level ban and challenge evidence from PEN, ALA, EveryLibrary, district records, and public statements.',
    output: 'Source evidence only.',
    boundary: 'No rights-holder guesses or outreach decisions.',
    approvalGate: 'Source URL and evidence type must be present before a title enters the staged registry.',
  },
  {
    key: 'book-normalization',
    name: "Nana Asma'u, Bibliographic Normalizer",
    lane: 'Canonical works',
    responsibility: 'Dedupe titles, editions, ISBNs, authors, publishers, years, formats, and series relationships.',
    output: 'Canonical work records plus edition aliases.',
    boundary: 'No contact enrichment or permission claims.',
    approvalGate: 'Conflicting editions remain staged until evidence QA resolves them.',
  },
  {
    key: 'rights-holder-mapping',
    name: 'Yaa Asantewaa, Rights Holder Mapper',
    lane: 'Rights path',
    responsibility: 'Identify likely author, publisher, estate, agent, illustrator, translator, or co-rightsholder.',
    output: 'Contact path and confidence level.',
    boundary: 'No outreach is sent from this lane.',
    approvalGate: 'Low-confidence or estate/publisher-controlled paths require governance review.',
  },
  {
    key: 'creator-outreach',
    name: 'Nzinga, Outreach Strategist',
    lane: 'Permission packets',
    responsibility: 'Generate RAG-only permission packets, outreach sequences, value proposition, and follow-up cadence.',
    output: 'Draft outreach and CRM stages.',
    boundary: 'No public creator communications are sent without approval.',
    approvalGate: 'Human approval before first contact or follow-up.',
  },
  {
    key: 'payout-modeling',
    name: 'Mansa Musa, Creator Economics Lead',
    lane: 'Attribution economics',
    responsibility: 'Map supported output tokens to answer receipts and monthly creator payout simulation.',
    output: 'Payout simulation assumptions and statement requirements.',
    boundary: 'No real money movement.',
    approvalGate: 'Real payouts require approved settlement status and payment operations review.',
  },
  {
    key: 'corpus-ingestion-indexing',
    name: 'Imhotep, Ingestion Architect',
    lane: 'Rights-cleared ingestion',
    responsibility: 'Design file intake, OCR/text extraction, chunking, citation labels, embeddings, retrievability flags, and revocation handling.',
    output: 'Ingestion plan and chunk metadata requirements.',
    boundary: 'No full text, OCR, embedding, or retrievability before active license grants.',
    approvalGate: 'Active license, verified chain of title, and sensitivity review must pass.',
  },
  {
    key: 'rights-governance-review',
    name: 'Shaka, Governance Captain',
    lane: 'Rights gates',
    responsibility: 'Review chain of title, blocked uses, community consent, sensitive topics, revocations, disputes, and approval gates.',
    output: 'Approve, hold, block, or dispute decisions.',
    boundary: 'Does not bypass Source Protocol license logic.',
    approvalGate: 'Required before any staged work becomes retrievable.',
  },
  {
    key: 'evidence-qa-audit',
    name: 'Timbuktu Scribe, QA Archivist',
    lane: 'Audit trail',
    responsibility: 'Cross-check records, flag conflicts, preserve provenance, and produce audit-ready reports.',
    output: 'Evidence QA notes and recurring report inputs.',
    boundary: 'No mutation of rights status without governance review.',
    approvalGate: 'All records need source evidence before outreach or ingestion.',
  },
]

const RAG_ONLY_ALLOWED_USES: LicenseUse[] = ['retrieval', 'citation', 'summarization', 'educational', 'commercial']

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeBannedBookKey(record: Pick<BannedBookStagedRecord, 'canonicalTitle' | 'authors'>): string {
  return `${normalizeValue(record.canonicalTitle)}:${record.authors.map(normalizeValue).sort().join('+')}`
}

export function dedupeBannedBookRecords(records: BannedBookStagedRecord[]): BannedBookStagedRecord[] {
  const byKey = new Map<string, BannedBookStagedRecord>()
  for (const record of records) {
    const key = normalizeBannedBookKey(record)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        ...record,
        editionAliases: [...new Set(record.editionAliases)],
        isbnCandidates: [...new Set(record.isbnCandidates)],
        evidence: uniqueEvidence(record.evidence),
        sensitivityFlags: [...new Set(record.sensitivityFlags)],
      })
      continue
    }

    byKey.set(key, {
      ...existing,
      editionAliases: [...new Set([...existing.editionAliases, ...record.editionAliases])],
      isbnCandidates: [...new Set([...existing.isbnCandidates, ...record.isbnCandidates])],
      evidence: uniqueEvidence([...existing.evidence, ...record.evidence]),
      sensitivityFlags: [...new Set([...existing.sensitivityFlags, ...record.sensitivityFlags])],
      notes: [existing.notes, record.notes].filter(Boolean).join(' | '),
    })
  }
  return [...byKey.values()]
}

function uniqueEvidence(evidence: BannedBookEvidence[]): BannedBookEvidence[] {
  const seen = new Set<string>()
  return evidence.filter((entry) => {
    const key = `${entry.sourceName}:${entry.sourceUrl}:${entry.note}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function isRightsReady(record: BannedBookStagedRecord): boolean {
  return (
    record.evidence.length > 0 &&
    record.rightsholderCandidate.confidence !== 'low' &&
    record.chainOfTitleStatus !== 'verified' &&
    record.licenseStatus === 'not_requested'
  )
}

export function isOutreachReady(record: BannedBookStagedRecord): boolean {
  return isRightsReady(record) && record.outreachStatus === 'not_started'
}

export function canCreateRetrievableChunks(record: BannedBookStagedRecord): boolean {
  return (
    record.licenseStatus === 'active' &&
    record.chainOfTitleStatus === 'verified' &&
    record.ingestionStatus === 'retrievable'
  )
}

export function buildSourceProtocolDraft(record: BannedBookStagedRecord) {
  const chainOfTitleVerified = record.chainOfTitleStatus === 'verified'
  const retrievableEligible = canCreateRetrievableChunks(record)
  return {
    creator: {
      displayName: record.rightsholderCandidate.name,
      categories: ['banned_author', 'challenged_author'] as CreatorCategory[],
      rightsHolderTypes: [record.rightsholderCandidate.type],
      verificationStatus: chainOfTitleVerified ? 'verified' as const : 'pending' as const,
    },
    work: {
      id: `staged:${record.id}`,
      creatorId: `staged-creator:${record.id}`,
      title: record.canonicalTitle,
      rightsHolderType: record.rightsholderCandidate.type,
      banStatus: record.banStatus,
      chainOfTitleVerified,
      reviewStatus: retrievableEligible ? 'approved' as const : 'staged' as const,
      sourceType: 'manual' as const,
      sensitivityFlags: record.sensitivityFlags,
    },
    licenseGrant: {
      status: record.licenseStatus,
      allowedUses: RAG_ONLY_ALLOWED_USES,
      quoteLimitCharacters: 280,
      fineTuningAllowed: false as const,
    },
    chunkPolicy: {
      canChunk: retrievableEligible,
      canEmbed: retrievableEligible,
      canRetrieve: retrievableEligible,
      reason: retrievableEligible
        ? 'Active RAG-only license, verified chain of title, and retrievable ingestion status are present.'
        : 'Hold full text, OCR, embeddings, and retrieval until active license grant and chain-of-title review are complete.',
    },
  }
}

function nextActionFor(record: BannedBookStagedRecord): string {
  if (canCreateRetrievableChunks(record)) return 'Eligible for rights-cleared chunking and retrieval QA.'
  if (record.licenseStatus === 'active' && record.chainOfTitleStatus !== 'verified') return 'Verify chain of title before ingestion.'
  if (record.outreachStatus === 'not_started' && isOutreachReady(record)) return 'Draft RAG-only permission packet.'
  if (record.rightsholderCandidate.confidence === 'low') return 'Improve rightsholder evidence before outreach.'
  return 'Hold in staged research inventory.'
}

export function buildBannedBooksCorpusProjection(): BannedBooksCorpusProjection {
  const records = dedupeBannedBookRecords(stagedCorpus.records as BannedBookStagedRecord[])
  const projectedRecords = records.map((record) => ({
    ...record,
    normalizedKey: normalizeBannedBookKey(record),
    rightsReady: isRightsReady(record),
    outreachReady: isOutreachReady(record),
    retrievableEligible: canCreateRetrievableChunks(record),
    sourceProtocolDraft: buildSourceProtocolDraft(record),
    nextAction: nextActionFor(record),
  }))

  return {
    generatedAt: stagedCorpus.generatedAt,
    scope: stagedCorpus.scope,
    licenseModel: stagedCorpus.licenseModel,
    sourceSpine: stagedCorpus.sourceSpine,
    swarmAgents: BANNED_BOOKS_SWARM_AGENTS,
    summary: {
      stagedRecords: projectedRecords.length,
      sourceSpineCount: stagedCorpus.sourceSpine.length,
      rightsReadyRecords: projectedRecords.filter((record) => record.rightsReady).length,
      outreachReadyRecords: projectedRecords.filter((record) => record.outreachReady).length,
      activeLicenseRecords: projectedRecords.filter((record) => record.licenseStatus === 'active').length,
      retrievableRecords: projectedRecords.filter((record) => record.retrievableEligible).length,
      blockedRecords: projectedRecords.filter((record) =>
        record.outreachStatus === 'blocked' || record.ingestionStatus === 'blocked' || record.licenseStatus === 'disputed'
      ).length,
    },
    records: projectedRecords,
    safeguards: [
      'Do not ingest full text, OCR, embed, or mark chunks retrievable before an active RAG-only license grant exists.',
      'Do not infer rights ownership from title metadata; rights-holder confidence must be recorded separately from source evidence.',
      'Fine-tuning is excluded from v1 permission packets unless a separate legal review approves it later.',
      'Answer receipts and monthly payout rows remain simulation-first until payout operations are approved.',
      'Public outreach, production ingestion, and creator payout activation remain approval-gated.',
    ],
  }
}

export function formatBannedBooksCorpusReport(projection = buildBannedBooksCorpusProjection()): string {
  return [
    '# Banned Books Rights-Ready Corpus',
    '',
    `Generated: ${projection.generatedAt}`,
    `Scope: ${projection.scope}`,
    `License model: ${projection.licenseModel}`,
    '',
    '## Summary',
    '',
    `- Staged records: ${projection.summary.stagedRecords}`,
    `- Rights-ready records: ${projection.summary.rightsReadyRecords}`,
    `- Outreach-ready records: ${projection.summary.outreachReadyRecords}`,
    `- Active license records: ${projection.summary.activeLicenseRecords}`,
    `- Retrievable records: ${projection.summary.retrievableRecords}`,
    '',
    '## Swarm Lanes',
    '',
    ...projection.swarmAgents.map((agent) => `- ${agent.name} (${agent.key}): ${agent.output}`),
    '',
    '## Staged Works',
    '',
    ...projection.records.map((record) => `- ${record.canonicalTitle} by ${record.authors.join(', ')}: ${record.nextAction}`),
    '',
    '## Safeguards',
    '',
    ...projection.safeguards.map((safeguard) => `- ${safeguard}`),
  ].join('\n')
}
