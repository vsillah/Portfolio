import { describe, expect, it } from 'vitest'
import {
  buildBannedBooksCorpusProjection,
  buildBannedBooksSourceIngestionProjection,
  buildSourceProtocolDraft,
  canCreateRetrievableChunks,
  dedupeBannedBookRecords,
  isOutreachReady,
  normalizeBannedBookKey,
  type BannedBookStagedRecord,
} from './banned-books-corpus'

function record(overrides: Partial<BannedBookStagedRecord> = {}): BannedBookStagedRecord {
  return {
    id: 'demo',
    canonicalTitle: 'Demo Book',
    authors: ['Demo Author'],
    editionAliases: [],
    isbnCandidates: [],
    banStatus: 'challenged',
    jurisdictionContext: 'U.S. school challenge evidence.',
    affectedAudience: 'K-12 students',
    evidence: [
      {
        sourceName: 'ALA Most Challenged Books',
        sourceUrl: 'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
        evidenceType: 'challenge_list',
        note: 'Demo evidence.',
      },
    ],
    rightsholderCandidate: {
      name: 'Demo Author or publisher',
      type: 'author',
      contactPath: 'Author/publisher permissions inquiry',
      confidence: 'medium',
    },
    outreachStatus: 'not_started',
    licenseStatus: 'not_requested',
    ingestionStatus: 'not_started',
    chainOfTitleStatus: 'unknown',
    sensitivityFlags: [],
    notes: 'Demo notes.',
    ...overrides,
  }
}

describe('banned books corpus projection', () => {
  it('builds a staged rights-ready projection with MECE swarm lanes', () => {
    const projection = buildBannedBooksCorpusProjection()

    expect(projection.summary.stagedRecords).toBe(17)
    expect(projection.summary.sourceSpineCount).toBeGreaterThanOrEqual(3)
    expect(projection.summary.outreachPacketCount).toBe(3)
    expect(projection.summary.outreachReadyRecords).toBeGreaterThan(0)
    expect(projection.summary.retrievableRecords).toBe(0)
    expect(projection.sourceIngestionQueue.summary).toMatchObject({
      sourceCount: 3,
      candidateCount: 5,
      existingRecordMatches: 1,
      stageableCandidates: 0,
      evidenceReviewRequired: 4,
      blockedFullTextActions: 5,
    })
    expect(projection.outreachPackets.map((packet) => packet.audience).sort()).toEqual(['author', 'estate', 'publisher'])
    expect(projection.outreachPackets.map((packet) => packet.key)).toEqual([
      'author_direct_rag_permission',
      'publisher_permissions_rag_license',
      'estate_permissions_rag_license',
    ])
    expect(projection.swarmAgents.map((agent) => agent.key)).toEqual([
      'banned-book-source-registry',
      'book-normalization',
      'rights-holder-mapping',
      'creator-outreach',
      'payout-modeling',
      'corpus-ingestion-indexing',
      'rights-governance-review',
      'evidence-qa-audit',
    ])
    expect(projection.safeguards.join(' ')).toContain('Do not ingest full text')
  })

  it('dedupes duplicate title and author records while preserving evidence', () => {
    const records = dedupeBannedBookRecords([
      record({ id: 'first', canonicalTitle: 'Demo Book', editionAliases: ['First edition'] }),
      record({
        id: 'second',
        canonicalTitle: 'Demo  Book!',
        editionAliases: ['Paperback'],
        evidence: [
          {
            sourceName: 'PEN America',
            sourceUrl: 'https://pen.org/pen-america-index-of-school-book-bans-2024-2025/',
            evidenceType: 'school_ban_index',
            note: 'Second source.',
          },
        ],
      }),
    ])

    expect(records).toHaveLength(1)
    expect(records[0].editionAliases).toEqual(['First edition', 'Paperback'])
    expect(records[0].evidence).toHaveLength(2)
  })

  it('blocks retrievable chunks until license and chain-of-title gates pass', () => {
    expect(canCreateRetrievableChunks(record())).toBe(false)
    expect(isOutreachReady(record())).toBe(true)

    const approved = record({
      licenseStatus: 'active',
      chainOfTitleStatus: 'verified',
      ingestionStatus: 'retrievable',
    })

    expect(canCreateRetrievableChunks(approved)).toBe(true)
    expect(buildSourceProtocolDraft(record()).chunkPolicy).toMatchObject({
      canChunk: false,
      canEmbed: false,
      canRetrieve: false,
    })
    expect(buildSourceProtocolDraft(approved).chunkPolicy).toMatchObject({
      canChunk: true,
      canEmbed: true,
      canRetrieve: true,
    })
  })

  it('normalizes title and author into stable canonical keys', () => {
    expect(normalizeBannedBookKey(record({ canonicalTitle: 'The Hate U Give', authors: ['Angie Thomas'] }))).toBe(
      'the-hate-u-give:angie-thomas'
    )
  })

  it('keeps source ingestion metadata-only and evidence-gated', () => {
    const projection = buildBannedBooksSourceIngestionProjection()

    expect(projection.mode).toBe('metadata_only_dry_run')
    expect(projection.candidates.find((candidate) => candidate.canonicalTitle === 'Gender Queer')).toMatchObject({
      status: 'existing_record',
      existingRecordId: 'gender-queer-maia-kobabe',
      stagedRecordDraft: null,
    })
    expect(projection.candidates.filter((candidate) => candidate.status === 'needs_evidence_review')).toHaveLength(4)
    expect(projection.blockedActions.join(' ')).toContain('Fetch or store copyrighted full text')
    expect(projection.candidates.every((candidate) => !candidate.stagedRecordDraft || !canCreateRetrievableChunks(candidate.stagedRecordDraft))).toBe(true)
  })
})
