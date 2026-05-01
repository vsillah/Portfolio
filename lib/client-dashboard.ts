/**
 * Client Dashboard Data Access Layer
 *
 * Handles token-based access, dashboard data aggregation, task management,
 * and score snapshot CRUD for the client-facing assessment dashboard.
 */

import { supabaseAdmin } from './supabase'
import { getRoadmapBundleForProject, syncRoadmapTaskFromProjection } from './client-ai-ops-roadmap-db'
import type { RoadmapClientView } from './client-ai-ops-roadmap'
import { getSignedUrl } from './storage'
import type { CategoryScores, ScoreSnapshot } from './assessment-scoring'
import type { AssessmentCategory } from './assessment-scoring'
import {
  ASSESSMENT_CATEGORIES,
  extractCategoryScores,
  extractCategoryConfidence,
  calculateOverallScore,
  calculateDreamOutcomeGap,
  calculateGapAnalysis,
  calculateScoreDelta,
} from './assessment-scoring'
import { getDefaultOnboardingMilestoneTitles } from './onboarding-templates'

// ============================================================================
// Types
// ============================================================================

export interface DashboardAccess {
  id: string
  client_project_id: string | null
  diagnostic_audit_id: number | null
  access_token: string
  client_email: string
  is_active: boolean
  last_accessed_at: string | null
  created_at: string
}

export type DashboardStage = 'lead' | 'client'

export interface ValidateDashboardResult {
  projectId: string | null
  access: DashboardAccess | null
  stage: DashboardStage
  diagnosticAuditId: number | null
  error?: string
}

/** Lead-stage payload: assessment, scores, confidence, and "what will strengthen" */
export interface LeadDashboardData {
  stage: 'lead'
  project: {
    client_name: string
    client_email: string
    client_company: string | null
  }
  assessment: {
    diagnostic_summary: string | null
    key_insights: string[] | null
    recommended_actions: string[] | null
    business_challenges: Record<string, unknown>
    tech_stack: Record<string, unknown>
    automation_needs: Record<string, unknown>
    ai_readiness: Record<string, unknown>
    budget_timeline: Record<string, unknown>
    decision_making: Record<string, unknown>
  } | null
  scores: {
    categoryScores: ReturnType<typeof extractCategoryScores>
    overallScore: number
    dreamOutcomeGap: number
  }
  gapAnalysis: ReturnType<typeof calculateGapAnalysis>
  confidence: ReturnType<typeof extractCategoryConfidence>
  strengthenQuestions: Partial<Record<AssessmentCategory, string[]>>
  engagementSteps: string[]
  industryBenchmarksMessage: string
}

export interface DashboardTask {
  id: string
  client_project_id: string
  category: string
  title: string
  description: string | null
  priority: 'high' | 'medium' | 'low'
  impact_score: number
  status: 'pending' | 'in_progress' | 'complete'
  completed_at: string | null
  due_date: string | null
  display_order: number
  diy_resources: DiyResource[]
  accelerated_bundle_id: string | null
  accelerated_service_id: number | null
  accelerated_headline: string | null
  accelerated_savings: string | null
  created_at: string
  roadmap_task_id?: string | null
  // Resolved at API layer
  accelerated_bundle?: {
    id: string
    name: string
    bundle_price: number | null
    pricing_tier_slug: string | null
  } | null
}

export interface DiyResource {
  type: 'video' | 'article' | 'n8n_workflow' | 'lead_magnet' | 'product' | 'external_link'
  title: string
  url?: string
  content_type?: string
  content_id?: number
  description?: string
  estimated_time?: string
  file_bucket?: string
  file_path?: string
  // Resolved at API layer
  signed_url?: string
}

export interface DashboardDocument {
  id: string
  type: 'proposal' | 'onboarding_plan' | 'onboarding_preview' | 'contract' | 'strategy_report' | 'opportunity_quantification' | 'proposal_package' | 'other'
  title: string
  pdf_url: string | null
  signed_url: string | null
  created_at: string
  status: string | null
}

export interface TimeEntrySummary {
  target_type: 'milestone' | 'task'
  target_id: string
  total_seconds: number
  entry_count: number
}

