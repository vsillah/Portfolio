import { supabaseAdmin } from './supabase'
import {
  buildClientRoadmapView,
  buildDefaultClientAiOpsRoadmap,
  dashboardStatusFromRoadmap,
  meetingTaskStatusFromRoadmap,
  roadmapStatusFromProjectedTask,
  rollUpRoadmapCosts,
  type RoadmapClientView,
  type RoadmapTaskStatus,
} from './client-ai-ops-roadmap'

type JsonRecord = Record<string, unknown>

export interface RoadmapBundle {
  roadmap: JsonRecord
  phases: JsonRecord[]
  tasks: JsonRecord[]
  costItems: JsonRecord[]
  reports: JsonRecord[]
  clientView: RoadmapClientView
}

function requireDb() {
  if (!supabaseAdmin) throw new Error('Database not available')
  return supabaseAdmin
}

function phaseStatusFromTasks(tasks: Array<{ status: string }>): string {
  if (tasks.length === 0) return 'pending'
  if (tasks.every((task) => task.status === 'complete' || task.status === 'cancelled')) return 'complete'
  if (tasks.some((task) => task.status === 'blocked')) return 'blocked'
  if (tasks.some((task) => task.status === 'in_progress' || task.status === 'complete')) return 'in_progress'
  return 'pending'
}

