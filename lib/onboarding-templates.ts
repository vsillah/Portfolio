/**
 * Onboarding Plan Template Resolution & Generation
 * 
 * Resolves the best-matching onboarding plan template based on what the
 * client purchased, then populates it with real project data to create
 * a client-specific onboarding plan.
 */

import { supabaseAdmin } from './supabase'
import { getUpsellPathsForOffer, formatUpsellAsOnboardingNote, type UpsellPath } from './upsell-paths'

// ============================================================================
// Types
// ============================================================================

export interface OnboardingPlanTemplate {
  id: string
  name: string
  content_type: string
  service_type: string | null
  offer_role: string | null
  setup_requirements: SetupRequirement[]
  milestones_template: MilestoneTemplate[]
  communication_plan: CommunicationPlan
  win_conditions: WinCondition[]
  warranty: WarrantyTerms
  artifacts_handoff: ArtifactHandoff[]
  estimated_duration_weeks: number | null
  is_active: boolean
}

export interface SetupRequirement {
  title: string
  description: string
  category: string
  is_client_action: boolean
}

export interface MilestoneTemplate {
  week: number | string
  title: string
  description: string
  deliverables: string[]
  phase: number
}

export interface Milestone extends MilestoneTemplate {
  target_date?: string
  status: 'pending' | 'in_progress' | 'complete' | 'skipped'
}

export interface CommunicationPlan {
  cadence: string
  channels: string[]
  meetings: MeetingSchedule[]
  escalation_path: string
  ad_hoc?: string
}

export interface MeetingSchedule {
  type: string
  frequency: string
  duration_minutes: number
  description: string
}

export interface WinCondition {
  metric: string
  target: string
  measurement_method: string
  timeframe: string
}

export interface WarrantyTerms {
  duration_months: number
  coverage_description: string
  exclusions: string[]
  extended_support_available: boolean
  extended_support_description: string
}

export interface ArtifactHandoff {
  artifact: string
  format: string
  description: string
  delivery_method: string
}

export interface ProposalLineItem {
  content_type: string
  content_id: string
  title: string
  description?: string
  offer_role?: string
  price: number
  perceived_value?: number
}

export interface ProposalContext {
  id: string
  client_name: string
  client_email: string
  client_company?: string
  bundle_name: string
  line_items: ProposalLineItem[]
  total_amount: number
  sales_session_id?: string
}

export interface ClientProjectContext {
  id: string
  client_name: string
  client_email: string
  client_company?: string
  project_start_date?: string
  estimated_end_date?: string
  product_purchased?: string
}

export interface GeneratedOnboardingPlan {
  template_id: string
  setup_requirements: SetupRequirement[]
  milestones: Milestone[]
  communication_plan: CommunicationPlan
  win_conditions: WinCondition[]
  warranty: WarrantyTerms
  artifacts_handoff: ArtifactHandoff[]
}

// ============================================================================
// Template Resolution
// ============================================================================

/**
 * Resolves the best-matching onboarding plan template based on the proposal.
 * 
 * Priority:
 * 1. Exact match on content_type + service_type + offer_role
 * 2. Match on content_type + service_type (any offer_role)
 * 3. Match on content_type (any service_type)
 * 4. Fallback to 'product' default template
 */
export async function resolveOnboardingTemplate(
  proposal: ProposalContext
): Promise<OnboardingPlanTemplate | null> {
  // Find the primary item (core_offer, or highest-priced item)
  const primaryItem = findPrimaryItem(proposal.line_items)
  
  if (!primaryItem) {
    console.error('No line items found in proposal')
    return null
  }

  const contentType = primaryItem.content_type
  const offerRole = primaryItem.offer_role || 'core_offer'

  // If it's a service, look up the service_type from the database
  let serviceType: string | null = null
  if (contentType === 'service') {
    serviceType = await lookupServiceType(primaryItem.content_id)
  }

  // Try progressively broader matches
  const template = await findTemplate(contentType, serviceType, offerRole)
    || await findTemplate(contentType, serviceType, null)
    || await findTemplate(contentType, null, null)
    || await findTemplate('product', null, null) // ultimate fallback

  return template
}

/**
 * Find the primary item from proposal line items.
 * Prefers 'core_offer' role, then falls back to highest-priced item.
 */
function findPrimaryItem(lineItems: ProposalLineItem[]): ProposalLineItem | null {
  if (!lineItems || lineItems.length === 0) return null

  // Prefer core_offer
  const coreOffer = lineItems.find(item => item.offer_role === 'core_offer')
  if (coreOffer) return coreOffer

  // Fall back to highest-priced item
  return lineItems.reduce((max, item) => item.price > max.price ? item : max, lineItems[0])
}

/**
 * Look up the service_type for a service by its ID.
 */