export interface TimeTrackingData {
  total_seconds: number
  by_target: TimeEntrySummary[]
}

export interface ClientValueReport {
  id: string
  title: string
  report_type: string
  industry: string
  company_size_range: string
  total_annual_value: number
  summary_markdown: string
  value_statements: unknown[]
  created_at: string
}

export interface ClientGammaReport {
  id: string
  title: string
  report_type: string
  gamma_url: string | null
  status: 'pending' | 'generating' | 'completed' | 'failed'
  created_at: string
}

export interface DashboardData {
  project: {
    id: string
    project_name: string
    client_name: string
    client_email: string
    client_company: string | null
    project_start_date: string | null
    current_phase: number
  }
  assessment: {
    diagnostic_summary: string | null
    key_insights: string[] | null
    recommended_actions: string[] | null
    business_challenges: Record<string, unknown>
    tech_stack: Record<string, unknown>
    automation_needs: Record<string, unknown>
    ai_readiness: Record<string, unknown>
    budget_timeline: Record<string, unknown>
    decision_making: Record<string, unknown>
  } | null
  scores: {
    categoryScores: CategoryScores
    overallScore: number
    dreamOutcomeGap: number
    delta: { absolute: number; percentage: number }
  }
  gapAnalysis: ReturnType<typeof calculateGapAnalysis>
  tasks: DashboardTask[]
  milestones: unknown[]
  snapshots: ScoreSnapshot[]
  documents: DashboardDocument[]
  timeTracking: TimeTrackingData
  nextMeeting: {
    meeting_date: string
    meeting_type: string
  } | null
  valueReport: {
    total_annual_value: number | null
    value_statements: unknown[]
  } | null
  valueReports: ClientValueReport[]
  gammaReports: ClientGammaReport[]
  aiOpsRoadmap: RoadmapClientView | null
}

// ============================================================================
// Token-Based Access
// ============================================================================

/**
 * Generate a new dashboard access token for a client project
 */