export async function getRoadmapBundleForProject(clientProjectId: string): Promise<RoadmapBundle | null> {
  const db = requireDb()
  const { data: roadmap, error } = await db
    .from('client_ai_ops_roadmaps')
    .select('*')
    .eq('client_project_id', clientProjectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch AI Ops roadmap: ${error.message}`)
  if (!roadmap) return null

  const [phasesRes, tasksRes, costsRes, reportsRes] = await Promise.all([
    db
      .from('client_ai_ops_roadmap_phases')
      .select('*')
      .eq('roadmap_id', roadmap.id)
      .order('phase_order', { ascending: true }),
    db
      .from('client_ai_ops_roadmap_tasks')
      .select('*')
      .eq('roadmap_id', roadmap.id)
      .order('created_at', { ascending: true }),
    db
      .from('client_ai_ops_roadmap_cost_items')
      .select('*')
      .eq('roadmap_id', roadmap.id)
      .order('created_at', { ascending: true }),
    db
      .from('client_ai_ops_roadmap_reports')
      .select('*')
      .eq('roadmap_id', roadmap.id)
      .order('generated_at', { ascending: false })
      .limit(6),
  ])

  if (phasesRes.error) throw new Error(`Failed to fetch roadmap phases: ${phasesRes.error.message}`)
  if (tasksRes.error) throw new Error(`Failed to fetch roadmap tasks: ${tasksRes.error.message}`)
  if (costsRes.error) throw new Error(`Failed to fetch roadmap costs: ${costsRes.error.message}`)
  if (reportsRes.error) throw new Error(`Failed to fetch roadmap reports: ${reportsRes.error.message}`)

  const phases = (phasesRes.data || []) as JsonRecord[]
  const tasks = (tasksRes.data || []) as JsonRecord[]
  const costItems = (costsRes.data || []) as JsonRecord[]

  return {
    roadmap: roadmap as JsonRecord,
    phases,
    tasks,
    costItems,
    reports: (reportsRes.data || []) as JsonRecord[],
    clientView: buildClientRoadmapView({
      roadmap: {
        title: roadmap.title,
        status: roadmap.status,
        client_summary: roadmap.client_summary,
      },
      phases: phases.map((phase) => ({
        id: phase.id as string,
        title: phase.title as string,
        objective: phase.objective as string,
        status: phase.status as never,
        phase_order: phase.phase_order as number,
        acceptance_criteria: phase.acceptance_criteria as string[],
        estimated_client_startup_cost: phase.estimated_client_startup_cost as string | number | null,
        estimated_monthly_operating_cost: phase.estimated_monthly_operating_cost as string | number | null,
      })),
      tasks: tasks.map((task) => ({
        phase_id: task.phase_id as string,
        title: task.title as string,
        owner_type: task.owner_type as never,
        priority: task.priority as never,
        status: task.status as never,
        due_date: task.due_date as string | null,
        client_visible: Boolean(task.client_visible),
      })),
      costItems: costItems.map((item) => ({
        payer: item.payer as never,
        costType: item.cost_type as never,
        amount: item.amount == null ? null : Number(item.amount),
        category: item.category as never,
      })),
    }),
  }
}

export async function ensureRoadmapForProject(clientProjectId: string, options?: { generatedFrom?: string; userId?: string }): Promise<RoadmapBundle> {
  const existing = await getRoadmapBundleForProject(clientProjectId)
  if (existing) return existing

  const db = requireDb()
  const { data: project, error: projectError } = await db
    .from('client_projects')
    .select('id, project_name, client_name, client_company, contact_submission_id, proposal_id')
    .eq('id', clientProjectId)
    .single()

  if (projectError || !project) throw new Error('Client project not found')

  const draft = buildDefaultClientAiOpsRoadmap({
    clientName: project.client_name,
    clientCompany: project.client_company,
    projectName: project.project_name,
    clientProjectId,
    proposalId: project.proposal_id,
    contactSubmissionId: project.contact_submission_id,
  })

  const { data: roadmap, error: roadmapError } = await db
    .from('client_ai_ops_roadmaps')
    .insert({
      client_project_id: clientProjectId,
      proposal_id: project.proposal_id ?? null,
      contact_submission_id: project.contact_submission_id ?? null,
      title: draft.title,
      status: 'active',
      generated_from: options?.generatedFrom ?? 'manual',
      client_summary: draft.clientSummary,
      snapshot: { input_hash: draft.inputHash },
      created_by: options?.userId ?? null,
    })
    .select('*')
    .single()

  if (roadmapError || !roadmap) throw new Error(`Failed to create AI Ops roadmap: ${roadmapError?.message}`)

  const { data: phases, error: phasesError } = await db
    .from('client_ai_ops_roadmap_phases')
    .insert(
      draft.phases.map((phase) => ({
        roadmap_id: roadmap.id,
        phase_key: phase.phaseKey,
        phase_order: phase.phaseOrder,
        title: phase.title,
        objective: phase.objective,
        status: phase.status,
        acceptance_criteria: phase.acceptanceCriteria,
      })),
    )
    .select('*')

  if (phasesError || !phases) throw new Error(`Failed to create AI Ops roadmap phases: ${phasesError?.message}`)

  const phaseByKey = new Map<string, JsonRecord>(phases.map((phase: JsonRecord) => [phase.phase_key as string, phase]))
  const { data: tasks, error: tasksError } = await db
    .from('client_ai_ops_roadmap_tasks')
    .insert(
      draft.tasks.map((task) => ({
        roadmap_id: roadmap.id,
        phase_id: (phaseByKey.get(task.phaseKey)?.id as string | undefined) ?? null,
        task_key: task.taskKey,
        title: task.title,
        description: task.description,
        owner_type: task.ownerType,
        priority: task.priority,
        status: task.status,
        client_visible: task.clientVisible,
        meeting_task_visible: task.meetingTaskVisible,
        cost_category: task.costCategory,
        estimated_cost: task.estimatedCost,
        acceptance_criteria: task.acceptanceCriteria,
      })),
    )
    .select('*')

  if (tasksError || !tasks) throw new Error(`Failed to create AI Ops roadmap tasks: ${tasksError?.message}`)

  const taskByKey = new Map<string, JsonRecord>((tasks as JsonRecord[]).map((task) => [task.task_key as string, task]))
  const { error: costsError } = await db
    .from('client_ai_ops_roadmap_cost_items')
    .insert(
      draft.costItems.map((item) => ({
        roadmap_id: roadmap.id,
        phase_id: (phaseByKey.get(item.phaseKey)?.id as string | undefined) ?? null,
        task_id: item.taskKey ? (taskByKey.get(item.taskKey)?.id as string | undefined) ?? null : null,
        category: item.category,
        label: item.label,
        description: item.description,
        payer: item.payer,
        cost_type: item.costType,
        amount: item.amount,
        pricing_state: item.pricingState,
        source_url: item.sourceUrl ?? null,
        notes: item.notes ?? null,
      })),
    )

  if (costsError) throw new Error(`Failed to create AI Ops roadmap cost items: ${costsError.message}`)

  await refreshRoadmapPhaseRollups(roadmap.id)
  return (await getRoadmapBundleForProject(clientProjectId)) as RoadmapBundle
}

export async function projectRoadmapTasks(clientProjectId: string): Promise<{ dashboardCreated: number; meetingCreated: number }> {
  const db = requireDb()
  const bundle = await ensureRoadmapForProject(clientProjectId, { generatedFrom: 'proposal_acceptance' })
  const tasks = bundle.tasks as JsonRecord[]

  let dashboardCreated = 0
  let meetingCreated = 0

  for (const task of tasks) {
    const roadmapTaskId = task.id as string
    if (task.client_visible) {
      const { data: existing } = await db
        .from('dashboard_tasks')
        .select('id')
        .eq('roadmap_task_id', roadmapTaskId)
        .maybeSingle()

      if (!existing) {
        const { data, error } = await db
          .from('dashboard_tasks')
          .insert({
            client_project_id: clientProjectId,
            roadmap_task_id: roadmapTaskId,
            category: 'implementation_roadmap',
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: dashboardStatusFromRoadmap(task.status as RoadmapTaskStatus),
            due_date: task.due_date ?? null,
            display_order: 0,
            diy_resources: [],
            accelerated_headline: 'Part of your AI Ops implementation roadmap',
            accelerated_savings: task.acceptance_criteria ?? null,
          })
          .select('id')
          .single()

        if (error) throw new Error(`Failed to create dashboard roadmap task: ${error.message}`)
        await db.from('client_ai_ops_roadmap_tasks').update({ dashboard_task_id: data.id }).eq('id', roadmapTaskId)
        dashboardCreated += 1
      }
    }

    const meetingTaskId = await projectRoadmapTaskToMeetingTask(clientProjectId, task)
    if (meetingTaskId) meetingCreated += 1
  }

  return { dashboardCreated, meetingCreated }
}

export async function projectRoadmapTaskToMeetingTask(clientProjectId: string, task: JsonRecord): Promise<string | null> {
  const db = requireDb()
  const roadmapTaskId = task.id as string | undefined
  if (!roadmapTaskId || !task.meeting_task_visible) return null

  const { data: existing } = await db
    .from('meeting_action_tasks')
    .select('id')
    .eq('roadmap_task_id', roadmapTaskId)
    .maybeSingle()

  if (existing?.id) {
    if (!task.meeting_action_task_id) {
      await db.from('client_ai_ops_roadmap_tasks').update({ meeting_action_task_id: existing.id }).eq('id', roadmapTaskId)
    }
    return null
  }

  const { data, error } = await db
    .from('meeting_action_tasks')
    .insert({
      meeting_record_id: null,
      client_project_id: clientProjectId,
      roadmap_task_id: roadmapTaskId,
      title: task.title,
      description: task.description,
      owner: task.owner_type === 'client' ? 'Client' : 'AmaduTown',
      due_date: task.due_date ?? null,
      status: meetingTaskStatusFromRoadmap(task.status as RoadmapTaskStatus),
      task_category: 'internal',
      display_order: 0,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create meeting roadmap task: ${error.message}`)
  await db.from('client_ai_ops_roadmap_tasks').update({ meeting_action_task_id: data.id }).eq('id', roadmapTaskId)
  return data.id as string
}

