/**
 * Diagnostic Audit Utility Functions
 * Handles saving, updating, and managing diagnostic audit data in Supabase
 */

import { supabaseAdmin } from './supabase'
import type { DiagnosticAuditData, DiagnosticCategory, DiagnosticProgress } from './n8n'

/** audit_type values on diagnostic_audits; must match DB CHECK constraint. */
export type DiagnosticAuditType = 'chat' | 'standalone' | 'in_person' | 'from_meetings'

export type ReportTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface DiagnosticAuditRecord {
  id: string
  session_id: string
  contact_submission_id?: number | null
  audit_type?: DiagnosticAuditType
  /** When audit_type = from_meetings, IDs of meeting_records used to build this audit. */
  source_meeting_ids?: string[] | null
  status: 'in_progress' | 'completed' | 'abandoned'
  business_challenges: Record<string, unknown>
  tech_stack: Record<string, unknown>
  automation_needs: Record<string, unknown>
  ai_readiness: Record<string, unknown>
  budget_timeline: Record<string, unknown>
  decision_making: Record<string, unknown>
  diagnostic_summary?: string | null
  key_insights?: string[] | null
  recommended_actions?: string[] | null
  current_category?: string | null
  questions_asked?: string[] | null
  responses_received?: Record<string, unknown> | null
  urgency_score?: number | null
  opportunity_score?: number | null
  sales_notes?: string | null
  started_at: string
  completed_at?: string | null
  updated_at: string
  /** Phase 1: context capture fields */
  business_name?: string | null
  website_url?: string | null
  contact_email?: string | null
  industry_slug?: string | null
  industry_gics_code?: string | null
  enriched_tech_stack?: Record<string, unknown> | null
  value_estimate?: Record<string, unknown> | null
  report_tier?: ReportTier | null
  /** Phase 2: visual analysis fields */
  website_screenshot_path?: string | null
  website_annotations?: Array<Record<string, unknown>> | null
  /** Set when audit is started or updated from a logged-in session */
  user_id?: string | null
}

/**
 * Save or update a diagnostic audit record
 */
/** Questions grouped by assessment category for lead dashboard "what will strengthen confidence" */
export type QuestionsByCategory = Partial<Record<string, string[]>>