export async function generateDashboardAccess(
  clientProjectId: string,
  clientEmail: string
): Promise<{ access: DashboardAccess | null; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('client_dashboard_access')
    .insert({
      client_project_id: clientProjectId,
      client_email: clientEmail,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error generating dashboard access:', error)
    return { access: null, error: error.message }
  }

  return { access: data as DashboardAccess }
}

/**
 * Create or get lead-stage dashboard access for a completed diagnostic (with contact).
 * Returns existing access if one already exists for this diagnostic.
 */
export async function createLeadDashboardAccess(
  diagnosticAuditId: number,
  clientEmail: string
): Promise<{ access: DashboardAccess | null; error?: string }> {
  const { data: existing } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('*')
    .eq('diagnostic_audit_id', diagnosticAuditId)
    .is('client_project_id', null)
    .maybeSingle()

  if (existing) {
    return { access: existing as DashboardAccess }
  }

  const { data, error } = await supabaseAdmin
    .from('client_dashboard_access')
    .insert({
      diagnostic_audit_id: diagnosticAuditId,
      client_email: clientEmail,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating lead dashboard access:', error)
    return { access: null, error: error.message }
  }

  return { access: data as DashboardAccess }
}

/**
 * Validate a dashboard access token and return stage (lead vs client) and IDs.
 * Also updates last_accessed_at.
 */
export async function validateDashboardToken(
  token: string
): Promise<ValidateDashboardResult> {
  const { data, error } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('*')
    .eq('access_token', token)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return {
      projectId: null,
      access: null,
      stage: 'client',
      diagnosticAuditId: null,
      error: 'Invalid or expired dashboard link',
    }
  }

  // Update last accessed timestamp (fire and forget)
  supabaseAdmin
    .from('client_dashboard_access')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  const access = data as DashboardAccess
  const projectId = access.client_project_id ?? null
  const diagnosticAuditId = access.diagnostic_audit_id ?? null
  const stage: DashboardStage =
    projectId != null ? 'client' : diagnosticAuditId != null ? 'lead' : 'client'

  return {
    projectId,
    access,
    stage,
    diagnosticAuditId,
  }
}

// ============================================================================
// Full Dashboard Data Fetch
// ============================================================================

/**
 * Load lead-stage dashboard data by diagnostic_audit_id.
 * Requires audit to be completed and linked to a contact.
 */
async function getLeadDashboardData(
  diagnosticAuditId: number
): Promise<{ data: LeadDashboardData | null; error?: string }> {
  const { data: audit, error: auditError } = await supabaseAdmin
    .from('diagnostic_audits')
    .select(`
      id, status, contact_submission_id,
      diagnostic_summary, key_insights, recommended_actions,
      business_challenges, tech_stack, automation_needs,
      ai_readiness, budget_timeline, decision_making,
      questions_by_category
    `)
    .eq('id', diagnosticAuditId)
    .eq('status', 'completed')
    .single()

  if (auditError || !audit) {
    return { data: null, error: 'Diagnostic not found or not completed' }
  }

  if (audit.contact_submission_id == null) {
    return { data: null, error: 'Lead dashboard requires a contact' }
  }

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('contact_submissions')
    .select('name, email, company')
    .eq('id', audit.contact_submission_id)
    .single()

  if (contactError || !contact) {
    return { data: null, error: 'Contact not found' }
  }

  const categoryScores = extractCategoryScores(audit)
  const overallScore = calculateOverallScore(categoryScores)
  const dreamOutcomeGap = calculateDreamOutcomeGap(categoryScores)
  const gapAnalysis = calculateGapAnalysis(categoryScores)
  const confidence = extractCategoryConfidence(audit)

  const questionsByCategory = (audit.questions_by_category as Record<string, string[]>) ?? {}
  const strengthenQuestions: Partial<Record<AssessmentCategory, string[]>> = {}
  for (const cat of ASSESSMENT_CATEGORIES) {
    const arr = questionsByCategory[cat]
    if (Array.isArray(arr) && arr.length > 0) {
      strengthenQuestions[cat as AssessmentCategory] = arr
    }
  }

  const engagementSteps = await getDefaultOnboardingMilestoneTitles()

  const assessment = {
    diagnostic_summary: audit.diagnostic_summary,
    key_insights: audit.key_insights,
    recommended_actions: audit.recommended_actions,
    business_challenges: (audit.business_challenges as Record<string, unknown>) ?? {},
    tech_stack: (audit.tech_stack as Record<string, unknown>) ?? {},
    automation_needs: (audit.automation_needs as Record<string, unknown>) ?? {},
    ai_readiness: (audit.ai_readiness as Record<string, unknown>) ?? {},
    budget_timeline: (audit.budget_timeline as Record<string, unknown>) ?? {},
    decision_making: (audit.decision_making as Record<string, unknown>) ?? {},
  }

  const data: LeadDashboardData = {
    stage: 'lead',
    project: {
      client_name: contact.name ?? '',
      client_email: contact.email ?? '',
      client_company: contact.company ?? null,
    },
    assessment,
    scores: { categoryScores, overallScore, dreamOutcomeGap },
    gapAnalysis,
    confidence,
    strengthenQuestions,
    engagementSteps,
    industryBenchmarksMessage: 'This view is based on industry benchmarks.',
  }
  return { data }
}

/**
 * Fetch all dashboard data for a given token. This is the main entry point
 * for the client dashboard page. Returns lead or client payload based on stage.
 */
export async function getDashboardByToken(
  token: string
): Promise<{
  data: DashboardData | LeadDashboardData | null
  stage: DashboardStage
  error?: string
}> {
  const { projectId, stage, diagnosticAuditId, error: tokenError } =
    await validateDashboardToken(token)

  if (tokenError) {
    return { data: null, stage: 'client', error: tokenError }
  }

  if (stage === 'lead' && diagnosticAuditId != null) {
    const leadResult = await getLeadDashboardData(diagnosticAuditId)
    if (leadResult.error) {
      return { data: null, stage: 'lead', error: leadResult.error }
    }
    return {
      data: leadResult.data as LeadDashboardData,
      stage: 'lead',
    }
  }

  if (projectId == null) {
    return { data: null, stage: 'client', error: 'Invalid or expired dashboard link' }
  }

  // Fetch project with linked data (client stage)
  const { data: project, error: projectError } = await supabaseAdmin
    .from('client_projects')
    .select(`
      id, project_name, client_name, client_email, client_company,
      project_start_date, current_phase,
      contact_submission_id, proposal_id, onboarding_plan_id
    `)
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return { data: null, stage: 'client', error: 'Project not found' }
  }

  // Parallel fetches for dashboard components
  const [
    auditResult,
    tasksResult,
    snapshotsResult,
    onboardingResult,
    meetingResult,
    valueReportResult,
    proposalDocsResult,
    proposalAttachmentsResult,
    onboardingDocsResult,
    timeEntriesResult,
    allValueReportsResult,
    allGammaReportsResult,
  ] = await Promise.all([
    // Diagnostic audit via contact_submission -> diagnostic_audits
    project.contact_submission_id
      ? supabaseAdmin
          .from('diagnostic_audits')
          .select('*')
          .eq('contact_submission_id', project.contact_submission_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Tasks
    supabaseAdmin
      .from('dashboard_tasks')
      .select('*')
      .eq('client_project_id', projectId)
      .order('display_order', { ascending: true }),

    // Score snapshots
    supabaseAdmin
      .from('score_snapshots')
      .select('*')
      .eq('client_project_id', projectId)
      .order('snapshot_date', { ascending: true }),

    // Onboarding plan milestones
    project.onboarding_plan_id
      ? supabaseAdmin
          .from('onboarding_plans')
          .select('milestones')
          .eq('id', project.onboarding_plan_id)
          .single()
      : Promise.resolve({ data: null, error: null }),

    // Next meeting
    supabaseAdmin
      .from('meeting_records')
      .select('meeting_date, meeting_type')
      .eq('client_project_id', projectId)
      .gte('meeting_date', new Date().toISOString())
      .order('meeting_date', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // Value report via proposal
    project.proposal_id
      ? supabaseAdmin
          .from('proposals')
          .select('value_report_id, value_assessment')
          .eq('id', project.proposal_id)
          .single()
          .then(async (proposalRes: { data: { value_report_id?: string; value_assessment?: unknown } | null; error: unknown }) => {
            if (proposalRes.data?.value_report_id) {
              return supabaseAdmin
                .from('value_reports')
                .select('total_annual_value, value_statements')
                .eq('id', proposalRes.data.value_report_id)
                .single()
            }
            if (proposalRes.data?.value_assessment) {
              const va = proposalRes.data.value_assessment as Record<string, unknown>
              return {
                data: {
                  total_annual_value: va.totalAnnualValue ?? null,
                  value_statements: va.valueStatements ?? [],
                },
                error: null,
              }
            }
            return { data: null, error: null }
          })
      : Promise.resolve({ data: null, error: null }),

    // Documents: single proposal for this project (proposals have no client_project_id; link is client_projects.proposal_id -> proposals.id)
    project.proposal_id
      ? supabaseAdmin
          .from('proposals')
          .select('id, bundle_name, pdf_url, contract_pdf_url, status, created_at')
          .eq('id', project.proposal_id)
          .single()
      : Promise.resolve({ data: null, error: null }),

    // Documents: attached reports (strategy, opportunity quantification) on the proposal — path convention: proposal-docs/{proposal_id}/{uuid}.pdf
    project.proposal_id
      ? supabaseAdmin
          .from('proposal_documents')
          .select('id, document_type, title, file_path, created_at')
          .eq('proposal_id', project.proposal_id)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: null, error: null }),

    // Documents: single onboarding plan for this project (with template name for title)
    project.onboarding_plan_id
      ? supabaseAdmin
          .from('onboarding_plans')
          .select('id, pdf_url, status, created_at, onboarding_plan_templates(name)')
          .eq('id', project.onboarding_plan_id)
          .single()
      : Promise.resolve({ data: null, error: null }),

    // Time entries (completed only — no running timers for client view)
    supabaseAdmin
      .from('time_entries')
      .select('target_type, target_id, duration_seconds')
      .eq('client_project_id', projectId)
      .eq('is_running', false)
      .not('duration_seconds', 'is', null),

    // All value reports for this contact
    project.contact_submission_id
      ? supabaseAdmin
          .from('value_reports')
          .select('id, title, report_type, industry, company_size_range, total_annual_value, summary_markdown, value_statements, created_at')
          .eq('contact_submission_id', project.contact_submission_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),

    // All completed gamma reports for this contact
    project.contact_submission_id
      ? supabaseAdmin
          .from('gamma_reports')
          .select('id, title, report_type, gamma_url, status, created_at')
          .eq('contact_submission_id', project.contact_submission_id)
          .in('status', ['generating', 'completed', 'failed'])
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
  ])

  const audit = auditResult.data
  const tasks = (tasksResult.data || []) as DashboardTask[]
  const snapshots = (snapshotsResult.data || []) as ScoreSnapshot[]
  const milestones = onboardingResult.data?.milestones || []
  const proposalAttachments = (proposalAttachmentsResult.data || []) as Array<{ id: string; document_type: string; title: string; file_path: string; created_at: string }>

  // Assemble documents list with signed URLs (from single proposal + proposal_documents + single onboarding plan)
  const documents: DashboardDocument[] = []
  const proposal = proposalDocsResult.data as { id: string; bundle_name: string; pdf_url: string | null; contract_pdf_url: string | null; status: string; created_at: string } | null
  const onboardingPlan = onboardingDocsResult.data as { id: string; pdf_url: string | null; status: string; created_at: string; onboarding_plan_templates: { name: string } | null } | null

  const getSignedUrlForPdf = async (pdfUrl: string | null, bucket: string): Promise<string | null> => {
    if (!pdfUrl) return null
    try {
      const path = pdfUrl.includes(bucket + '/') ? pdfUrl.split(bucket + '/')[1] : pdfUrl.split('/').pop() ?? ''
      return path ? await getSignedUrl(bucket, path, 3600) : null
    } catch {
      return null
    }
  }

  if (proposal) {
    const proposalSignedUrl = await getSignedUrlForPdf(proposal.pdf_url, 'documents')
    documents.push({
      id: proposal.id,
      type: 'proposal',
      title: proposal.bundle_name || 'Proposal',
      pdf_url: proposal.pdf_url,
      signed_url: proposalSignedUrl,
      created_at: proposal.created_at,
      status: proposal.status,
    })
    if (proposal.contract_pdf_url) {
      const contractSignedUrl = await getSignedUrlForPdf(proposal.contract_pdf_url, 'documents')
      documents.push({
        id: `${proposal.id}-contract`,
        type: 'contract',
        title: 'Software Agreement',
        pdf_url: proposal.contract_pdf_url,
        signed_url: contractSignedUrl,
        created_at: proposal.created_at,
        status: proposal.status,
      })
    }
  }

  for (const att of proposalAttachments) {
    let signedUrl: string | null = null
    try {
      const { data: signed } = await supabaseAdmin.storage.from('documents').createSignedUrl(att.file_path, 3600)
      signedUrl = signed?.signedUrl ?? null
    } catch {
      // leave signedUrl null
    }
    const docType = (['strategy_report', 'opportunity_quantification', 'proposal_package', 'onboarding_preview', 'other'].includes(att.document_type)
      ? att.document_type
      : 'other') as DashboardDocument['type']
    documents.push({
      id: att.id,
      type: docType,
      title: att.title,
      pdf_url: null,
      signed_url: signedUrl,
      created_at: att.created_at,
      status: null,
    })
  }

  if (onboardingPlan) {
    const onboardingSignedUrl = await getSignedUrlForPdf(onboardingPlan.pdf_url, 'documents')
    const planTitle = onboardingPlan.onboarding_plan_templates?.name || 'Onboarding Plan'
    documents.push({
      id: onboardingPlan.id,
      type: 'onboarding_plan',
      title: planTitle,
      pdf_url: onboardingPlan.pdf_url,
      signed_url: onboardingSignedUrl,
      created_at: onboardingPlan.created_at,
      status: onboardingPlan.status,
    })
  }

  // Aggregate time tracking data
  const rawTimeEntries = (timeEntriesResult.data || []) as { target_type: string; target_id: string; duration_seconds: number }[]
  const targetMap = new Map<string, TimeEntrySummary>()
  let totalTimeSeconds = 0
  for (const te of rawTimeEntries) {
    const key = `${te.target_type}:${te.target_id}`
    const existing = targetMap.get(key)
    if (existing) {
      existing.total_seconds += te.duration_seconds
      existing.entry_count += 1
    } else {
      targetMap.set(key, {
        target_type: te.target_type as 'milestone' | 'task',
        target_id: te.target_id,
        total_seconds: te.duration_seconds,
        entry_count: 1,
      })
    }
    totalTimeSeconds += te.duration_seconds
  }
  const timeTracking: TimeTrackingData = {
    total_seconds: totalTimeSeconds,
    by_target: Array.from(targetMap.values()),
  }

  // Resolve signed URLs for DIY resources that have file_bucket + file_path
  for (const task of tasks) {
    if (task.diy_resources && Array.isArray(task.diy_resources)) {
      for (const resource of task.diy_resources) {
        if (resource.file_bucket && resource.file_path) {
          try {
            resource.signed_url = await getSignedUrl(resource.file_bucket, resource.file_path, 3600)
          } catch {
            // Signed URL generation failed; leave signed_url undefined
          }
        }
      }
    }

    // Resolve accelerated bundle info
    if (task.accelerated_bundle_id) {
      const { data: bundle } = await supabaseAdmin
        .from('offer_bundles')
        .select('id, name, bundle_price, pricing_tier_slug')
        .eq('id', task.accelerated_bundle_id)
        .single()
      task.accelerated_bundle = bundle || null
    }
  }

  // Calculate scores
  let categoryScores: CategoryScores
  let overallScore: number
  let dreamOutcomeGap: number

  if (snapshots.length > 0) {
    // Use latest snapshot
    const latest = snapshots[snapshots.length - 1]
    categoryScores = latest.category_scores as CategoryScores
    overallScore = latest.overall_score
    dreamOutcomeGap = latest.dream_outcome_gap ?? calculateDreamOutcomeGap(categoryScores)
  } else if (audit) {
    // Derive from audit
    categoryScores = extractCategoryScores(audit)
    overallScore = calculateOverallScore(categoryScores)
    dreamOutcomeGap = calculateDreamOutcomeGap(categoryScores)
  } else {
    categoryScores = {
      business_challenges: 0,
      tech_stack: 0,
      automation_needs: 0,
      ai_readiness: 0,
      budget_timeline: 0,
      decision_making: 0,
    }
    overallScore = 0
    dreamOutcomeGap = 100
  }

  const delta = calculateScoreDelta(snapshots)
  const gapAnalysis = calculateGapAnalysis(categoryScores)

  // Build assessment section
  const assessment = audit
    ? {
        diagnostic_summary: audit.diagnostic_summary,
        key_insights: audit.key_insights,
        recommended_actions: audit.recommended_actions,
        business_challenges: audit.business_challenges || {},
        tech_stack: audit.tech_stack || {},
        automation_needs: audit.automation_needs || {},
        ai_readiness: audit.ai_readiness || {},
        budget_timeline: audit.budget_timeline || {},
        decision_making: audit.decision_making || {},
      }
    : null

  const valueReports = (allValueReportsResult.data || []) as ClientValueReport[]
  const gammaReports = (allGammaReportsResult.data || []) as ClientGammaReport[]
  const aiOpsRoadmap = await getRoadmapBundleForProject(projectId).then((bundle) => bundle?.clientView ?? null).catch(() => null)

  return {
    data: {
      project: {
        id: project.id,
        project_name: project.project_name,
        client_name: project.client_name,
        client_email: project.client_email,
        client_company: project.client_company,
        project_start_date: project.project_start_date,
        current_phase: project.current_phase,
      },
      assessment,
      scores: {
        categoryScores,
        overallScore,
        dreamOutcomeGap,
        delta,
      },
      gapAnalysis,
      tasks,
      milestones,
      snapshots,
      documents,
      timeTracking,
      nextMeeting: meetingResult.data || null,
      valueReport: valueReportResult.data || null,
      valueReports,
      gammaReports,
      aiOpsRoadmap,
    },
    stage: 'client',
  }
}

