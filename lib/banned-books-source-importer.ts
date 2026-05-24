import fs from 'node:fs'
import path from 'node:path'
import sourceIngestionQueue from '@/data/source-protocol/banned-books-source-ingestion-queue.json'
import {
  buildBannedBooksSourceIngestionProjection,
  buildBannedBooksCorpusProjection,
  normalizeBannedBookKey,
  type BannedBookBanStatus,
  type BannedBookEvidenceQuality,
  type BannedBookEvidenceType,
  type BannedBookSourceIngestionCandidate,
} from './banned-books-corpus'

const FORBIDDEN_TEXT_FIELDS = ['fullText', 'text', 'content', 'body', 'excerptText', 'ocrText']

export type BannedBookSourceImportRow = {
  externalId: string
  canonicalTitle: string
  authors: string[]
  banStatus: BannedBookBanStatus
  sourceUrl?: string
  evidenceType: BannedBookEvidenceType
  evidenceNote: string
  jurisdictionContext: string
  affectedAudience: string
  evidenceQuality: BannedBookEvidenceQuality
  rightsholderHint: BannedBookSourceIngestionCandidate['rightsholderHint']
  editionAliases: string[]
  sensitivityFlags: string[]
  [key: string]: unknown
}

export type BannedBookSourceImportFile = {
  generatedAt: string
  sourceKey: string
  sourceName?: string
  sourceUrl: string
  rows: BannedBookSourceImportRow[]
}

export type BannedBookSourceImportStatus =
  | 'existing_record'
  | 'duplicate_in_queue'
  | 'ready_for_qa'
  | 'needs_evidence_review'
  | 'rejected_for_full_text'
  | 'rejected_invalid_source'

export type BannedBookSourceImportPlan = {
  generatedAt: string
  sourceKey: string
  sourceUrl: string
  dryRun: true
  summary: {
    rows: number
    existingRecords: number
    duplicateQueueRows: number
    readyForQa: number
    needsEvidenceReview: number
    rejectedRows: number
    queueAppendDrafts: number
  }
  rows: Array<{
    externalId: string
    canonicalTitle: string
    authors: string[]
    normalizedKey: string
    status: BannedBookSourceImportStatus
    reason: string
    approvalRoute: 'evidence_qa_audit' | 'blocked'
    queueAppendDraft: BannedBookSourceIngestionCandidate | null
  }>
  blockedActions: string[]
}

export function loadBannedBooksSourceImportFile(inputPath: string): BannedBookSourceImportFile {
  const resolvedPath = path.resolve(inputPath)
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as BannedBookSourceImportFile
  if (!parsed.sourceKey || !parsed.sourceUrl || !Array.isArray(parsed.rows)) {
    throw new Error('Import file must include sourceKey, sourceUrl, and rows.')
  }
  return parsed
}

function rowHasForbiddenText(row: BannedBookSourceImportRow): boolean {
  return FORBIDDEN_TEXT_FIELDS.some((field) => typeof row[field] === 'string' && String(row[field]).trim().length > 0)
}

function rowHasMinimumEvidence(row: BannedBookSourceImportRow, sourceUrl: string): boolean {
  return Boolean(
    row.externalId &&
    row.canonicalTitle &&
    row.authors?.length > 0 &&
    (row.sourceUrl || sourceUrl) &&
    row.evidenceType &&
    row.evidenceNote?.trim()
  )
}

function toQueueCandidate(
  sourceKey: string,
  sourceUrl: string,
  row: BannedBookSourceImportRow
): BannedBookSourceIngestionCandidate {
  return {
    sourceKey,
    externalId: row.externalId,
    canonicalTitle: row.canonicalTitle,
    authors: row.authors,
    banStatus: row.banStatus,
    sourceUrl: row.sourceUrl ?? sourceUrl,
    evidenceType: row.evidenceType,
    evidenceNote: row.evidenceNote,
    jurisdictionContext: row.jurisdictionContext,
    affectedAudience: row.affectedAudience,
    evidenceQuality: row.evidenceQuality,
    rightsholderHint: row.rightsholderHint,
    editionAliases: row.editionAliases ?? [],
    sensitivityFlags: row.sensitivityFlags ?? [],
  }
}

