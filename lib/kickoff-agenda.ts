/**
 * Kickoff Agenda Generator
 *
 * Resolves the best-matching kickoff agenda template, populates it with
 * project/onboarding data, and saves a per-project kickoff agenda.
 * Also creates provisioning_items from the onboarding plan's setup_requirements.
 */

import { supabaseAdmin } from './supabase'
import { n8nWebhookUrl } from './n8n'
import type {
  Milestone,
  CommunicationPlan,
  SetupRequirement,
  WinCondition,
  WarrantyTerms,
} from './onboarding-templates'

// ============================================================================
// Types
// ============================================================================

export interface KickoffAgendaTemplate {
  id: string
  name: string
  service_type: string | null
  content_type: string | null
  intro_script: string
  problem_statement: string
  timeline_script: string
  availability_script: string
  platform_signup_script: string
  wrapup_script: string
  estimated_duration_minutes: number
  is_active: boolean
}

export interface KickoffAgenda {
  id: string
  client_project_id: string
  template_id: string | null
  intro_script: string
  problem_statement: string
  timeline_script: string
  availability_script: string
  platform_signup_script: string
  wrapup_script: string
  estimated_duration_minutes: number
  status: 'draft' | 'ready' | 'used' | 'archived'
  used_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProvisioningItem {
  id: string
  client_project_id: string
  title: string
  description: string | null
  category: string
  is_client_action: boolean
  status: 'pending' | 'in_progress' | 'complete' | 'blocked' | 'skipped'
  completed_at: string | null
  completed_by: string | null
  blocker_note: string | null
  display_order: number
}

export interface KickoffContext {
  client_name: string
  client_email: string
  client_company: string | null
  project_name: string
  project_start_date: string | null
  estimated_end_date: string | null
  slack_channel: string | null
  sender_name: string
  dashboard_url: string | null
  milestones: Milestone[]
  communication_plan: CommunicationPlan | null
  setup_requirements: SetupRequirement[]
  win_conditions: WinCondition[]
  warranty: WarrantyTerms | null
}

// ============================================================================
// Template Resolution
// ============================================================================

async function resolveKickoffTemplate(
  serviceType: string | null,
  contentType: string | null
): Promise<KickoffAgendaTemplate | null> {
  // Try exact match first, then fallback to default (null service_type, null content_type)
  const candidates = [
    { service_type: serviceType, content_type: contentType },
    { service_type: serviceType, content_type: null },
    { service_type: null, content_type: null },
  ]

  for (const candidate of candidates) {
    let query = supabaseAdmin
      .from('kickoff_agenda_templates')
      .select('*')
      .eq('is_active', true)

    if (candidate.service_type) {
      query = query.eq('service_type', candidate.service_type)
    } else {
      query = query.is('service_type', null)
    }

    if (candidate.content_type) {
      query = query.eq('content_type', candidate.content_type)
    } else {
      query = query.is('content_type', null)
    }

    const { data, error } = await query.limit(1).maybeSingle()
    if (!error && data) return data as KickoffAgendaTemplate
  }

  return null
}

// ============================================================================
// Token Population
// ============================================================================

function populateTokens(template: string, ctx: KickoffContext): string {
  const startDate = ctx.project_start_date
    ? new Date(ctx.project_start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD'

  const endDate = ctx.estimated_end_date
    ? new Date(ctx.estimated_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD'

  const durationWeeks = ctx.project_start_date && ctx.estimated_end_date
    ? Math.ceil((new Date(ctx.estimated_end_date).getTime() - new Date(ctx.project_start_date).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0

  const milestonesSummary = ctx.milestones
    .map((m, i) => {
      const weekLabel = typeof m.week === 'number' ? `Week ${m.week}` : `Week ${m.week}`
      return `${i + 1}. ${weekLabel}: ${m.title} — ${m.description}`
    })
    .join('\n')

  const communicationChannel = ctx.slack_channel ? `Slack (#${ctx.slack_channel})` : 'email'

  const communicationDetails = ctx.communication_plan
    ? [
        `Cadence: ${ctx.communication_plan.cadence}`,
        `Channels: ${ctx.communication_plan.channels?.join(', ') || 'email'}`,
        ...ctx.communication_plan.meetings.map(
          (m) => `${m.type}: ${m.frequency}, ${m.duration_minutes} min — ${m.description}`
        ),
        ctx.communication_plan.escalation_path ? `Escalation: ${ctx.communication_plan.escalation_path}` : '',
      ].filter(Boolean).join('\n')
    : 'Daily updates Monday-Friday via ' + communicationChannel

  const platformChecklist = ctx.setup_requirements
    .filter((r) => r.is_client_action)
    .map((r, i) => `${i + 1}. ${r.title} — ${r.description}`)
    .join('\n')

  const winConditionsSummary = ctx.win_conditions
    .map((w) => `- ${w.metric}: ${w.target} (${w.timeframe})`)
    .join('\n')

  const warrantySummary = ctx.warranty
    ? `${ctx.warranty.duration_months}-month warranty: ${ctx.warranty.coverage_description}`
    : 'Standard warranty included'

  const firstUpdateDay = ctx.project_start_date
    ? 'tomorrow'
    : 'after project kickoff'

  const replacements: Record<string, string> = {
    '{{client_name}}': ctx.client_name,
    '{{client_company}}': ctx.client_company || ctx.client_name,
    '{{sender_name}}': ctx.sender_name,
    '{{project_name}}': ctx.project_name,
    '{{project_start_date}}': startDate,
    '{{estimated_end_date}}': endDate,
    '{{duration_weeks}}': String(durationWeeks),
    '{{estimated_duration}}': '30',
    '{{milestones_summary}}': milestonesSummary || 'Milestones will be shared after this call.',
    '{{communication_channel}}': communicationChannel,
    '{{communication_plan_details}}': communicationDetails,
    '{{platform_checklist}}': platformChecklist || 'No platform signups required for this engagement.',
    '{{win_conditions_summary}}': winConditionsSummary || 'Win conditions will be finalized during discovery.',
    '{{warranty_summary}}': warrantySummary,
    '{{first_update_day}}': firstUpdateDay,
    '{{dashboard_url}}': ctx.dashboard_url || 'Will be shared after this call',
  }

  let result = template
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replaceAll(token, value)
  }
  return result
}

// ============================================================================
// Generation
// ============================================================================

export async function generateKickoffAgenda(
  clientProjectId: string,
  senderName: string = 'Your Project Lead'
): Promise<{ agendaId: string; provisioningCount: number } | null> {
  // 1. Fetch project + onboarding plan
  const { data: project, error: projErr } = await supabaseAdmin
    .from('client_projects')
    .select('*')
    .eq('id', clientProjectId)
    .single()

  if (projErr || !project) {
    console.error('Project not found:', projErr)
    return null
  }

  const { data: plan } = await supabaseAdmin
    .from('onboarding_plans')
    .select('*, onboarding_plan_templates(name, service_type, content_type)')
    .eq('client_project_id', clientProjectId)
    .maybeSingle()

  // 2. Resolve template
  const serviceType = plan?.onboarding_plan_templates?.service_type || null
  const contentType = plan?.onboarding_plan_templates?.content_type || null
  const template = await resolveKickoffTemplate(serviceType, contentType)

  if (!template) {
    console.error('No kickoff agenda template found')
    return null
  }

  // 3. Build dashboard URL
  const { data: dashAccess } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('access_token')
    .eq('client_project_id', clientProjectId)
    .eq('is_active', true)
    .maybeSingle()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://amadutown.com'
  const dashboardUrl = dashAccess?.access_token
    ? `${baseUrl}/client/dashboard/${dashAccess.access_token}`
    : null

  // 4. Build context
  const ctx: KickoffContext = {
    client_name: project.client_name,
    client_email: project.client_email,
    client_company: project.client_company,
    project_name: project.project_name || project.product_purchased || 'Your Project',
    project_start_date: project.project_start_date,
    estimated_end_date: project.estimated_end_date,
    slack_channel: project.slack_channel,
    sender_name: senderName,
    dashboard_url: dashboardUrl,
    milestones: (plan?.milestones as Milestone[]) || [],
    communication_plan: (plan?.communication_plan as CommunicationPlan) || null,
    setup_requirements: (plan?.setup_requirements as SetupRequirement[]) || [],
    win_conditions: (plan?.win_conditions as WinCondition[]) || [],
    warranty: (plan?.warranty as WarrantyTerms) || null,
  }

  // 5. Populate template
  const agenda = {
    client_project_id: clientProjectId,
    template_id: template.id,
    intro_script: populateTokens(template.intro_script, ctx),
    problem_statement: populateTokens(template.problem_statement, ctx),
    timeline_script: populateTokens(template.timeline_script, ctx),
    availability_script: populateTokens(template.availability_script, ctx),
    platform_signup_script: populateTokens(template.platform_signup_script, ctx),
    wrapup_script: populateTokens(template.wrapup_script, ctx),
    estimated_duration_minutes: template.estimated_duration_minutes,
    status: 'draft' as const,
  }

  // 6. Upsert agenda (one per project)
  const { data: saved, error: saveErr } = await supabaseAdmin
    .from('kickoff_agendas')
    .upsert(agenda, { onConflict: 'client_project_id' })
    .select('id')
    .single()

  if (saveErr) {
    console.error('Error saving kickoff agenda:', saveErr)
    return null
  }

  // 7. Create provisioning items from setup_requirements
  const provisioningCount = await createProvisioningItems(clientProjectId, ctx.setup_requirements)

  return { agendaId: saved.id, provisioningCount }
}

// ============================================================================
// Provisioning Items
// ============================================================================

async function createProvisioningItems(
  clientProjectId: string,
  requirements: SetupRequirement[]
): Promise<number> {
  if (!requirements || requirements.length === 0) return 0

  // Delete existing items for this project (regeneration)
  await supabaseAdmin
    .from('provisioning_items')
    .delete()
    .eq('client_project_id', clientProjectId)

  const items = requirements.map((req, index) => ({
    client_project_id: clientProjectId,
    title: req.title,
    description: req.description,
    category: req.category,
    is_client_action: req.is_client_action,
    status: 'pending' as const,
    display_order: index,
  }))

  const { error } = await supabaseAdmin
    .from('provisioning_items')
    .insert(items)

  if (error) {
    console.error('Error creating provisioning items:', error)
    return 0
  }

  return items.length
}

export async function updateProvisioningItemStatus(
  itemId: string,
  status: 'pending' | 'in_progress' | 'complete' | 'blocked' | 'skipped',
  completedBy?: string,
  blockerNote?: string
): Promise<boolean> {
  const update: Record<string, unknown> = { status }

  if (status === 'complete') {
    update.completed_at = new Date().toISOString()
    if (completedBy) update.completed_by = completedBy
  } else {
    update.completed_at = null
    update.completed_by = null
  }

  if (status === 'blocked' && blockerNote) {
    update.blocker_note = blockerNote
  } else if (status !== 'blocked') {
    update.blocker_note = null
  }

  const { error } = await supabaseAdmin
    .from('provisioning_items')
    .update(update)
    .eq('id', itemId)

  if (error) {
    console.error('Error updating provisioning item:', error)
    return false
  }
  return true
}

export async function getProvisioningItems(
  clientProjectId: string
): Promise<ProvisioningItem[]> {
  const { data, error } = await supabaseAdmin
    .from('provisioning_items')
    .select('*')
    .eq('client_project_id', clientProjectId)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Error fetching provisioning items:', error)
    return []
  }
  return data as ProvisioningItem[]
}

// ============================================================================
// Offboarding
// ============================================================================

export async function initializeOffboarding(
  clientProjectId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('offboarding_checklists')
    .upsert(
      { client_project_id: clientProjectId, status: 'pending' },
      { onConflict: 'client_project_id' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Error initializing offboarding:', error)
    return null
  }
  return data.id
}

export type OffboardingStep =
  | 'delivery_confirmed'
  | 'client_confirmed'
  | 'warranty_activated'
  | 'access_revoked'
  | 'slack_archived'
  | 'final_invoice_sent'
  | 'completed'

export async function markOffboardingStep(
  clientProjectId: string,
  step: OffboardingStep
): Promise<boolean> {
  const columnMap: Record<OffboardingStep, string> = {
    delivery_confirmed: 'delivery_confirmed_at',
    client_confirmed: 'client_confirmed_at',
    warranty_activated: 'warranty_activated_at',
    access_revoked: 'access_revoked_at',
    slack_archived: 'slack_archived_at',
    final_invoice_sent: 'final_invoice_sent_at',
    completed: 'completed_at',
  }

  const column = columnMap[step]
  if (!column) return false

  const update: Record<string, unknown> = {
    [column]: new Date().toISOString(),
  }

  if (step === 'completed') {
    update.status = 'complete'
  } else {
    update.status = 'in_progress'
  }

  const { error } = await supabaseAdmin
    .from('offboarding_checklists')
    .update(update)
    .eq('client_project_id', clientProjectId)

  if (error) {
    console.error('Error marking offboarding step:', error)
    return false
  }
  return true
}

// ============================================================================
// Provisioning Reminder (n8n webhook)
// ============================================================================

/**
 * Fires the n8n provisioning reminder webhook for pending items.
 * Routes to Slack if the project has a channel, otherwise sends via email callback.
 */
export async function fireProvisioningReminder(
  clientProjectId: string
): Promise<{ triggered: boolean; message?: string; pendingCount?: number }> {
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('client_name, client_email, project_name, product_purchased, slack_channel')
    .eq('id', clientProjectId)
    .single()

  if (!project) {
    return { triggered: false, message: 'Project not found' }
  }

  const items = await getProvisioningItems(clientProjectId)
  const pendingItems = items.filter(
    (i) => i.status === 'pending' || i.status === 'in_progress'
  )

  if (pendingItems.length === 0) {
    return { triggered: false, message: 'No pending provisioning items', pendingCount: 0 }
  }

  const pendingList = pendingItems
    .map((i, idx) => `${idx + 1}. ${i.title}${i.is_client_action ? ' (client action)' : ''}`)
    .join('\n')

  const webhookUrl = process.env.N8N_PROVISIONING_REMINDER_WEBHOOK_URL
    || n8nWebhookUrl('provisioning-reminder')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://amadutown.com'

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: project.client_name,
        client_email: project.client_email,
        project_name: project.project_name || project.product_purchased || 'Your Project',
        pending_items: pendingList,
        slack_channel: project.slack_channel || '',
        callback_url: `${baseUrl}/api/admin/client-projects/${clientProjectId}/provisioning/reminder-callback`,
      }),
    })

    if (!response.ok) {
      return { triggered: false, message: `Webhook returned ${response.status}` }
    }

    return { triggered: true, pendingCount: pendingItems.length }
  } catch (err) {
    console.error('Error firing provisioning reminder webhook:', err)
    return { triggered: false, message: 'Webhook call failed' }
  }
}
