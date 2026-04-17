/**
 * Regenerate the audit_summary Gamma deck for an existing diagnostic audit,
 * using the diagnostic_audits data already on file.
 *
 * Flow:
 *   1. Mark any existing active (generating|completed) audit_summary rows as
 *      'superseded' so the partial unique index on (diagnostic_audit_id)
 *      WHERE report_type='audit_summary' AND status IN ('generating','completed')
 *      releases the slot.
 *   2. Build a fresh Gamma input via buildGammaReportInput.
 *   3. Insert a new gamma_reports row and run generation.
 *
 * This is fire-and-forget from the caller's perspective: the new row id is
 * returned synchronously so the UI can link to /admin/reports/gamma?auditId=...
 * while generation runs in the background.
 */

import { supabaseAdmin } from './supabase'
import { buildGammaReportInput } from './gamma-report-builder'
import { insertGammaReportRow, runGammaGeneration } from './gamma-generation'

const LOG_PREFIX = '[rerun-audit-summary]'

export type RerunAuditSummaryResult =
  | {
      ok: true
      auditId: string
      gammaReportId: string
      supersededCount: number
    }
  | {
      ok: false
      error: string
      status: number
      auditId?: string
    }

export async function rerunAuditSummaryGamma(
  auditId: string | number,
  createdBy: string | null = null
): Promise<RerunAuditSummaryResult> {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Server configuration error', status: 500 }
  }

  const auditIdStr = String(auditId)

  const { data: audit, error: auditErr } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id, status, contact_submission_id, contact_email, business_name')
    .eq('id', auditIdStr)
    .maybeSingle()

  if (auditErr) {
    console.error(`${LOG_PREFIX} audit lookup failed`, auditErr)
    return { ok: false, error: 'Failed to load audit', status: 500 }
  }
  if (!audit) {
    return { ok: false, error: 'Audit not found', status: 404 }
  }

  if (!audit.contact_submission_id) {
    return {
      ok: false,
      error: 'Audit has no linked contact; cannot regenerate report',
      status: 400,
      auditId: auditIdStr,
    }
  }

  const { data: superseded, error: supersedeErr } = await supabaseAdmin
    .from('gamma_reports')
    .update({ status: 'superseded' })
    .eq('diagnostic_audit_id', auditIdStr)
    .eq('report_type', 'audit_summary')
    .in('status', ['generating', 'completed', 'pending'])
    .select('id')

  if (supersedeErr) {
    console.error(`${LOG_PREFIX} failed to supersede existing rows`, supersedeErr)
    return { ok: false, error: 'Failed to prepare regeneration', status: 500 }
  }

  const supersededCount = superseded?.length ?? 0

  try {
    const { inputText, options, title, citationsMeta } = await buildGammaReportInput({
      reportType: 'audit_summary',
      contactSubmissionId: audit.contact_submission_id,
      diagnosticAuditId: audit.id,
    })

    const row = await insertGammaReportRow({
      reportType: 'audit_summary',
      title,
      contactSubmissionId: audit.contact_submission_id,
      diagnosticAuditId: audit.id,
      valueReportId: null,
      proposalId: null,
      inputText,
      externalInputs: {},
      gammaOptions: options,
      citationsMeta,
      createdBy,
    })

    if (!row) {
      // Should not happen since we just superseded existing active rows,
      // but treat it as a conflict so the caller can show an appropriate message.
      return {
        ok: false,
        error: 'Another regeneration is already in progress',
        status: 409,
        auditId: auditIdStr,
      }
    }

    // Fire-and-forget: generation is long-running. Clients poll via /admin/reports/gamma.
    runGammaGeneration(row.id, inputText, options).catch((err) => {
      console.error(`${LOG_PREFIX} generation failed for audit ${auditIdStr}`, err)
    })

    return {
      ok: true,
      auditId: auditIdStr,
      gammaReportId: row.id,
      supersededCount,
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} failed to build/insert gamma row`, err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to start regeneration',
      status: 500,
      auditId: auditIdStr,
    }
  }
}
