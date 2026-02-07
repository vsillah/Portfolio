/**
 * Progress Update Template Resolution, Rendering & Delivery
 *
 * Resolves the best-matching progress update template based on the update type
 * and project context, populates dynamic tokens, and fires the n8n webhook
 * for email or Slack delivery.
 */

import { supabaseAdmin } from './supabase'
import type {
  Milestone,
  CommunicationPlan,
  WarrantyTerms,
  ArtifactHandoff,
} from './onboarding-templates'

// ============================================================================
// Types
// ============================================================================

export type ProgressUpdateType =
  | 'milestone_completed'
  | 'ahead_of_schedule'
  | 'on_schedule'
  | 'behind_schedule'
  | 'project_delivery'
  | 'warranty_start'

export interface ProgressUpdateTemplate {
  id: string
  update_type: ProgressUpdateType
  content_type: string | null
  service_type: string | null
  tone: 'casual' | 'professional' | 'celebratory'
  email_subject: string
  email_body: string
  slack_body: string
  is_active: boolean
}

export interface ProgressUpdateAttachment {
  url: string
  filename: string
  content_type: string
}

export interface ProgressUpdateContext {
  // Client info
  client_name: string
  client_email: string
  client_company: string | null
  project_name: string
  slack_channel: string | null

  // Milestone info
  completed_milestone: string
  completed_deliverables: string[]
  next_milestone: string | null
  next_milestone_date: string | null
  milestones_progress: string
  schedule_status: string
  milestone_index: number

  // Plan details
  communication_cadence: string
  warranty_summary: string
  artifacts_ready: string

  // Personalization
  sender_name: string
  custom_note: string
  attachment_note: string
  attachments: ProgressUpdateAttachment[]
}

export interface RenderedProgressUpdate {
  emailSubject: string
  emailBody: string
  slackBody: string
}

export interface ProgressUpdateWebhookPayload {
  client_project_id: string
  client_name: string
  client_email: string
  client_company: string | null
  slack_channel: string | null
  channel: 'slack' | 'email'
  update_type: ProgressUpdateType
  email_subject: string
  email_body: string
  slack_body: string
  milestone_index: number
  milestones_progress: string
  attachments: ProgressUpdateAttachment[]
  callback_url: string
}

export interface ProgressUpdateLogEntry {
  client_project_id: string
  onboarding_plan_id: string | null
  template_id: string | null
  update_type: ProgressUpdateType
  channel: 'slack' | 'email'
  milestone_index: number
  rendered_subject: string | null
  rendered_body: string
  attachments: ProgressUpdateAttachment[]
  custom_note: string | null
  delivery_status: 'pending' | 'sent' | 'failed' | 'skipped'
  n8n_webhook_fired_at: string | null
  triggered_by: 'admin' | 'slack_cmd' | 'system'
}

// ============================================================================
// Onboarding Plan context types (from DB joins)
// ============================================================================

export interface OnboardingPlanWithProject {
  id: string
  client_project_id: string
  template_id: string | null
  milestones: Milestone[]
  communication_plan: CommunicationPlan
  warranty: WarrantyTerms
  artifacts_handoff: ArtifactHandoff[]
  // Joined from client_projects
  client_name: string
  client_email: string
  client_company: string | null
  product_purchased: string | null
  slack_channel: string | null
  project_status: string
  // Joined from onboarding_plan_templates
  template_content_type: string | null
  template_service_type: string | null
}

// ============================================================================
// Template Resolution
// ============================================================================

/**
 * Resolves the best-matching progress update template.
 *
 * Priority:
 * 1. Exact match on update_type + content_type + service_type
 * 2. Match on update_type + content_type (any service_type)
 * 3. Match on update_type only (default template)
 */
export async function resolveProgressUpdateTemplate(
  updateType: ProgressUpdateType,
  contentType: string | null,
  serviceType: string | null
): Promise<ProgressUpdateTemplate | null> {
  const template =
    (await findProgressTemplate(updateType, contentType, serviceType)) ||
    (await findProgressTemplate(updateType, contentType, null)) ||
    (await findProgressTemplate(updateType, null, null))

  return template
}

async function findProgressTemplate(
  updateType: ProgressUpdateType,
  contentType: string | null,
  serviceType: string | null
): Promise<ProgressUpdateTemplate | null> {
  try {
    let query = supabaseAdmin
      .from('progress_update_templates')
      .select('*')
      .eq('update_type', updateType)
      .eq('is_active', true)

    if (contentType) {
      query = query.eq('content_type', contentType)
    } else {
      query = query.is('content_type', null)
    }

    if (serviceType) {
      query = query.eq('service_type', serviceType)
    } else {
      query = query.is('service_type', null)
    }

    const { data, error } = await query.limit(1).single()

    if (error || !data) return null
    return data as ProgressUpdateTemplate
  } catch {
    return null
  }
}

