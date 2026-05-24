import { describe, expect, it } from 'vitest'
import {
  buildBannedBooksSourceImportPlan,
  type BannedBookSourceImportFile,
} from './banned-books-source-importer'

const importFile: BannedBookSourceImportFile = {
  generatedAt: '2026-05-24T00:00:00.000Z',
  sourceKey: 'ala-most-challenged-2025',
  sourceUrl: 'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
  rows: [
    {
      externalId: 'ala-2025-gender-queer',
      canonicalTitle: 'Gender Queer',
      authors: ['Maia Kobabe'],
      banStatus: 'challenged',
      evidenceType: 'challenge_list',
      evidenceNote: 'Existing staged record.',
      jurisdictionContext: 'ALA 2025 source page.',
      affectedAudience: 'K-12 students',
      evidenceQuality: 'confirmed_source',
      rightsholderHint: 'author_or_publisher',
      editionAliases: [],
      sensitivityFlags: ['lgbtqia'],
    },
    {
      externalId: 'ala-2025-new-ready-title',
      canonicalTitle: 'New Ready Title',
      authors: ['Example Author'],
      banStatus: 'challenged',
      evidenceType: 'challenge_list',
      evidenceNote: 'Confirmed source evidence.',
      jurisdictionContext: 'ALA 2025 source page.',
      affectedAudience: 'K-12 students',
      evidenceQuality: 'confirmed_source',
      rightsholderHint: 'author_or_publisher',
      editionAliases: [],
      sensitivityFlags: [],
    },
    {
      externalId: 'manual-missing-evidence',
      canonicalTitle: 'Missing Evidence',
      authors: ['Example Author'],
      banStatus: 'unknown',
      evidenceType: 'challenge_context',
      evidenceNote: '',
      jurisdictionContext: 'Manual import row.',
      affectedAudience: 'Unknown',
      evidenceQuality: 'needs_cross_check',
      rightsholderHint: 'unknown',
      editionAliases: [],
      sensitivityFlags: [],
    },
    {
      externalId: 'manual-full-text-rejected',
      canonicalTitle: 'Full Text Rejected',
      authors: ['Example Author'],
      banStatus: 'challenged',
      evidenceType: 'challenge_context',
      evidenceNote: 'Forbidden field validation.',
      jurisdictionContext: 'Manual import row.',
      affectedAudience: 'K-12 students',
      evidenceQuality: 'confirmed_source',
      rightsholderHint: 'author_or_publisher',
      editionAliases: [],
      sensitivityFlags: [],
      fullText: 'Reject this row.',
    },
  ],
}

describe('banned books source importer', () => {
  it('builds a dry-run queue import plan with approval-gated append drafts', () => {
    const plan = buildBannedBooksSourceImportPlan(importFile)

    expect(plan.dryRun).toBe(true)
    expect(plan.summary).toMatchObject({
      rows: 4,
      existingRecords: 1,
      duplicateQueueRows: 0,
      readyForQa: 1,
      needsEvidenceReview: 1,
      rejectedRows: 1,
      queueAppendDrafts: 1,
    })
    expect(plan.rows.find((row) => row.canonicalTitle === 'New Ready Title')).toMatchObject({
      status: 'ready_for_qa',
      approvalRoute: 'evidence_qa_audit',
      queueAppendDraft: expect.objectContaining({
        canonicalTitle: 'New Ready Title',
        sourceKey: 'ala-most-challenged-2025',
      }),
    })
  })

  it('rejects unknown source keys before queue append drafting', () => {
    const plan = buildBannedBooksSourceImportPlan({
      ...importFile,
      sourceKey: 'unknown-source',
      rows: [importFile.rows[1]],
    })

    expect(plan.summary.rejectedRows).toBe(1)
    expect(plan.summary.queueAppendDrafts).toBe(0)
    expect(plan.rows[0]).toMatchObject({
      status: 'rejected_invalid_source',
      approvalRoute: 'blocked',
    })
  })

  it('rejects rows containing full text or OCR-like fields', () => {
    const plan = buildBannedBooksSourceImportPlan(importFile)
    const rejected = plan.rows.find((row) => row.externalId === 'manual-full-text-rejected')

    expect(rejected).toMatchObject({
      status: 'rejected_for_full_text',
      approvalRoute: 'blocked',
      queueAppendDraft: null,
    })
    expect(plan.blockedActions.join(' ')).toContain('No full text')
  })
})