async function lookupServiceType(serviceId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('services')
      .select('service_type')
      .eq('id', serviceId)
      .single()

    if (error || !data) return null
    return data.service_type
  } catch {
    return null
  }
}

/**
 * Find a template matching the given criteria.
 */
async function findTemplate(
  contentType: string,
  serviceType: string | null,
  offerRole: string | null
): Promise<OnboardingPlanTemplate | null> {
  try {
    let query = supabaseAdmin
      .from('onboarding_plan_templates')
      .select('*')
      .eq('content_type', contentType)
      .eq('is_active', true)

    if (serviceType) {
      query = query.eq('service_type', serviceType)
    } else {
      query = query.is('service_type', null)
    }

    if (offerRole) {
      query = query.eq('offer_role', offerRole)
    } else {
      query = query.is('offer_role', null)
    }

    const { data, error } = await query.limit(1).single()

    if (error || !data) return null
    return data as OnboardingPlanTemplate
  } catch {
    return null
  }
}

// ============================================================================
// Plan Generation
// ============================================================================

/**
 * Generates a fully populated onboarding plan from a template and project context.
 */
export function generateOnboardingPlan(
  template: OnboardingPlanTemplate,
  project: ClientProjectContext,
  proposal: ProposalContext
): GeneratedOnboardingPlan {
  const startDate = project.project_start_date
    ? new Date(project.project_start_date)
    : addDays(new Date(), 7) // Default: 1 week from now

  return {
    template_id: template.id,
    setup_requirements: resolveSetupRequirements(template, proposal),
    milestones: resolveMilestones(template, proposal, startDate),
    communication_plan: resolveCommunicationPlan(template, proposal),
    win_conditions: resolveWinConditions(template, proposal),
    warranty: resolveWarranty(template),
    artifacts_handoff: resolveArtifactsHandoff(template, proposal),
  }
}

/**
 * Resolve setup requirements -- template defaults + any per-item access needs.
 */
function resolveSetupRequirements(
  template: OnboardingPlanTemplate,
  proposal: ProposalContext
): SetupRequirement[] {
  const requirements = [...template.setup_requirements]

  // Add requirements for any additional integrations based on line items
  const hasMultipleServices = proposal.line_items.filter(
    i => i.content_type === 'service'
  ).length > 1

  if (hasMultipleServices) {
    requirements.push({
      title: 'Multi-Service Coordination',
      description: 'This engagement includes multiple services. We will coordinate a unified onboarding experience across all deliverables.',
      category: 'coordination',
      is_client_action: false,
    })
  }

  return requirements
}

/**
 * Resolve milestones -- calculate target dates from template week offsets.
 */
function resolveMilestones(
  template: OnboardingPlanTemplate,
  proposal: ProposalContext,
  startDate: Date
): Milestone[] {
  return template.milestones_template.map((mt) => {
    // Parse week number (could be "2-3" or "8-12" for ranges, or "Monthly")
    const weekNum = typeof mt.week === 'number'
      ? mt.week
      : parseInt(String(mt.week), 10) || null

    let targetDate: string | undefined
    if (weekNum) {
      const date = addDays(startDate, (weekNum - 1) * 7)
      targetDate = date.toISOString()
    }

    // Enhance deliverables with actual line item titles where applicable
    const deliverables = [...mt.deliverables]

    return {
      ...mt,
      target_date: targetDate,
      status: 'pending' as const,
      deliverables,
    }
  })
}

/**
 * Resolve communication plan -- scale cadence based on project complexity.
 */
function resolveCommunicationPlan(
  template: OnboardingPlanTemplate,
  proposal: ProposalContext
): CommunicationPlan {
  const plan = { ...template.communication_plan }

  // Scale communication based on project value
  const isHighValue = proposal.total_amount >= 5000
  const isMidValue = proposal.total_amount >= 2000

  if (isHighValue && plan.cadence !== 'weekly') {
    plan.cadence = 'weekly'
  } else if (!isMidValue && plan.cadence === 'weekly') {
    plan.cadence = 'bi-weekly'
  }

  return plan
}

/**
 * Resolve win conditions -- use template defaults.
 * Future: augment with diagnostic_audit recommended_actions.
 */
function resolveWinConditions(
  template: OnboardingPlanTemplate,
  _proposal: ProposalContext
): WinCondition[] {
  return [...template.win_conditions]
}

/**
 * Resolve warranty terms from template.
 */
function resolveWarranty(template: OnboardingPlanTemplate): WarrantyTerms {
  return { ...template.warranty }
}

/**
 * Resolve artifacts handoff -- template defaults + per-item artifacts.
 */