export async function saveDiagnosticAudit(
  sessionId: string,
  data: {
    diagnosticAuditId?: string
    status?: 'in_progress' | 'completed' | 'abandoned'
    currentCategory?: DiagnosticCategory
    progress?: DiagnosticProgress
    diagnosticData?: Partial<DiagnosticAuditData>
    contactSubmissionId?: number
    /** Optional: questions per category for lead dashboard; persisted when status is completed */
    questionsByCategory?: QuestionsByCategory
    /** Required on insert in DB. Defaults to 'chat' when creating. */
    auditType?: DiagnosticAuditType
    /** When auditType = from_meetings, list of meeting_records.id for traceability. */
    sourceMeetingIds?: string[]
    /** Phase 1: context capture fields */
    businessName?: string
    websiteUrl?: string
    contactEmail?: string
    industrySlug?: string
    industryGicsCode?: string
    enrichedTechStack?: Record<string, unknown>
    valueEstimate?: Record<string, unknown>
    reportTier?: ReportTier
    /** Supabase Auth user id when session is present (standalone / chat) */
    userId?: string
  }
): Promise<{ id: string; error?: Error }> {
  try {
    const updateData: Record<string, unknown> = {
      session_id: sessionId,
      updated_at: new Date().toISOString(),
    }

    // audit_type is NOT NULL on diagnostic_audits; set when creating (and optionally on update)
    if (data.auditType) {
      updateData.audit_type = data.auditType
    } else if (!data.diagnosticAuditId) {
      updateData.audit_type = 'chat'
    }

    // Update status
    if (data.status) {
      updateData.status = data.status
      if (data.status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }
    }

    // Update current category
    if (data.currentCategory) {
      updateData.current_category = data.currentCategory
    }

    // Update progress tracking
    if (data.progress) {
      if (data.progress.questionsAsked) {
        updateData.questions_asked = data.progress.questionsAsked
      }
      if (data.progress.responsesReceived) {
        updateData.responses_received = data.progress.responsesReceived
      }
    }

    // Update diagnostic data fields
    if (data.diagnosticData) {
      if (data.diagnosticData.business_challenges) {
        updateData.business_challenges = data.diagnosticData.business_challenges
      }
      if (data.diagnosticData.tech_stack) {
        updateData.tech_stack = data.diagnosticData.tech_stack
      }
      if (data.diagnosticData.automation_needs) {
        updateData.automation_needs = data.diagnosticData.automation_needs
      }
      if (data.diagnosticData.ai_readiness) {
        updateData.ai_readiness = data.diagnosticData.ai_readiness
      }
      if (data.diagnosticData.budget_timeline) {
        updateData.budget_timeline = data.diagnosticData.budget_timeline
      }
      if (data.diagnosticData.decision_making) {
        updateData.decision_making = data.diagnosticData.decision_making
      }
      if (data.diagnosticData.diagnostic_summary) {
        updateData.diagnostic_summary = data.diagnosticData.diagnostic_summary
      }
      if (data.diagnosticData.key_insights) {
        updateData.key_insights = data.diagnosticData.key_insights
      }
      if (data.diagnosticData.recommended_actions) {
        updateData.recommended_actions = data.diagnosticData.recommended_actions
      }
      if (data.diagnosticData.urgency_score !== undefined) {
        updateData.urgency_score = data.diagnosticData.urgency_score
      }
      if (data.diagnosticData.opportunity_score !== undefined) {
        updateData.opportunity_score = data.diagnosticData.opportunity_score
      }
      if (data.diagnosticData.sales_notes) {
        updateData.sales_notes = data.diagnosticData.sales_notes
      }
    }

    // Link to contact submission if provided; merge contact's website_tech_stack into tech_stack
    if (data.contactSubmissionId) {
      updateData.contact_submission_id = data.contactSubmissionId
      const contactWebsiteTech = await getContactWebsiteTechStack(data.contactSubmissionId)
      if (contactWebsiteTech) {
        const existingTechStack = (updateData.tech_stack as Record<string, unknown>) ?? {}
        updateData.tech_stack = mergeWebsiteTechStackIntoAuditTechStack(existingTechStack, contactWebsiteTech)
      }
    }

    if (data.sourceMeetingIds && Array.isArray(data.sourceMeetingIds) && data.sourceMeetingIds.length > 0) {
      updateData.source_meeting_ids = data.sourceMeetingIds
    }

    if (data.businessName !== undefined) updateData.business_name = data.businessName
    if (data.websiteUrl !== undefined) updateData.website_url = data.websiteUrl
    if (data.contactEmail !== undefined) updateData.contact_email = data.contactEmail
    if (data.industrySlug !== undefined) updateData.industry_slug = data.industrySlug
    if (data.industryGicsCode !== undefined) updateData.industry_gics_code = data.industryGicsCode
    if (data.enrichedTechStack !== undefined) updateData.enriched_tech_stack = data.enrichedTechStack
    if (data.valueEstimate !== undefined) updateData.value_estimate = data.valueEstimate
    if (data.reportTier !== undefined) updateData.report_tier = data.reportTier

    // Lead dashboard: questions per category (e.g. from n8n or chat flow)
    if (data.questionsByCategory && typeof data.questionsByCategory === 'object') {
      updateData.questions_by_category = data.questionsByCategory
    }

    if (data.userId) {
      updateData.user_id = data.userId
    }

    let auditId: string

    if (data.diagnosticAuditId) {
      // Update existing audit
      const { data: updated, error } = await supabaseAdmin
        .from('diagnostic_audits')
        .update(updateData)
        .eq('id', data.diagnosticAuditId)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      auditId = updated.id
    } else {
      // Create new audit
      const { data: created, error } = await supabaseAdmin
        .from('diagnostic_audits')
        .insert({
          ...updateData,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error) {
        throw error
      }

      auditId = created.id
    }

    // Auto-generate audit_summary Gamma on completion (single enqueue owner).
    // Always enqueue: contact may already be on the row from a prior save; this payload often omits contactSubmissionId on the final step.
    // Worker loads the audit from DB and skips if contact_submission_id is still null.
    if (data.status === 'completed') {
      import('./auto-audit-summary-gamma')
        .then((m) => m.enqueueAuditSummaryGamma(String(auditId)))
        .catch(() => {})
    }

    return { id: auditId }
  } catch (error) {
    console.error('Error saving diagnostic audit:', error)
    const errObj = error as Error & { message?: string }
    const message =
      errObj instanceof Error
        ? errObj.message
        : typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : 'Unknown error saving diagnostic audit'
    return {
      id: data.diagnosticAuditId || '',
      error: new Error(message),
    }
  }
}

/**
 * Get diagnostic audit by ID
 */
export async function getDiagnosticAudit(
  auditId: string
): Promise<{ data: DiagnosticAuditRecord | null; error?: Error }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('*')
      .eq('id', auditId)
      .single()

    if (error) {
      throw error
    }

    return { data: data as DiagnosticAuditRecord }
  } catch (error) {
    console.error('Error fetching diagnostic audit:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error fetching diagnostic audit'),
    }
  }
}