// ============================================================================
// Update Type Detection
// ============================================================================

/**
 * Determines the progress update type based on milestone changes.
 *
 * Compares old vs new milestone arrays to figure out what changed
 * and whether the completion is ahead of, on, or behind schedule.
 */
export function determineUpdateType(
  milestones: Milestone[],
  milestoneIndex: number,
  newStatus: string
): ProgressUpdateType {
  if (newStatus !== 'complete') {
    return 'milestone_completed' // default even for non-complete status changes
  }

  const milestone = milestones[milestoneIndex]
  if (!milestone) return 'milestone_completed'

  // Check if this is the last milestone
  const allOtherComplete = milestones.every(
    (m, i) => i === milestoneIndex || m.status === 'complete' || m.status === 'skipped'
  )
  if (allOtherComplete) {
    return 'project_delivery'
  }

  // Check schedule status
  if (milestone.target_date) {
    const targetDate = new Date(milestone.target_date)
    const now = new Date()
    const diffDays = Math.floor(
      (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays > 2) {
      return 'ahead_of_schedule'
    } else if (diffDays < -2) {
      return 'behind_schedule'
    }
  }

  return 'milestone_completed'
}

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Builds the dynamic token context map from the onboarding plan and project data.
 */
export function computeUpdateContext(
  plan: OnboardingPlanWithProject,
  milestoneIndex: number,
  senderName: string,
  customNote?: string,
  attachments?: ProgressUpdateAttachment[]
): ProgressUpdateContext {
  const milestones = plan.milestones || []
  const completedMilestone = milestones[milestoneIndex]

  // Find next pending/in_progress milestone
  const nextMilestone = milestones.find(
    (m, i) => i > milestoneIndex && (m.status === 'pending' || m.status === 'in_progress')
  )

  // Count completed milestones
  const completedCount = milestones.filter(
    (m) => m.status === 'complete'
  ).length
  const totalCount = milestones.length

  // Build schedule status string
  const scheduleStatus = computeScheduleStatus(completedMilestone)

  // Build warranty summary
  const warranty = plan.warranty
  let warrantySummary = ''
  if (warranty && warranty.duration_months > 0) {
    warrantySummary = `Your engagement includes a ${warranty.duration_months}-month warranty: ${warranty.coverage_description}`
  }

  // Build artifacts list
  const artifacts = plan.artifacts_handoff || []
  const artifactsReady = artifacts
    .map((a) => `- ${a.artifact} (${a.format}) -- ${a.delivery_method}`)
    .join('\n')

  // Build attachment note
  const hasAttachments = attachments && attachments.length > 0
  const attachmentNote = hasAttachments ? 'Attached a screenshot below :)' : ''

  return {
    client_name: plan.client_name,
    client_email: plan.client_email,
    client_company: plan.client_company,
    project_name: plan.product_purchased || 'your project',
    slack_channel: plan.slack_channel,

    completed_milestone: completedMilestone?.title || 'the current milestone',
    completed_deliverables: completedMilestone?.deliverables || [],
    next_milestone: nextMilestone?.title || null,
    next_milestone_date: nextMilestone?.target_date
      ? formatDate(nextMilestone.target_date)
      : null,
    milestones_progress: `${completedCount} of ${totalCount} milestones complete`,
    schedule_status: scheduleStatus,
    milestone_index: milestoneIndex,

    communication_cadence: plan.communication_plan?.cadence || 'as-needed',
    warranty_summary: warrantySummary,
    artifacts_ready: artifactsReady || 'Artifacts will be delivered upon project completion.',

    sender_name: senderName,
    custom_note: customNote || '',
    attachment_note: attachmentNote,
    attachments: attachments || [],
  }
}

function computeScheduleStatus(milestone: Milestone | undefined): string {
  if (!milestone || !milestone.target_date) return 'on track'

  const targetDate = new Date(milestone.target_date)
  const now = new Date()
  const diffDays = Math.floor(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays > 2) return 'ahead of schedule'
  if (diffDays < -2) return 'slightly behind schedule'
  return 'on track'
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Replaces {{token}} placeholders in template strings with context values.
 */
export function renderProgressUpdate(
  template: ProgressUpdateTemplate,
  context: ProgressUpdateContext
): RenderedProgressUpdate {
  const tokenMap: Record<string, string> = {
    '{{client_name}}': context.client_name,
    '{{project_name}}': context.project_name,
    '{{completed_milestone}}': context.completed_milestone,
    '{{completed_deliverables}}': context.completed_deliverables
      .map((d) => `- ${d}`)
      .join('\n'),
    '{{next_milestone}}': context.next_milestone || 'project wrap-up',
    '{{next_milestone_date}}': context.next_milestone_date || 'soon',
    '{{schedule_status}}': context.schedule_status,
    '{{schedule_status_note}}':
      context.schedule_status !== 'on track'
        ? `(${context.schedule_status})`
        : '',
    '{{schedule_status_emoji}}':
      context.schedule_status === 'ahead of schedule'
        ? ':rocket:'
        : context.schedule_status === 'slightly behind schedule'
          ? ':hourglass:'
          : ':white_check_mark:',
    '{{milestones_progress}}': context.milestones_progress,
    '{{warranty_summary}}': context.warranty_summary,
    '{{warranty_note}}': context.warranty_summary
      ? `\n${context.warranty_summary}\n`
      : '',
    '{{artifacts_ready}}': context.artifacts_ready,
    '{{artifacts_count}}': String(
      (context.artifacts_ready.match(/^- /gm) || []).length
    ),
    '{{communication_cadence}}': context.communication_cadence,
    '{{sender_name}}': context.sender_name,
    '{{custom_note}}': context.custom_note ? `\n${context.custom_note}\n` : '',
    '{{attachment_note}}': context.attachment_note
      ? `\n${context.attachment_note}`
      : '',
    '{{attachments}}': context.attachments
      .map((a) => `- ${a.filename}: ${a.url}`)
      .join('\n'),
  }

  return {
    emailSubject: replaceTokens(template.email_subject, tokenMap),
    emailBody: cleanRenderedText(replaceTokens(template.email_body, tokenMap)),
    slackBody: cleanRenderedText(replaceTokens(template.slack_body, tokenMap)),
  }
}

function replaceTokens(
  text: string,
  tokenMap: Record<string, string>
): string {
  let result = text
  for (const [token, value] of Object.entries(tokenMap)) {
    result = result.split(token).join(value)
  }
  return result
}

/**
 * Clean up rendered text: collapse multiple blank lines, trim edges.
 */
function cleanRenderedText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n') // collapse 3+ newlines to 2
    .trim()
}

// ============================================================================
// Webhook Firing
// ============================================================================

/**
 * Fire the n8n webhook to deliver the progress update via email or Slack.
 */
export async function fireProgressUpdateWebhook(
  payload: ProgressUpdateWebhookPayload
): Promise<boolean> {
  const webhookUrl = process.env.N8N_PROGRESS_UPDATE_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn(
      'N8N_PROGRESS_UPDATE_WEBHOOK_URL not configured, skipping webhook'
    )
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(
        'Progress update webhook failed:',
        response.status,
        await response.text()
      )
      return false
    }

    return true
  } catch (error) {
    console.error('Error firing progress update webhook:', error)
    return false
  }
}

