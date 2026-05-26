import fs from 'node:fs'
import path from 'node:path'
import sourceIngestionQueue from '@/data/source-protocol/banned-books-source-ingestion-queue.json'
import {
  buildBannedBooksSourceImportPlan,
  loadBannedBooksSourceImportFile,
  type BannedBookSourceImportPlan,
} from './banned-books-source-importer'
import type { BannedBookSourceIngestionCandidate } from './banned-books-corpus'

export type EvidenceQaDecision = 'approved' | 'needs_more_evidence' | 'rejected'

export type EvidenceQaApprovalDecision = {
  externalId: string
  decision: EvidenceQaDecision
  approvedAt: string | null
  notes: string
}

export type EvidenceQaApprovalPacket = {
  generatedAt: string
  reviewer: string
  approvalType: 'evidence_qa_queue_append'
  sourceImportPath: string
  decisions: EvidenceQaApprovalDecision[]
}

export type EvidenceQaApprovalPlan = {
  generatedAt: string
  reviewer: string
  sourceImportPath: string
  dryRun: boolean
  summary: {
    importRows: number
    decisions: number
    approvedQueueAppends: number
    needsMoreEvidence: number
    rejected: number
    blocked: number
    alreadyQueued: number
  }
  rows: Array<{
    externalId: string
    canonicalTitle: string
    importStatus: string
    decision: EvidenceQaDecision | 'missing_decision'
    approved: boolean
    blocked: boolean
    reason: string
    queueAppendDraft: BannedBookSourceIngestionCandidate | null
  }>
  queueAppendDrafts: BannedBookSourceIngestionCandidate[]
  blockedActions: string[]
}

export function loadEvidenceQaApprovalPacket(inputPath: string): EvidenceQaApprovalPacket {
  const resolvedPath = path.resolve(inputPath)
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as EvidenceQaApprovalPacket
  if (parsed.approvalType !== 'evidence_qa_queue_append' || !parsed.reviewer || !Array.isArray(parsed.decisions)) {
    throw new Error('Approval packet must include reviewer, approvalType=evidence_qa_queue_append, and decisions.')
  }
  return parsed
}

function approvalReason(row: BannedBookSourceImportPlan['rows'][number], decision: EvidenceQaApprovalDecision | undefined): string {
  if (!decision) return 'No Evidence QA decision was provided for this import row.'
  if (decision.decision !== 'approved') return decision.notes || `Evidence QA marked this row ${decision.decision}.`
  if (row.status !== 'ready_for_qa') return `Approval cannot override importer status ${row.status}.`
  if (!decision.approvedAt) return 'Approved decisions must include approvedAt metadata.'
  if (!row.queueAppendDraft) return 'Importer did not produce a queue append draft for this row.'
  return decision.notes || 'Approved for metadata-only queue append.'
}

export function buildEvidenceQaApprovalPlan(
  importPlan: BannedBookSourceImportPlan,
  approvalPacket: EvidenceQaApprovalPacket,
  options: { dryRun?: boolean } = {}
): EvidenceQaApprovalPlan {
  const decisionsByExternalId = new Map(approvalPacket.decisions.map((decision) => [decision.externalId, decision]))
  const queuedExternalIds = new Set(sourceIngestionQueue.candidates.map((candidate) => candidate.externalId))
  const rows = importPlan.rows.map((row) => {
    const decision = decisionsByExternalId.get(row.externalId)
    const alreadyQueued = row.queueAppendDraft ? queuedExternalIds.has(row.queueAppendDraft.externalId) : false
    const approved = Boolean(
      decision?.decision === 'approved' &&
      decision.approvedAt &&
      row.status === 'ready_for_qa' &&
      row.queueAppendDraft &&
      !alreadyQueued
    )
    const blocked = !approved
    const reason = alreadyQueued
      ? 'Candidate is already present in the source ingestion queue.'
      : approvalReason(row, decision)

    const rowDecision: EvidenceQaDecision | 'missing_decision' = decision?.decision ?? 'missing_decision'

    return {
      externalId: row.externalId,
      canonicalTitle: row.canonicalTitle,
      importStatus: row.status,
      decision: rowDecision,
      approved,
      blocked,
      reason,
      queueAppendDraft: approved ? row.queueAppendDraft : null,
    }
  })
  const queueAppendDrafts = rows
    .map((row) => row.queueAppendDraft)
    .filter((candidate): candidate is BannedBookSourceIngestionCandidate => Boolean(candidate))

  return {
    generatedAt: approvalPacket.generatedAt,
    reviewer: approvalPacket.reviewer,
    sourceImportPath: approvalPacket.sourceImportPath,
    dryRun: options.dryRun ?? true,
    summary: {
      importRows: importPlan.rows.length,
      decisions: approvalPacket.decisions.length,
      approvedQueueAppends: queueAppendDrafts.length,
      needsMoreEvidence: rows.filter((row) => row.decision === 'needs_more_evidence').length,
      rejected: rows.filter((row) => row.decision === 'rejected').length,
      blocked: rows.filter((row) => row.blocked).length,
      alreadyQueued: rows.filter((row) => row.reason.includes('already present')).length,
    },
    rows,
    queueAppendDrafts,
    blockedActions: [
      'Evidence QA approval appends metadata-only candidates to the source ingestion queue only.',
      'It does not write licensed works, license grants, source chunks, embeddings, retrieval flags, outreach sends, or payout records.',
      'Rows rejected by the importer cannot be overridden by an approval packet.',
    ],
  }
}

export function buildEvidenceQaApprovalPlanFromFiles(
  importPath: string,
  approvalPath: string,
  options: { dryRun?: boolean } = {}
): EvidenceQaApprovalPlan {
  const importFile = loadBannedBooksSourceImportFile(importPath)
  const approvalPacket = loadEvidenceQaApprovalPacket(approvalPath)
  const importPlan = buildBannedBooksSourceImportPlan(importFile)
  return buildEvidenceQaApprovalPlan(importPlan, approvalPacket, options)
}

export function applyEvidenceQaQueueAppends(
  plan: EvidenceQaApprovalPlan,
  queuePath = 'data/source-protocol/banned-books-source-ingestion-queue.json'
) {
  if (plan.dryRun) throw new Error('Cannot apply an Evidence QA plan while dryRun is true.')
  const resolvedPath = path.resolve(queuePath)
  const current = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as typeof sourceIngestionQueue
  const existingExternalIds = new Set(current.candidates.map((candidate) => candidate.externalId))
  const appendDrafts = plan.queueAppendDrafts.filter((candidate) => !existingExternalIds.has(candidate.externalId))
  const updated = {
    ...current,
    generatedAt: plan.generatedAt,
    candidates: [...current.candidates, ...appendDrafts],
  }
  fs.writeFileSync(resolvedPath, `${JSON.stringify(updated, null, 2)}\n`)
  return {
    queuePath: resolvedPath,
    appended: appendDrafts.length,
    skippedExisting: plan.queueAppendDrafts.length - appendDrafts.length,
  }
}