function resolveArtifactsHandoff(
  template: OnboardingPlanTemplate,
  proposal: ProposalContext
): ArtifactHandoff[] {
  const artifacts = [...template.artifacts_handoff]

  // Add artifacts for bonus/upsell items that include their own deliverables
  const additionalItems = proposal.line_items.filter(
    i => i.offer_role && ['bonus', 'upsell', 'continuity'].includes(i.offer_role)
  )

  for (const item of additionalItems) {
    artifacts.push({
      artifact: item.title,
      format: 'As specified',
      description: item.description || `Included ${item.offer_role} deliverable.`,
      delivery_method: 'Shared project folder',
    })
  }

  return artifacts
}

// ============================================================================
// Persistence
// ============================================================================

/**
 * Creates the onboarding plan record in the database.
 */
export async function saveOnboardingPlan(
  clientProjectId: string,
  plan: GeneratedOnboardingPlan
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('onboarding_plans')
      .insert({
        client_project_id: clientProjectId,
        template_id: plan.template_id,
        setup_requirements: plan.setup_requirements,
        milestones: plan.milestones,
        communication_plan: plan.communication_plan,
        win_conditions: plan.win_conditions,
        warranty: plan.warranty,
        artifacts_handoff: plan.artifacts_handoff,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error saving onboarding plan:', error)
      return null
    }

    // Link the plan to the client project
    await supabaseAdmin
      .from('client_projects')
      .update({ onboarding_plan_id: data.id })
      .eq('id', clientProjectId)

    return { id: data.id }
  } catch (error) {
    console.error('Error in saveOnboardingPlan:', error)
    return null
  }
}

/**
 * Full orchestration: resolve template, generate plan, save to DB.
 */
export async function createOnboardingPlanForProject(
  project: ClientProjectContext,
  proposal: ProposalContext
): Promise<{ planId: string; templateName: string } | null> {
  // 1. Resolve the best template
  const template = await resolveOnboardingTemplate(proposal)
  if (!template) {
    console.error('No onboarding template found for proposal:', proposal.id)
    return null
  }

  // 2. Generate the populated plan
  const plan = generateOnboardingPlan(template, project, proposal)

  // 2b. Inject upsell upgrade milestone if any line items have upsell paths
  try {
    const upsellNotes: string[] = []
    for (const item of proposal.line_items) {
      if (item.content_type && item.content_id) {
        const paths = await getUpsellPathsForOffer(item.content_type, String(item.content_id))
        for (const path of paths) {
          upsellNotes.push(formatUpsellAsOnboardingNote(path))
        }
      }
    }
    if (upsellNotes.length > 0) {
      // Add as the final milestone
      const lastMilestone = plan.milestones[plan.milestones.length - 1]
      const lastWeek = typeof lastMilestone?.week === 'number' ? lastMilestone.week : 8
      plan.milestones.push({
        week: lastWeek + 1,
        title: 'Recommended Upgrade Review',
        description: 'Review upgrade options based on your experience with the current deliverables.',
        deliverables: upsellNotes,
        phase: (lastMilestone?.phase || 3) + 1,
        status: 'pending',
      })
    }
  } catch (upsellError) {
    console.error('Error injecting upsell milestones:', upsellError)
    // Non-critical — continue without upsell milestones
  }

  // 3. Save to database
  const result = await saveOnboardingPlan(project.id, plan)
  if (!result) return null

  return {
    planId: result.id,
    templateName: template.name,
  }
}

// ============================================================================
// n8n Webhook Trigger
// ============================================================================

export interface OnboardingWebhookPayload {
  onboarding_plan_id: string
  onboarding_plan_url: string
  pdf_url: string
  client_name: string
  client_email: string
  client_company: string | null
  project_name: string
  milestones_summary: string
  kickoff_date: string | null
  template_name: string
}

/**
 * Fire the n8n webhook to trigger email delivery of the onboarding plan.
 */
export async function fireOnboardingWebhook(
  payload: OnboardingWebhookPayload
): Promise<boolean> {
  const webhookUrl = process.env.N8N_ONBOARDING_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('N8N_ONBOARDING_WEBHOOK_URL not configured, skipping webhook')
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('n8n webhook failed:', response.status, await response.text())
      return false
    }

    // Update the plan with webhook timestamp
    await supabaseAdmin
      .from('onboarding_plans')
      .update({ n8n_webhook_fired_at: new Date().toISOString() })
      .eq('id', payload.onboarding_plan_id)

    return true
  } catch (error) {
    console.error('Error firing n8n webhook:', error)
    return false
  }
}

/**
 * Build a human-readable milestones summary for the email.
 */
export function buildMilestonesSummary(milestones: Milestone[]): string {
  return milestones
    .map((m) => {
      const weekLabel = typeof m.week === 'number' ? `Week ${m.week}` : `Week ${m.week}`
      return `${weekLabel}: ${m.title}`
    })
    .join('\n')
}

// ============================================================================
// Utilities
// ============================================================================

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