// ============================================================================
// Task Management
// ============================================================================

/**
 * Update a task's status. Validates token ownership before updating.
 */
export async function updateTaskStatus(
  token: string,
  taskId: string,
  status: 'pending' | 'in_progress' | 'complete'
): Promise<{ success: boolean; error?: string }> {
  const { projectId, error: tokenError } = await validateDashboardToken(token)
  if (!projectId) return { success: false, error: tokenError }

  // Verify task belongs to this project
  const { data: task } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('id, client_project_id')
    .eq('id', taskId)
    .single()

  if (!task || task.client_project_id !== projectId) {
    return { success: false, error: 'Task not found' }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'complete') {
    updateData.completed_at = new Date().toISOString()
  } else {
    updateData.completed_at = null
  }

  const { error } = await supabaseAdmin
    .from('dashboard_tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) {
    console.error('Error updating task status:', error)
    return { success: false, error: error.message }
  }

  await syncRoadmapTaskFromProjection('dashboard', taskId, status).catch((err) => {
    console.error('Error syncing roadmap task from dashboard task:', err)
  })

  return { success: true }
}

/**
 * Get all tasks for a project
 */
export async function getDashboardTasks(
  clientProjectId: string
): Promise<DashboardTask[]> {
  const { data } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('*')
    .eq('client_project_id', clientProjectId)
    .order('display_order', { ascending: true })

  return (data || []) as DashboardTask[]
}

