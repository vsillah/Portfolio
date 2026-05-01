import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { refreshRoadmapPhaseRollups } from '@/lib/client-ai-ops-roadmap-db'

export const dynamic = 'force-dynamic'

type MonitorTaskRow = { id: string; title: string; status: string; due_date: string | null }
type MonitorCostRow = { id: string; pricing_state: string; last_checked_at: string | null; label: string }

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.N8N_INGEST_SECRET || token !== process.env.N8N_INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: roadmaps, error } = await supabaseAdmin
    .from('client_ai_ops_roadmaps')
    .select('id, client_project_id, title, status')
    .in('status', ['approved', 'active'])
    .not('client_project_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch roadmaps' }, { status: 500 })
  }

  const createdReports: string[] = []
  const createdTasks: string[] = []
  const nowIso = new Date().toISOString()

  for (const roadmap of roadmaps || []) {
    await refreshRoadmapPhaseRollups(roadmap.id)

    const [tasksRes, costsRes, reportsRes] = await Promise.all([
      supabaseAdmin
        .from('client_ai_ops_roadmap_tasks')
        .select('id, title, status, due_date')
        .eq('roadmap_id', roadmap.id),
      supabaseAdmin
        .from('client_ai_ops_roadmap_cost_items')
        .select('id, pricing_state, last_checked_at, label')
        .eq('roadmap_id', roadmap.id),
      supabaseAdmin
        .from('client_ai_ops_roadmap_reports')
        .select('id, generated_at')
        .eq('roadmap_id', roadmap.id)
        .order('generated_at', { ascending: false })
        .limit(1),
    ])

    const overdueTasks = ((tasksRes.data || []) as MonitorTaskRow[]).filter((task) =>
      task.due_date &&
      !['complete', 'cancelled'].includes(task.status) &&
      new Date(task.due_date).getTime() < Date.now()
    )
    const staleCostItems = ((costsRes.data || []) as MonitorCostRow[]).filter((item) => item.pricing_state !== 'fresh')
    const lastReportAt = reportsRes.data?.[0]?.generated_at ? new Date(reportsRes.data[0].generated_at).getTime() : 0
    const reportMissing = !lastReportAt || Date.now() - lastReportAt > 32 * 24 * 60 * 60 * 1000

    const monitoringSummary = {
      overdue_tasks: overdueTasks.length,
      stale_cost_items: staleCostItems.length,
      report_missing: reportMissing,
      checked_at: nowIso,
    }

    if (overdueTasks.length > 0 || staleCostItems.length > 0 || reportMissing) {
      const { data: report } = await supabaseAdmin
        .from('client_ai_ops_roadmap_reports')
        .insert({
          roadmap_id: roadmap.id,
          client_project_id: roadmap.client_project_id,
          report_type: 'monitoring_summary',
          status: 'ready',
          title: `${roadmap.title} monitoring review`,
          summary: 'Roadmap monitoring found items that need review.',
          client_actions: [],
          amadutown_actions: [
            ...overdueTasks.map((task) => `Review overdue roadmap task: ${task.title}`),
            ...staleCostItems.map((item) => `Refresh pricing/source for: ${item.label}`),
            ...(reportMissing ? ['Generate monthly AI Ops report'] : []),
          ],
          approval_needed: [],
          monitoring_summary: monitoringSummary,
          cost_summary: { stale_cost_items: staleCostItems.length },
        })
        .select('id')
        .single()

      if (report?.id) createdReports.push(report.id)

      const followupKey = `monitoring-followup-${new Date().toISOString().slice(0, 10)}`
      const { data: existingFollowup } = await supabaseAdmin
        .from('client_ai_ops_roadmap_tasks')
        .select('id')
        .eq('roadmap_id', roadmap.id)
        .eq('task_key', followupKey)
        .maybeSingle()

      if (!existingFollowup) {
        const { data: firstPhase } = await supabaseAdmin
          .from('client_ai_ops_roadmap_phases')
          .select('id')
          .eq('roadmap_id', roadmap.id)
          .order('phase_order', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (firstPhase?.id) {
          const { data: task } = await supabaseAdmin
            .from('client_ai_ops_roadmap_tasks')
            .insert({
              roadmap_id: roadmap.id,
              phase_id: firstPhase.id,
              task_key: followupKey,
              title: 'Review AI Ops monitoring findings',
              description: 'Review overdue tasks, stale pricing, missing reports, or open monitoring findings from the daily AI Ops monitor.',
              owner_type: 'amadutown',
              priority: 'high',
              status: 'pending',
              client_visible: false,
              meeting_task_visible: true,
              cost_category: 'monitoring',
              metadata: { monitoring_summary: monitoringSummary },
            })
            .select('id')
            .single()
          if (task?.id) createdTasks.push(task.id)
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked: roadmaps?.length ?? 0,
    reports_created: createdReports.length,
    followup_tasks_created: createdTasks.length,
  })
}
