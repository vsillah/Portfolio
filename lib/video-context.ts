/**
 * Video personalization context — aggregates portfolio data for script generation.
 * Extends client-email-context with diagnostic, proposal, and sales session data.
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface VideoContextProject {
  id: string | null
  client_name: string | null
  client_email: string
  client_company: string | null
  project_name: string | null
  project_status: string | null
  current_phase: number | null
  product_purchased: string | null
  lead_id?: string
  service_interest?: string | null
  initial_message?: string | null
}

export interface VideoContext {
  found: boolean
  source_type: 'client_project' | 'lead' | 'campaign'
  project: VideoContextProject | null
  milestones: {
    total: number
    completed: number
    in_progress: number
    next_milestone: string | null
    schedule_status: string | null
  } | null
  last_meeting: {
    meeting_type: string
    meeting_date: string
    summary: string | null
    key_decisions: unknown[] | null
  } | null
  action_items: {
    pending: Array<{ title: string; owner: string | null; due_date: string | null }>
    recently_completed: Array<{ title: string; completed_at: string | null }>
  } | null
  diagnostic_audits?: Array<{
    id: number
    diagnostic_summary: string | null
    key_insights: string[] | null
    recommended_actions: string[] | null
    business_challenges: string[] | null
    urgency_score: number | null
    opportunity_score: number | null
  }>
  proposals?: Array<{
    id: string
    bundle_name: string
    line_items: unknown[]
    status: string
    total_amount: number
  }>
  sales_sessions?: Array<{
    id: string
    funnel_stage: string | null
    outcome: string | null
    objections_handled: string[] | null
  }>
  products?: unknown[]
  services?: unknown[]
  bundles?: unknown[]
}

/**
 * Fetch video personalization context by email.
 * Returns project/lead base context plus diagnostic, proposal, and sales session data.
 */
export async function fetchVideoContextByEmail(email: string): Promise<VideoContext> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return { found: false, source_type: 'lead', project: null, milestones: null, last_meeting: null, action_items: null }
  }

  // 1. Try client_project first
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('id, client_name, client_email, client_company, project_name, project_status, current_phase, product_purchased, contact_submission_id')
    .eq('client_email', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (project) {
    const ctx = await buildContextFromProject(project)
    return ctx
  }

  // 2. Fallback: lead (contact_submission)
  const { data: lead } = await supabaseAdmin
    .from('contact_submissions')
    .select('id, name, email, company, service_interest, message')
    .eq('email', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lead) {
    return { found: false, source_type: 'lead', project: null, milestones: null, last_meeting: null, action_items: null }
  }

  return buildContextFromLead(lead)
}

/**
 * Fetch video context by target type and ID.
 */
export async function fetchVideoContext(
  target: 'client_project' | 'lead' | 'campaign',
  id: string
): Promise<VideoContext> {
  if (target === 'client_project') {
    const { data: project } = await supabaseAdmin
      .from('client_projects')
      .select('id, client_name, client_email, client_company, project_name, project_status, current_phase, product_purchased, contact_submission_id')
      .eq('id', id)
      .single()
    if (project) return buildContextFromProject(project)
  }

  if (target === 'lead') {
    const { data: lead } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company, service_interest, message')
      .eq('id', id)
      .single()
    if (lead) return buildContextFromLead(lead)
  }

  if (target === 'campaign') {
    const [productsRes, servicesRes, bundlesRes] = await Promise.all([
      supabaseAdmin.from('products').select('id, title, description, type').eq('is_active', true).limit(20),
      supabaseAdmin.from('services').select('id, title, description, service_type').eq('is_active', true).limit(20),
      supabaseAdmin.from('offer_bundles').select('id, name, bundle_items').eq('is_active', true).limit(10),
    ])
    return {
      found: true,
      source_type: 'campaign',
      project: null,
      milestones: null,
      last_meeting: null,
      action_items: null,
      diagnostic_audits: [],
      proposals: [],
      sales_sessions: [],
      products: productsRes.data ?? [],
      services: servicesRes.data ?? [],
      bundles: bundlesRes.data ?? [],
    }
  }

  return { found: false, source_type: 'lead', project: null, milestones: null, last_meeting: null, action_items: null }
}

