import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyEvidenceQaQueueAppends,
  buildEvidenceQaApprovalPlan,
  type EvidenceQaApprovalPacket,
} from './banned-books-evidence-qa'
import { buildBannedBooksSourceImportPlan, type BannedBookSourceImportFile } from './banned-books-source-importer'

const importFile: BannedBookSourceImportFile = {
  generatedAt: '2026-05-25T00:00:00.000Z',
  sourceKey: 'ala-most-challenged-2025',
  sourceUrl: 'https://www.ala.org/bbooks/frequentlychallengedbooks/top10',
  rows: [
    {
      externalId: 'ala-2025-the-57-bus-test',
      canonicalTitle: 'The 57 Bus Test',
      authors: ['Dashka Slater'],
      banStatus: 'challenged',
      evidenceType: 'challenge_list',
      evidenceNote: 'Confirmed source evidence.',
      jurisdictionContext: 'ALA 2025 source page.',
      affectedAudience: 'K-12 students',
      evidenceQuality: 'confirmed_source',
      rightsholderHint: 'author_or_publisher',
      editionAliases: [],
      sensitivityFlags: ['lgbtqia'],
    },
    {
      externalId: 'manual-missing-evidence-test',
      canonicalTitle: 'Manual Missing Evidence Test',
      authors: ['Example Author'],
      banStatus: 'unknown',
      evidenceType: 'challenge_context',
      evidenceNote: '',
      jurisdictionContext: 'Manual row.',
      affectedAudience: 'Unknown',
      evidenceQuality: 'needs_cross_check',
      rightsholderHint: 'unknown',
      editionAliases: [],
      sensitivityFlags: [],
    },
    {
      externalId: 'manual-full-text-rejected-test',
      canonicalTitle: 'Manual Full Text Rejected Test',
      authors: ['Example Author'],
      banStatus: 'challenged',
      evidenceType: 'challenge_context',
      evidenceNote: 'Forbidden field validation.',
      jurisdictionContext: 'Manual row.',
      affectedAudience: 'K-12 students',
      evidenceQuality: 'confirmed_source',
      rightsholderHint: 'author_or_publisher',
      editionAliases: [],
      sensitivityFlags: [],
      fullText: 'Reject this row.',
    },
  ],
}

const approvalPacket: EvidenceQaApprovalPacket = {
  generatedAt: '2026-05-25T00:00:00.000Z',
  reviewer: 'Timbuktu Scribe',
  approvalType: 'evidence_qa_queue_append',
  sourceImportPath: 'data/source-protocol/banned-books-source-import-sample.json',
  decisions: [
    {
      externalId: 'ala-2025-the-57-bus-test',
      decision: 'approved',
      approvedAt: '2026-05-25T00:00:00.000Z',
      notes: 'Confirmed metadata-only source evidence.',
    },
    {
      externalId: 'manual-missing-evidence-test',
      decision: 'needs_more_evidence',
      approvedAt: null,
      notes: 'Hold for evidence.',
    },
    {
      externalId: 'manual-full-text-rejected-test',
      decision: 'approved',
      approvedAt: '2026-05-25T00:00:00.000Z',
      notes: 'This approval must not override importer rejection.',
    },
  ],
}

describe('banned books Evidence QA approvals', () => {
  it('approves only ready-for-QA metadata rows for queue append', () => {
    const importPlan = buildBannedBooksSourceImportPlan(importFile)
    const approvalPlan = buildEvidenceQaApprovalPlan(importPlan, approvalPacket)

    expect(approvalPlan.summary).toMatchObject({
      importRows: 3,
      decisions: 3,
      approvedQueueAppends: 1,
      needsMoreEvidence: 1,
      rejected: 0,
      blocked: 2,
    })
    expect(approvalPlan.queueAppendDrafts).toEqual([
      expect.objectContaining({
        externalId: 'ala-2025-the-57-bus-test',
        canonicalTitle: 'The 57 Bus Test',
      }),
    ])
    expect(approvalPlan.rows.find((row) => row.externalId === 'manual-full-text-rejected-test')).toMatchObject({
      approved: false,
      blocked: true,
      reason: 'Approval cannot override importer status rejected_for_full_text.',
      queueAppendDraft: null,
    })
  })

  it('requires approvedAt metadata before appending an approved decision', () => {
    const importPlan = buildBannedBooksSourceImportPlan(importFile)
    const approvalPlan = buildEvidenceQaApprovalPlan(importPlan, {
      ...approvalPacket,
      decisions: [
        {
          externalId: 'ala-2025-the-57-bus-test',
          decision: 'approved',
          approvedAt: null,
          notes: 'Missing approvedAt.',
        },
      ],
    })

    expect(approvalPlan.summary.approvedQueueAppends).toBe(0)
    expect(approvalPlan.rows[0]).toMatchObject({
      approved: false,
      reason: 'Approved decisions must include approvedAt metadata.',
    })
  })

  it('applies approved queue appends only when dryRun is false', () => {
    const importPlan = buildBannedBooksSourceImportPlan(importFile)
    const dryRunPlan = buildEvidenceQaApprovalPlan(importPlan, approvalPacket)
    expect(() => applyEvidenceQaQueueAppends(dryRunPlan)).toThrow('Cannot apply an Evidence QA plan while dryRun is true.')

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banned-books-evidence-qa-'))
    const queuePath = path.join(tempDir, 'queue.json')
    fs.writeFileSync(queuePath, JSON.stringify({ generatedAt: '2026-05-24T00:00:00.000Z', candidates: [] }, null, 2))

    const applyPlan = buildEvidenceQaApprovalPlan(importPlan, approvalPacket, { dryRun: false })
    const result = applyEvidenceQaQueueAppends(applyPlan, queuePath)
    const updated = JSON.parse(fs.readFileSync(queuePath, 'utf8'))

    expect(result.appended).toBe(1)
    expect(updated.candidates).toEqual([
      expect.objectContaining({
        externalId: 'ala-2025-the-57-bus-test',
        canonicalTitle: 'The 57 Bus Test',
      }),
    ])
  })
})