/**
 * Get diagnostic audit by session ID
 */
export async function getDiagnosticAuditBySession(
  sessionId: string
): Promise<{ data: DiagnosticAuditRecord | null; error?: Error }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('*')
      .eq('session_id', sessionId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // Not found is okay - return null
      if (error.code === 'PGRST116') {
        return { data: null }
      }
      throw error
    }

    return { data: data as DiagnosticAuditRecord }
  } catch (error) {
    console.error('Error fetching diagnostic audit by session:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error fetching diagnostic audit'),
    }
  }
}

/** Payload stored on contact and merged into audit.tech_stack.website_technologies */
export type WebsiteTechStackPayload = {
  domain: string
  technologies?: Array<{ name: string; tag?: string; categories?: string[] }>
  byTag?: Record<string, string[]>
}

/**
 * Merge contact's website_tech_stack into an audit tech_stack object (does not write to DB).
 */
export function mergeWebsiteTechStackIntoAuditTechStack(
  existingTechStack: Record<string, unknown> | null | undefined,
  websiteTechStack: WebsiteTechStackPayload | null | undefined
): Record<string, unknown> {
  const base = existingTechStack && typeof existingTechStack === 'object' ? { ...existingTechStack } : {}
  if (!websiteTechStack || typeof websiteTechStack !== 'object' || !websiteTechStack.domain) {
    return base
  }
  return { ...base, website_technologies: websiteTechStack }
}

/**
 * Fetch contact's website_tech_stack from contact_submissions (if any).
 */
export async function getContactWebsiteTechStack(
  contactSubmissionId: number
): Promise<WebsiteTechStackPayload | null> {
  const { data, error } = await supabaseAdmin
    .from('contact_submissions')
    .select('website_tech_stack')
    .eq('id', contactSubmissionId)
    .single()

  if (error || !data?.website_tech_stack) return null
  const w = data.website_tech_stack as unknown
  if (typeof w !== 'object' || w === null || !('domain' in w)) return null
  return w as WebsiteTechStackPayload
}

/**
 * Propagate contact's website_tech_stack to all diagnostic_audits for this contact.
 * Call after saving website_tech_stack to the contact (e.g. from Fetch tech stack).
 */
export async function propagateContactWebsiteTechStackToAudits(
  contactSubmissionId: number
): Promise<{ updated: number; error?: Error }> {
  try {
    const websiteTechStack = await getContactWebsiteTechStack(contactSubmissionId)
    if (!websiteTechStack) return { updated: 0 }

    const { data: audits, error: fetchErr } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('id, tech_stack')
      .eq('contact_submission_id', contactSubmissionId)

    if (fetchErr || !audits?.length) return { updated: 0 }

    let updated = 0
    for (const audit of audits) {
      const merged = mergeWebsiteTechStackIntoAuditTechStack(
        audit.tech_stack as Record<string, unknown> | null,
        websiteTechStack
      )
      const { error: updateErr } = await supabaseAdmin
        .from('diagnostic_audits')
        .update({
          tech_stack: merged,
          updated_at: new Date().toISOString(),
        })
        .eq('id', audit.id)

      if (!updateErr) updated++
    }
    return { updated }
  } catch (error) {
    console.error('Error propagating website tech stack to audits:', error)
    return {
      updated: 0,
      error: error instanceof Error ? error : new Error('Unknown error propagating tech stack'),
    }
  }
}