export function buildBannedBooksSourceImportPlan(
  importFile: BannedBookSourceImportFile
): BannedBookSourceImportPlan {
  const knownSourceKeys = new Set(sourceIngestionQueue.sources.map((source) => source.key))
  const existingCorpus = buildBannedBooksCorpusProjection()
  const existingRecordKeys = new Set(existingCorpus.records.map((record) => record.normalizedKey))
  const existingQueue = buildBannedBooksSourceIngestionProjection()
  const queuedExternalIds = new Set(existingQueue.candidates.map((candidate) => candidate.externalId))
  const queuedKeys = new Set(existingQueue.candidates.map((candidate) => candidate.normalizedKey))

  const rows = importFile.rows.map((row) => {
    const normalizedKey = normalizeBannedBookKey(row)
    const base = {
      externalId: row.externalId,
      canonicalTitle: row.canonicalTitle,
      authors: row.authors ?? [],
      normalizedKey,
      approvalRoute: 'evidence_qa_audit' as const,
    }

    if (!knownSourceKeys.has(importFile.sourceKey)) {
      return {
        ...base,
        status: 'rejected_invalid_source' as const,
        reason: 'Source key is not registered in the ingestion queue.',
        approvalRoute: 'blocked' as const,
        queueAppendDraft: null,
      }
    }

    if (rowHasForbiddenText(row)) {
      return {
        ...base,
        status: 'rejected_for_full_text' as const,
        reason: 'Importer rejected a row containing forbidden full-text-like fields.',
        approvalRoute: 'blocked' as const,
        queueAppendDraft: null,
      }
    }

    if (existingRecordKeys.has(normalizedKey)) {
      return {
        ...base,
        status: 'existing_record' as const,
        reason: 'Candidate already exists in the staged rights-ready corpus.',
        queueAppendDraft: null,
      }
    }

    if (queuedExternalIds.has(row.externalId) || queuedKeys.has(normalizedKey)) {
      return {
        ...base,
        status: 'duplicate_in_queue' as const,
        reason: 'Candidate already exists in the source ingestion queue.',
        queueAppendDraft: null,
      }
    }

    if (!rowHasMinimumEvidence(row, importFile.sourceUrl) || row.evidenceQuality !== 'confirmed_source') {
      return {
        ...base,
        status: 'needs_evidence_review' as const,
        reason: 'Candidate is missing source evidence or needs cross-source/district-row confirmation.',
        queueAppendDraft: null,
      }
    }

    return {
      ...base,
      status: 'ready_for_qa' as const,
      reason: 'Candidate can be queued as metadata-only after Evidence QA approval.',
      queueAppendDraft: toQueueCandidate(importFile.sourceKey, importFile.sourceUrl, row),
    }
  })

  return {
    generatedAt: importFile.generatedAt,
    sourceKey: importFile.sourceKey,
    sourceUrl: importFile.sourceUrl,
    dryRun: true,
    summary: {
      rows: rows.length,
      existingRecords: rows.filter((row) => row.status === 'existing_record').length,
      duplicateQueueRows: rows.filter((row) => row.status === 'duplicate_in_queue').length,
      readyForQa: rows.filter((row) => row.status === 'ready_for_qa').length,
      needsEvidenceReview: rows.filter((row) => row.status === 'needs_evidence_review').length,
      rejectedRows: rows.filter((row) => row.status.startsWith('rejected_')).length,
      queueAppendDrafts: rows.filter((row) => row.queueAppendDraft).length,
    },
    rows,
    blockedActions: [
      'No writes are performed by this importer.',
      'No full text, OCR, embeddings, source chunks, retrieval flags, outreach sends, license grants, or payout records are created.',
      'Queue append drafts require Evidence QA approval before they are copied into the staged ingestion queue.',
    ],
  }
}
