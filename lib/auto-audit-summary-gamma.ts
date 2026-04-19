/**
 * Auto-generate an audit_summary Gamma deck when a diagnostic audit completes
 * with a linked contact. Fire-and-forget entry point; logs on failure, never throws.
 *
 * Concurrency: relies on partial unique index on gamma_reports
 * (diagnostic_audit_id WHERE report_type='audit_summary' AND status IN ('generating','completed'))
 * so duplicate concurrent calls are conflict-safe.
 */

import { supabaseAdmin } from './supabase'
import { buildGammaReportInput } from './gamma-report-builder'
import { insertGammaReportRow, runGammaGeneration } from './gamma-generation'

const LOG_PREFIX = '[auto-audit-summary]'

/**
 * Background audits (especially multi-meeting `from_meetings` audits) produce
 * larger decks that routinely take 5+ minutes to render on Gamma's side.
 * Give the poll a 10-minute budget here so we don't flip rows to `failed`
 * while Gamma is still working — the interactive `POST /api/admin/gamma-reports`
 * path keeps its default 5 min so users aren't kept waiting.
 */
const AUTO_SUMMARY_WAIT_TIMEOUT_MS = 600_000

function isEnabled(): boolean {
  const flag = process.env.AUTO_GENERATE_DIAGNOSTIC_AUDIT_SUMMARY
  if (flag === undefined || flag === '') return true
  return flag === 'true' || flag === '1'
}

/**
 * Fire-and-forget: enqueue audit_summary generation for a completed diagnostic audit.
 * Safe to call from any code path; silently skips when ineligible.
 */
export function enqueueAuditSummaryGamma(auditId: string): void {
  if (!isEnabled()) return
  runAuditSummaryGamma(auditId).catch((err) => {
    console.error(`${LOG_PREFIX} Unhandled error for audit ${auditId}:`, err instanceof Error ? err.message : err)
  })
}

async function runAuditSummaryGamma(auditId: string): Promise<void> {
  if (!supabaseAdmin) {
    console.warn(`${LOG_PREFIX} supabaseAdmin not available — skipping`)
    return
  }

  // 1. Load the audit and verify eligibility
  const { data: audit, error: auditErr } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id, status, contact_submission_id, contact_email, business_name, website_url')
    .eq('id', auditId)
    .single()

  if (auditErr || !audit) {
    console.warn(`${LOG_PREFIX} Audit ${auditId} not found — skipping`)
    return
  }

  if (audit.status !== 'completed') {
    return
  }

  if (!audit.contact_submission_id) {
    console.info(`${LOG_PREFIX} Audit ${auditId} has no contact_submission_id — skipping (soft gate)`)
    return
  }

  const contactId: number = audit.contact_submission_id

  // 2. Build the Gamma report input
  const { inputText, options, title, citationsMeta } = await buildGammaReportInput({
    reportType: 'audit_summary',
    contactSubmissionId: contactId,
    diagnosticAuditId: audit.id,
  })

  // 3. Insert row (conflict-safe via partial unique index)
  const row = await insertGammaReportRow({
    reportType: 'audit_summary',
    title,
    contactSubmissionId: contactId,
    diagnosticAuditId: audit.id,
    valueReportId: null,
    proposalId: null,
    inputText,
    externalInputs: {},
    gammaOptions: options,
    citationsMeta,
    createdBy: null,
  })

  if (!row) {
    console.info(`${LOG_PREFIX} Audit ${auditId} already has an active audit_summary — skipping (idempotent)`)
    return
  }

  console.info(`${LOG_PREFIX} Generating audit_summary for audit ${auditId}, gamma row ${row.id}`)

  // 4. Run generation with retries (shared helper handles retry + failure marking)
  const result = await runGammaGeneration(row.id, inputText, options, {
    waitTimeoutMs: AUTO_SUMMARY_WAIT_TIMEOUT_MS,
  })

  if (result.status === 'completed') {
    console.info(`${LOG_PREFIX} Completed audit_summary for audit ${auditId}: ${result.gammaUrl}`)
  } else {
    console.error(`${LOG_PREFIX} Failed audit_summary for audit ${auditId}: ${result.errorMessage}`)
  }
}