// ============================================================================
// Persistence: Log Entry
// ============================================================================

/**
 * Create a progress update log entry in the database.
 */
export async function createProgressUpdateLog(
  entry: ProgressUpdateLogEntry
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('progress_update_log')
      .insert(entry)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating progress update log:', error)
      return null
    }

    return { id: data.id }
  } catch (error) {
    console.error('Error in createProgressUpdateLog:', error)
    return null
  }
}

/**
 * Update progress update log delivery status (called by n8n callback).
 */
export async function updateProgressUpdateLogStatus(
  logId: string,
  status: 'sent' | 'failed',
  errorMessage?: string
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      delivery_status: status,
    }
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    }
    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { error } = await supabaseAdmin
      .from('progress_update_log')
      .update(updateData)
      .eq('id', logId)

    if (error) {
      console.error('Error updating progress update log:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in updateProgressUpdateLogStatus:', error)
    return false
  }
}

// ============================================================================
// Fetch Plan with Project Context
// ============================================================================

/**
 * Fetch the onboarding plan with full project context for a given client project.
 */
export async function fetchPlanWithProjectContext(
  clientProjectId: string
): Promise<OnboardingPlanWithProject | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('onboarding_plans')
      .select(
        `
        id,
        client_project_id,
        template_id,
        milestones,
        communication_plan,
        warranty,
        artifacts_handoff,
        client_projects (
          client_name,
          client_email,
          client_company,
          product_purchased,
          slack_channel,
          project_status
        ),
        onboarding_plan_templates (
          content_type,
          service_type
        )
      `
      )
      .eq('client_project_id', clientProjectId)
      .single()

    if (error || !data) {
      console.error('Error fetching plan with project context:', error)
      return null
    }

    // Flatten the joined data
    const project = data.client_projects as Record<string, unknown> | null
    const template = data.onboarding_plan_templates as Record<string, unknown> | null

    return {
      id: data.id,
      client_project_id: data.client_project_id,
      template_id: data.template_id,
      milestones: (data.milestones || []) as Milestone[],
      communication_plan: (data.communication_plan || {}) as CommunicationPlan,
      warranty: (data.warranty || {}) as WarrantyTerms,
      artifacts_handoff: (data.artifacts_handoff || []) as ArtifactHandoff[],
      client_name: (project?.client_name as string) || 'Client',
      client_email: (project?.client_email as string) || '',
      client_company: (project?.client_company as string) || null,
      product_purchased: (project?.product_purchased as string) || null,
      slack_channel: (project?.slack_channel as string) || null,
      project_status: (project?.project_status as string) || 'active',
      template_content_type: (template?.content_type as string) || null,
      template_service_type: (template?.service_type as string) || null,
    }
  } catch (error) {
    console.error('Error in fetchPlanWithProjectContext:', error)
    return null
  }
}

