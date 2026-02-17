/**
 * Diagnostic Audit Utility Functions
 * Handles saving, updating, and managing diagnostic audit data in Supabase
 */

import { supabaseAdmin } from './supabase'
import type { DiagnosticAuditData, DiagnosticCategory, DiagnosticProgress } from './n8n'

export interface DiagnosticAuditRecord {
  id: string
  session_id: string
  contact_submission_id?: number | null
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
  }
): Promise<{ id: string; error?: Error }> {
  try {
    const updateData: Record<string, unknown> = {
      session_id: sessionId,
      updated_at: new Date().toISOString(),
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

    // Link to contact submission if provided
    if (data.contactSubmissionId) {
      updateData.contact_submission_id = data.contactSubmissionId
    }

    // Lead dashboard: questions per category (e.g. from n8n or chat flow)
    if (data.questionsByCategory && typeof data.questionsByCategory === 'object') {
      updateData.questions_by_category = data.questionsByCategory
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

    return { id: auditId }
  } catch (error) {
    console.error('Error saving diagnostic audit:', error)
    return {
      id: data.diagnosticAuditId || '',
      error: error instanceof Error ? error : new Error('Unknown error saving diagnostic audit'),
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

/**
 * Link diagnostic audit to contact submission
 */
export async function linkDiagnosticToContact(
  auditId: string,
  contactSubmissionId: number
): Promise<{ success: boolean; error?: Error }> {
  try {
    const { error } = await supabaseAdmin
      .from('diagnostic_audits')
      .update({
        contact_submission_id: contactSubmissionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    if (error) {
      throw error
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