/**
 * Link diagnostic audit to contact submission and merge contact's website_tech_stack into the audit.
 */
export async function linkDiagnosticToContact(
  auditId: string,
  contactSubmissionId: number
): Promise<{ success: boolean; error?: Error }> {
  try {
    const websiteTechStack = await getContactWebsiteTechStack(contactSubmissionId)

    const updatePayload: Record<string, unknown> = {
      contact_submission_id: contactSubmissionId,
      updated_at: new Date().toISOString(),
    }

    if (websiteTechStack) {
      const { data: existing } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('tech_stack')
        .eq('id', auditId)
        .single()

      updatePayload.tech_stack = mergeWebsiteTechStackIntoAuditTechStack(
        (existing?.tech_stack as Record<string, unknown>) ?? null,
        websiteTechStack
      )
    }

    const { error } = await supabaseAdmin
      .from('diagnostic_audits')
      .update(updatePayload)
      .eq('id', auditId)

    if (error) {
      throw error
    }

    // Chat (and other paths) may complete the audit before contact exists; linking adds contact_submission_id.
    // Enqueue audit_summary Gamma here so we do not rely on the completion save alone (which had no contact yet).
    const { data: linked } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('status')
      .eq('id', auditId)
      .single()

    if (linked?.status === 'completed') {
      import('./auto-audit-summary-gamma')
        .then((m) => m.enqueueAuditSummaryGamma(String(auditId)))
        .catch(() => {})
    }

    return { success: true }
  } catch (error) {
    console.error('Error linking diagnostic to contact:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error linking diagnostic to contact'),
    }
  }
}

/**
 * Format diagnostic data for sales team review
 */
export function formatDiagnosticForSales(audit: DiagnosticAuditRecord): {
  summary: string
  insights: string[]
  urgency: number
  opportunity: number
  categoryData: Record<string, unknown>
} {
  const categoryData: Record<string, unknown> = {
    business_challenges: audit.business_challenges,
    tech_stack: audit.tech_stack,
    automation_needs: audit.automation_needs,
    ai_readiness: audit.ai_readiness,
    budget_timeline: audit.budget_timeline,
    decision_making: audit.decision_making,
  }

  return {
    summary: audit.diagnostic_summary || 'No summary available',
    insights: audit.key_insights || [],
    urgency: audit.urgency_score || 0,
    opportunity: audit.opportunity_score || 0,
    categoryData,
  }
}

/**
 * Validate diagnostic category
 */
export function isValidDiagnosticCategory(category: string): category is DiagnosticCategory {
  const validCategories: DiagnosticCategory[] = [
    'business_challenges',
    'tech_stack',
    'automation_needs',
    'ai_readiness',
    'budget_timeline',
    'decision_making',
  ]
  return validCategories.includes(category as DiagnosticCategory)
}

/**
 * Validate diagnostic status
 */
export function isValidDiagnosticStatus(status: string): status is 'in_progress' | 'completed' | 'abandoned' {
  return ['in_progress', 'completed', 'abandoned'].includes(status)
}

/**
 * Check if diagnostic audit is complete
 */
export function isDiagnosticComplete(audit: DiagnosticAuditRecord): boolean {
  return audit.status === 'completed'
}

/**
 * Get diagnostic progress percentage
 */
export function getDiagnosticProgress(audit: DiagnosticAuditRecord): number {
  const categories: DiagnosticCategory[] = [
    'business_challenges',
    'tech_stack',
    'automation_needs',
    'ai_readiness',
    'budget_timeline',
    'decision_making',
  ]

  let completedCount = 0
  for (const category of categories) {
    const categoryData = audit[category] as Record<string, unknown>
    if (categoryData && Object.keys(categoryData).length > 0) {
      completedCount++
    }
  }

  return Math.round((completedCount / categories.length) * 100)
}