// ============================================================================
// Full Orchestration
// ============================================================================

/**
 * Full orchestration: determine update type, resolve template, build context,
 * render message, fire webhook, and log the update.
 *
 * Returns the log entry ID on success, null on failure.
 */
export async function triggerProgressUpdate(params: {
  clientProjectId: string
  milestoneIndex: number
  newStatus: string
  senderName: string
  customNote?: string
  attachments?: ProgressUpdateAttachment[]
  triggeredBy?: 'admin' | 'slack_cmd' | 'system'
}): Promise<{ logId: string; channel: string; updateType: string } | null> {
  const {
    clientProjectId,
    milestoneIndex,
    newStatus,
    senderName,
    customNote,
    attachments,
    triggeredBy = 'admin',
  } = params

  // 1. Fetch plan with project context
  const plan = await fetchPlanWithProjectContext(clientProjectId)
  if (!plan) {
    console.error('No onboarding plan found for project:', clientProjectId)
    return null
  }

  // 2. Determine update type
  const updateType = determineUpdateType(
    plan.milestones,
    milestoneIndex,
    newStatus
  )

  // 3. Resolve the best template
  const template = await resolveProgressUpdateTemplate(
    updateType,
    plan.template_content_type,
    plan.template_service_type
  )
  if (!template) {
    console.error('No progress update template found for type:', updateType)
    return null
  }

  // 4. Build context
  const context = computeUpdateContext(
    plan,
    milestoneIndex,
    senderName,
    customNote,
    attachments
  )

  // 5. Render message
  const rendered = renderProgressUpdate(template, context)

  // 6. Determine channel
  const channel: 'slack' | 'email' = plan.slack_channel ? 'slack' : 'email'

  // 7. Build callback URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // 8. Create log entry (pre-send, status=pending)
  const logEntry: ProgressUpdateLogEntry = {
    client_project_id: clientProjectId,
    onboarding_plan_id: plan.id,
    template_id: template.id,
    update_type: updateType,
    channel,
    milestone_index: milestoneIndex,
    rendered_subject: rendered.emailSubject,
    rendered_body: channel === 'slack' ? rendered.slackBody : rendered.emailBody,
    attachments: attachments || [],
    custom_note: customNote || null,
    delivery_status: 'pending',
    n8n_webhook_fired_at: null,
    triggered_by: triggeredBy,
  }

  const logResult = await createProgressUpdateLog(logEntry)
  if (!logResult) {
    console.error('Failed to create progress update log entry')
    return null
  }

  // 9. Fire n8n webhook
  const callbackUrl = `${baseUrl}/api/progress-updates/${logResult.id}/delivered`

  const webhookPayload: ProgressUpdateWebhookPayload = {
    client_project_id: clientProjectId,
    client_name: plan.client_name,
    client_email: plan.client_email,
    client_company: plan.client_company,
    slack_channel: plan.slack_channel,
    channel,
    update_type: updateType,
    email_subject: rendered.emailSubject,
    email_body: rendered.emailBody,
    slack_body: rendered.slackBody,
    milestone_index: milestoneIndex,
    milestones_progress: context.milestones_progress,
    attachments: attachments || [],
    callback_url: callbackUrl,
  }

  const webhookFired = await fireProgressUpdateWebhook(webhookPayload)

  // Update log with webhook timestamp
  if (webhookFired) {
    await supabaseAdmin
      .from('progress_update_log')
      .update({ n8n_webhook_fired_at: new Date().toISOString() })
      .eq('id', logResult.id)
  } else {
    await supabaseAdmin
      .from('progress_update_log')
      .update({
        delivery_status: 'failed',
        error_message: 'Failed to fire n8n webhook',
      })
      .eq('id', logResult.id)
  }

  return {
    logId: logResult.id,
    channel,
    updateType,
  }
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