async function buildContextFromProject(project: {
  id: string
  client_name: string | null
  client_email: string
  client_company: string | null
  project_name: string | null
  project_status: string | null
  current_phase: number | null
  product_purchased: string | null
  contact_submission_id: string | null
}): Promise<VideoContext> {
  const contactId = project.contact_submission_id

  const [milestones, lastMeeting, actionItems, diagnostics, proposals, salesSessions] = await Promise.all([
    fetchMilestones(project.id),
    fetchLastMeeting(project.id),
    fetchActionItems(project.id),
    contactId ? fetchDiagnosticsByContact(contactId) : Promise.resolve([]),
    fetchProposalsByEmail(project.client_email),
    fetchSalesSessionsByProject(project.id),
  ])

  return {
    found: true,
    source_type: 'client_project',
    project: {
      id: project.id,
      client_name: project.client_name,
      client_email: project.client_email,
      client_company: project.client_company,
      project_name: project.project_name,
      project_status: project.project_status,
      current_phase: project.current_phase,
      product_purchased: project.product_purchased,
    },
    milestones,
    last_meeting: lastMeeting,
    action_items: actionItems,
    diagnostic_audits: diagnostics,
    proposals,
    sales_sessions: salesSessions,
  }
}

async function buildContextFromLead(lead: {
  id: string
  name: string | null
  email: string
  company: string | null
  service_interest: string | null
  message: string | null
}): Promise<VideoContext> {
  const [meetings, actionItems, diagnostics, proposals] = await Promise.all([
    fetchMeetingsByLead(lead.id),
    fetchActionItemsByLead(lead.id),
    fetchDiagnosticsByContact(lead.id),
    fetchProposalsByEmail(lead.email),
  ])

  const lastMeeting = meetings.length > 0
    ? {
        meeting_type: meetings[0].meeting_type,
        meeting_date: meetings[0].meeting_date,
        summary: (meetings[0].structured_notes as Record<string, unknown>)?.summary as string | null ?? null,
        key_decisions: meetings[0].key_decisions as unknown[] | null,
      }
    : null

  return {
    found: true,
    source_type: 'lead',
    project: {
      id: null,
      client_name: lead.name,
      client_email: lead.email,
      client_company: lead.company,
      project_name: null,
      project_status: null,
      current_phase: null,
      product_purchased: null,
      lead_id: lead.id,
      service_interest: lead.service_interest,
      initial_message: lead.message,
    },
    milestones: null,
    last_meeting: lastMeeting,
    action_items: actionItems,
    diagnostic_audits: diagnostics,
    proposals,
    sales_sessions: [],
  }
}

async function fetchMilestones(projectId: string) {
  const { data } = await supabaseAdmin
    .from('onboarding_plans')
    .select('milestones, status')
    .eq('client_project_id', projectId)
    .limit(1)
    .single()
  if (!data?.milestones || !Array.isArray(data.milestones)) return null
  const ms = data.milestones as Array<{ title?: string; status?: string }>
  const completed = ms.filter(m => m.status === 'complete').length
  const inProgress = ms.filter(m => m.status === 'in_progress').length
  const nextMs = ms.find(m => m.status !== 'complete')
  return {
    total: ms.length,
    completed,
    in_progress: inProgress,
    next_milestone: nextMs?.title ?? null,
    schedule_status: completed === ms.length ? 'complete' : inProgress > 0 ? 'in progress' : 'not started',
  }
}

async function fetchLastMeeting(projectId: string) {
  const { data } = await supabaseAdmin
    .from('meeting_records')
    .select('meeting_type, meeting_date, structured_notes, key_decisions')
    .eq('client_project_id', projectId)
    .order('meeting_date', { ascending: false })
    .limit(1)
    .single()
  if (!data) return null
  const notes = data.structured_notes as Record<string, unknown> | null
  const summary = notes?.summary as string | null ?? notes?.highlights as string | null ?? null
  return {
    meeting_type: data.meeting_type,
    meeting_date: data.meeting_date,
    summary,
    key_decisions: data.key_decisions as unknown[] | null,
  }
}

