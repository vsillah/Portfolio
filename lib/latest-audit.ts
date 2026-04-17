/**
 * Shared lookup for "the latest audit for a contact" across all entry points.
 *
 * A contact can be identified by any of:
 *   - email (canonical, works everywhere)
 *   - contact_submission_id (internal id)
 *   - auditId (if caller already knows the audit)
 *
 * Merges three sources because diagnostic_audits rows can be linked by:
 *   1. contact_submission_id (strong link, preferred)
 *   2. contact_email (denormalized, for chat/tool flows)
 *   3. user_id on the audit (auth'd standalone tool)
 *
 * Also resolves the latest audit_summary Gamma report for the chosen audit so
 * callers can show a "View report" link tied to /admin/reports/gamma.
 */

import { supabaseAdmin } from './supabase'

export type LatestAuditGammaInfo = {
  /** gamma_reports.id of the most recent audit_summary row (any status). */
  id: string
  /** 'pending' | 'generating' | 'completed' | 'failed' | 'superseded' */
  status: string
  /** Public Gamma deck URL (null until generation completes). */
  gammaUrl: string | null
  /** When the gamma row was created. */
  createdAt: string | null
}

export type LatestAuditInfo = {
  auditId: string
  auditStatus: string | null
  completedAt: string | null
  updatedAt: string | null
  businessName: string | null
  contactEmail: string | null
  contactSubmissionId: number | null
  auditType: string | null
  /** Latest audit_summary Gamma row for this audit, or null if none exists yet. */
  gammaReport: LatestAuditGammaInfo | null
}

export type ResolveLatestAuditInput = {
  email?: string | null
  contactSubmissionId?: number | string | null
  auditId?: string | number | null
}

type AuditRow = {
  id: string | number
  status: string | null
  completed_at: string | null
  updated_at: string | null
  business_name: string | null
  contact_email: string | null
  contact_submission_id: number | null
  audit_type: string | null
}

const AUDIT_COLUMNS =
  'id, status, completed_at, updated_at, business_name, contact_email, contact_submission_id, audit_type'

function scoreAudit(row: AuditRow): number {
  // Prefer completed audits, then most recent timestamp.
  const ts = new Date(row.completed_at || row.updated_at || 0).getTime()
  const statusBoost = row.status === 'completed' ? 1e15 : 0
  return ts + statusBoost
}

function pickBest(rows: AuditRow[]): AuditRow | null {
  if (!rows.length) return null
  const byId = new Map<string, AuditRow>()
  for (const r of rows) {
    const id = String(r.id)
    const prev = byId.get(id)
    if (!prev || scoreAudit(r) > scoreAudit(prev)) byId.set(id, r)
  }
  return [...byId.values()].sort((a, b) => scoreAudit(b) - scoreAudit(a))[0] ?? null
}

export async function resolveLatestAudit(
  input: ResolveLatestAuditInput
): Promise<LatestAuditInfo | null> {
  if (!supabaseAdmin) return null

  const email = (input.email || '').trim().toLowerCase() || null
  const contactSubmissionId =
    input.contactSubmissionId !== null && input.contactSubmissionId !== undefined
      ? Number(input.contactSubmissionId)
      : null
  const auditId =
    input.auditId !== null && input.auditId !== undefined ? String(input.auditId) : null

  if (!email && !contactSubmissionId && !auditId) return null

  const candidates: AuditRow[] = []

  // 1. Direct by auditId (always authoritative when provided)
  if (auditId) {
    const { data } = await supabaseAdmin
      .from('diagnostic_audits')
      .select(AUDIT_COLUMNS)
      .eq('id', auditId)
      .maybeSingle()
    if (data) candidates.push(data as AuditRow)
  }

  // 2. By contact_submission_id
  const contactIds = new Set<number>()
  if (contactSubmissionId && Number.isFinite(contactSubmissionId)) {
    contactIds.add(contactSubmissionId)
  }

  // 3. Resolve contact_submission_id(s) by email too
  if (email) {
    const { data: contactRows } = await supabaseAdmin
      .from('contact_submissions')
      .select('id')
      .eq('email', email)
    for (const row of (contactRows || []) as { id: number }[]) {
      contactIds.add(row.id)
    }
  }

  if (contactIds.size) {
    const { data } = await supabaseAdmin
      .from('diagnostic_audits')
      .select(AUDIT_COLUMNS)
      .in('contact_submission_id', Array.from(contactIds))
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(10)
    for (const row of (data || []) as AuditRow[]) candidates.push(row)
  }

  // 4. By denormalized contact_email on the audit itself
  if (email) {
    const { data } = await supabaseAdmin
      .from('diagnostic_audits')
      .select(AUDIT_COLUMNS)
      .eq('contact_email', email)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(10)
    for (const row of (data || []) as AuditRow[]) candidates.push(row)
  }

  const best = pickBest(candidates)
  if (!best) return null

  const gamma = await getLatestAuditSummaryGamma(String(best.id))

  return {
    auditId: String(best.id),
    auditStatus: best.status,
    completedAt: best.completed_at,
    updatedAt: best.updated_at,
    businessName: best.business_name,
    contactEmail: best.contact_email,
    contactSubmissionId: best.contact_submission_id,
    auditType: best.audit_type,
    gammaReport: gamma,
  }
}

/**
 * Fetch the most recent audit_summary gamma_reports row for an audit.
 * Prefers active rows (generating | completed), falls back to the most
 * recent row of any status so callers can show "failed" or "superseded" state.
 */
export async function getLatestAuditSummaryGamma(
  auditId: string | number
): Promise<LatestAuditGammaInfo | null> {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('gamma_reports')
    .select('id, status, gamma_url, created_at')
    .eq('diagnostic_audit_id', auditId)
    .eq('report_type', 'audit_summary')
    .order('created_at', { ascending: false })
    .limit(5)

  const rows = (data || []) as Array<{
    id: string
    status: string
    gamma_url: string | null
    created_at: string | null
  }>
  if (!rows.length) return null

  // Prefer an active or completed row; otherwise most recent overall.
  const active = rows.find(
    (r) => r.status === 'completed' || r.status === 'generating' || r.status === 'pending'
  )
  const picked = active ?? rows[0]!
  return {
    id: picked.id,
    status: picked.status,
    gammaUrl: picked.gamma_url,
    createdAt: picked.created_at,
  }
}