export async function syncRoadmapTaskFromProjection(source: 'dashboard' | 'meeting', taskId: string, status: string): Promise<void> {
  const db = requireDb()
  const table = source === 'dashboard' ? 'dashboard_tasks' : 'meeting_action_tasks'
  const { data: projected } = await db
    .from(table)
    .select('roadmap_task_id')
    .eq('id', taskId)
    .maybeSingle()

  const roadmapTaskId = projected?.roadmap_task_id as string | null | undefined
  if (!roadmapTaskId) return

  const roadmapStatus = roadmapStatusFromProjectedTask(status)
  await db
    .from('client_ai_ops_roadmap_tasks')
    .update({
      status: roadmapStatus,
      completed_at: roadmapStatus === 'complete' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapTaskId)

  const { data: roadmapTask } = await db
    .from('client_ai_ops_roadmap_tasks')
    .select('roadmap_id, phase_id')
    .eq('id', roadmapTaskId)
    .maybeSingle()

  if (roadmapTask?.phase_id) await refreshRoadmapPhaseStatus(roadmapTask.phase_id as string)
}

export async function refreshRoadmapPhaseRollups(roadmapId: string): Promise<void> {
  const db = requireDb()
  const { data: phases } = await db
    .from('client_ai_ops_roadmap_phases')
    .select('id')
    .eq('roadmap_id', roadmapId)

  for (const phase of phases || []) {
    await refreshRoadmapPhaseStatus(phase.id)
  }

  const { data: costs } = await db
    .from('client_ai_ops_roadmap_cost_items')
    .select('payer, cost_type, amount, category')
    .eq('roadmap_id', roadmapId)

  type CostRollupRow = { payer: string; cost_type: string; amount: number | string | null; category: string }

  await db
    .from('client_ai_ops_roadmaps')
    .update({
      snapshot: { cost_summary: rollUpRoadmapCosts(((costs || []) as CostRollupRow[]).map((item) => ({
        payer: item.payer as never,
        costType: item.cost_type as never,
        amount: item.amount == null ? null : Number(item.amount),
        category: item.category as never,
      }))) },
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId)
}

async function refreshRoadmapPhaseStatus(phaseId: string): Promise<void> {
  const db = requireDb()
  const { data: tasks } = await db
    .from('client_ai_ops_roadmap_tasks')
    .select('status')
    .eq('phase_id', phaseId)

  await db
    .from('client_ai_ops_roadmap_phases')
    .update({
      status: phaseStatusFromTasks((tasks || []) as Array<{ status: string }>),
      updated_at: new Date().toISOString(),
    })
    .eq('id', phaseId)
}