async function fetchActionItems(projectId: string) {
  const { data } = await supabaseAdmin
    .from('meeting_action_tasks')
    .select('title, owner, due_date, status, completed_at')
    .eq('client_project_id', projectId)
    .in('status', ['pending', 'in_progress', 'complete'])
    .order('display_order', { ascending: true })
    .limit(20)
  const tasks = (data || []) as Array<{ title: string; owner: string | null; due_date: string | null; status: string; completed_at: string | null }>
  if (tasks.length === 0) return null
  return {
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').map(t => ({ title: t.title, owner: t.owner, due_date: t.due_date })),
    recently_completed: tasks.filter(t => t.status === 'complete').slice(0, 5).map(t => ({ title: t.title, completed_at: t.completed_at })),
  }
}

async function fetchActionItemsByLead(leadId: string) {
  const { data: meetings } = await supabaseAdmin
    .from('meeting_records')
    .select('id')
    .eq('contact_submission_id', leadId)
  const meetingIds = (meetings || []).map((m: { id: string }) => m.id)
  if (meetingIds.length === 0) return null
  const { data } = await supabaseAdmin
    .from('meeting_action_tasks')
    .select('title, owner, due_date, status, completed_at')
    .in('meeting_record_id', meetingIds)
    .in('status', ['pending', 'in_progress', 'complete'])
    .order('display_order', { ascending: true })
    .limit(20)
  const tasks = (data || []) as Array<{ title: string; owner: string | null; due_date: string | null; status: string; completed_at: string | null }>
  if (tasks.length === 0) return null
  return {
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').map(t => ({ title: t.title, owner: t.owner, due_date: t.due_date })),
    recently_completed: tasks.filter(t => t.status === 'complete').slice(0, 5).map(t => ({ title: t.title, completed_at: t.completed_at })),
  }
}

async function fetchMeetingsByLead(leadId: string) {
  const { data } = await supabaseAdmin
    .from('meeting_records')
    .select('meeting_type, meeting_date, structured_notes, key_decisions')
    .eq('contact_submission_id', leadId)
    .order('meeting_date', { ascending: false })
    .limit(5)
  return data || []
}

async function fetchDiagnosticsByContact(contactId: string) {
  const { data } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id, diagnostic_summary, key_insights, recommended_actions, business_challenges, urgency_score, opportunity_score')
    .eq('contact_submission_id', contactId)
    .order('completed_at', { ascending: false, nullFirst: false })
    .limit(3)
  type Row = { id: number; diagnostic_summary: string | null; key_insights: unknown; recommended_actions: unknown; business_challenges: unknown; urgency_score: number | null; opportunity_score: number | null }
  return ((data || []) as Row[]).map(d => ({
    id: d.id,
    diagnostic_summary: d.diagnostic_summary,
    key_insights: d.key_insights as string[] | null,
    recommended_actions: d.recommended_actions as string[] | null,
    business_challenges: d.business_challenges as string[] | null,
    urgency_score: d.urgency_score,
    opportunity_score: d.opportunity_score,
  }))
}

async function fetchProposalsByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from('proposals')
    .select('id, bundle_name, line_items, status, total_amount')
    .eq('client_email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(5)
  type PropRow = { id: string; bundle_name: string; line_items: unknown; status: string; total_amount: number }
  return ((data || []) as PropRow[]).map(p => ({
    id: p.id,
    bundle_name: p.bundle_name,
    line_items: (p.line_items as unknown[]) || [],
    status: p.status,
    total_amount: Number(p.total_amount),
  }))
}

async function fetchSalesSessionsByProject(projectId: string) {
  const { data } = await supabaseAdmin
    .from('sales_sessions')
    .select('id, funnel_stage, outcome, objections_handled')
    .eq('client_project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(5)
  type SessionRow = { id: string; funnel_stage: string | null; outcome: string | null; objections_handled: unknown }
  return ((data || []) as SessionRow[]).map(s => ({
    id: s.id,
    funnel_stage: s.funnel_stage,
    outcome: s.outcome,
    objections_handled: s.objections_handled as string[] | null,
  }))
}