// ============================================================================
// Score Snapshots
// ============================================================================

/**
 * Create the initial score snapshot for a project from its diagnostic audit
 */
export async function createInitialSnapshot(
  clientProjectId: string,
  auditData: Record<string, unknown>
): Promise<{ snapshotId: string | null; error?: string }> {
  const categoryScores = extractCategoryScores(auditData)
  const overallScore = calculateOverallScore(categoryScores)
  const dreamOutcomeGap = calculateDreamOutcomeGap(categoryScores)

  const { data, error } = await supabaseAdmin
    .from('score_snapshots')
    .insert({
      client_project_id: clientProjectId,
      category_scores: categoryScores,
      overall_score: overallScore,
      dream_outcome_gap: dreamOutcomeGap,
      trigger: 'initial',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating initial snapshot:', error)
    return { snapshotId: null, error: error.message }
  }

  return { snapshotId: data.id }
}

/**
 * Get all score snapshots for a project
 */
export async function getScoreSnapshots(
  clientProjectId: string
): Promise<ScoreSnapshot[]> {
  const { data } = await supabaseAdmin
    .from('score_snapshots')
    .select('*')
    .eq('client_project_id', clientProjectId)
    .order('snapshot_date', { ascending: true })

  return (data || []) as ScoreSnapshot[]
}

// ============================================================================
// Admin: Dashboard Generation
// ============================================================================

/**
 * Generate a complete dashboard for a client project:
 * 1. Create access token
 * 2. Create initial score snapshot from diagnostic audit
 */
export async function generateClientDashboard(
  clientProjectId: string
): Promise<{
  accessToken: string | null
  snapshotId: string | null
  error?: string
}> {
  // Fetch project
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('client_email, contact_submission_id')
    .eq('id', clientProjectId)
    .single()

  if (!project) {
    return { accessToken: null, snapshotId: null, error: 'Project not found' }
  }

  // Create access token
  const { access, error: accessError } = await generateDashboardAccess(
    clientProjectId,
    project.client_email
  )

  if (accessError || !access) {
    return { accessToken: null, snapshotId: null, error: accessError }
  }

  // Fetch diagnostic audit for initial scores
  let snapshotId: string | null = null
  if (project.contact_submission_id) {
    const { data: audit } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('*')
      .eq('contact_submission_id', project.contact_submission_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (audit) {
      const result = await createInitialSnapshot(clientProjectId, audit)
      snapshotId = result.snapshotId
    }
  }

  return {
    accessToken: access.access_token,
    snapshotId,
  }
}
