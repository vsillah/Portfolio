import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerProgressUpdate } from '@/lib/progress-update-templates'
import { getUpsellPathsForOffer, scheduleUpsellFollowUp } from '@/lib/upsell-paths'
import type { Milestone, MilestoneEvidence } from '@/lib/onboarding-templates'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['pending', 'in_progress', 'complete', 'skipped'] as const
type MilestoneStatus = (typeof VALID_STATUSES)[number]

function isValidStatus(value: unknown): value is MilestoneStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as MilestoneStatus)
}

function validateMilestoneIndex(index: unknown, milestones: Milestone[]) {
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    return 'milestone_index is required'
  }

  if (index < 0 || index >= milestones.length) {
    return `milestone_index out of range (0-${milestones.length - 1})`
  }

  return null
}

function sanitizeMilestoneInput(value: unknown): Partial<Milestone> {
  if (!value || typeof value !== 'object') return {}
  const input = value as Partial<Milestone>

  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : undefined,
    week: typeof input.week === 'number' || typeof input.week === 'string' ? input.week : undefined,
    title: typeof input.title === 'string' ? input.title.trim() : undefined,
    description: typeof input.description === 'string' ? input.description.trim() : undefined,
    deliverables: Array.isArray(input.deliverables)
      ? input.deliverables.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined,
    phase: typeof input.phase === 'number' ? input.phase : undefined,
    target_date: typeof input.target_date === 'string' ? input.target_date : undefined,
    status: isValidStatus(input.status) ? input.status : undefined,
    completed_at: typeof input.completed_at === 'string' ? input.completed_at : undefined,
    evidence: Array.isArray(input.evidence) ? input.evidence : undefined,
    automation: input.automation && typeof input.automation === 'object' ? input.automation : undefined,
  }
}

function createManualEvidence({
  note,
  attachments,
  senderName,
}: {
  note?: string
  attachments?: Array<{ url?: string; filename?: string; content_type?: string }>
  senderName?: string
}): MilestoneEvidence[] {
  const evidence: MilestoneEvidence[] = []
  const now = new Date().toISOString()
  const safeNote = note?.trim()

  if (safeNote || attachments?.length) {
    evidence.push({
      id: `manual-completion-${randomUUID()}`,
      source_type: 'manual',
      source_label: 'Project lead completion evidence',
      summary: safeNote
        ? safeNote.slice(0, 240)
        : `${attachments?.length ?? 0} completion attachment${attachments?.length === 1 ? '' : 's'} recorded.`,
      confidence: 'medium',
      status: 'manual_review',
      source_url: attachments?.find((attachment) => attachment.url)?.url,
      source_ref: senderName ? `recorded_by:${senderName}` : 'recorded_by:project_lead',
      captured_at: now,
      is_client_visible: true,
    })
  }

  return evidence
}

async function readOnboardingPlan(clientProjectId: string) {
  const { data: plan, error: planError } = await supabaseAdmin
    .from('onboarding_plans')
    .select('id, milestones')
    .eq('client_project_id', clientProjectId)
    .single()

  if (planError || !plan) {
    return { error: 'No onboarding plan found for this project' as const }
  }

  return {
    plan: plan as { id: string; milestones: Milestone[] | null },
    milestones: (plan.milestones || []) as Milestone[],
  }
}

async function persistMilestones(planId: string, milestones: Milestone[]) {
  const { error: updateError } = await supabaseAdmin
    .from('onboarding_plans')
    .update({ milestones })
    .eq('id', planId)

  return updateError
}

/**
 * PATCH /api/client-projects/[id]/milestones
 * Update a milestone status and auto-trigger a progress update message.
 *
 * Body: {
 *   milestone_index: number,
 *   new_status: 'pending' | 'in_progress' | 'complete' | 'skipped',
 *   attachments?: Array<{ url: string, filename: string, content_type: string }>,
 *   note?: string,
 *   sender_name?: string,
 *   triggered_by?: 'admin' | 'slack_cmd'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check -- allow admin or validate Slack signature (handled by caller)
    const authResult = await verifyAdmin(request)
    // For Slack commands, we use a special header instead
    const isSlackCmd = request.headers.get('x-trigger-source') === 'slack_cmd'

    if (!isSlackCmd && isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id: clientProjectId } = await params
    const body = await request.json()

    const {
      milestone_index,
      new_status,
      milestone,
      updates,
      attachments,
      note,
      sender_name,
      triggered_by,
    } = body

    // Fetch the onboarding plan for this project
    const planResult = await readOnboardingPlan(clientProjectId)
    if ('error' in planResult) {
      return NextResponse.json(
        { error: planResult.error },
        { status: 404 }
      )
    }

    const { plan, milestones } = planResult
    const indexError = validateMilestoneIndex(milestone_index, milestones)
    if (indexError) {
      return NextResponse.json({ error: indexError }, { status: 400 })
    }

    const incoming = sanitizeMilestoneInput(milestone ?? updates)
    const requestedStatus = new_status ?? incoming.status
    if (requestedStatus !== undefined && !isValidStatus(requestedStatus)) {
      return NextResponse.json(
        { error: `new_status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!requestedStatus && Object.keys(incoming).length === 0) {
      return NextResponse.json(
        { error: 'Provide new_status, milestone, or updates' },
        { status: 400 }
      )
    }

    // Update the milestone status
    const oldStatus = milestones[milestone_index].status
    const nextStatus = requestedStatus || oldStatus
    const completionEvidence = createManualEvidence({
      note,
      attachments,
      senderName: sender_name,
    })
    milestones[milestone_index] = {
      ...milestones[milestone_index],
      ...incoming,
      id: incoming.id || milestones[milestone_index].id || `milestone-${randomUUID()}`,
      status: nextStatus,
      completed_at:
        nextStatus === 'complete'
          ? milestones[milestone_index].completed_at || new Date().toISOString()
          : undefined,
      evidence:
        completionEvidence.length > 0
          ? [...(milestones[milestone_index].evidence || []), ...completionEvidence]
          : incoming.evidence ?? milestones[milestone_index].evidence,
    }

    // Persist the updated milestones
    const updateError = await persistMilestones(plan.id, milestones)

    if (updateError) {
      console.error('Error updating milestones:', updateError)
      return NextResponse.json(
        { error: 'Failed to update milestone' },
        { status: 500 }
      )
    }

    // Update client_projects phase if needed
    const completedCount = milestones.filter(
      (m) => m.status === 'complete'
    ).length
    const totalCount = milestones.length
    const allComplete = completedCount === totalCount

    if (allComplete) {
      await supabaseAdmin
        .from('client_projects')
        .update({ project_status: 'delivering', current_phase: 4 })
        .eq('id', clientProjectId)
    } else if (nextStatus === 'complete' || nextStatus === 'in_progress') {
      // Update phase based on the milestone's phase value
      const milestonePhase = milestones[milestone_index].phase
      await supabaseAdmin
        .from('client_projects')
        .update({
          current_phase: milestonePhase,
          project_status: 'active',
        })
        .eq('id', clientProjectId)
    }

    // Trigger progress update message if milestone was marked complete
    let progressResult = null
    if (nextStatus === 'complete' && oldStatus !== 'complete') {
      progressResult = await triggerProgressUpdate({
        clientProjectId,
        milestoneIndex: milestone_index,
        newStatus: nextStatus,
        senderName: sender_name || 'Your Project Lead',
        customNote: note,
        attachments: attachments || [],
        triggeredBy: (triggered_by as 'admin' | 'slack_cmd') || 'admin',
      })

      // Auto-update campaign progress for onboarding_milestone tracking
      try {
        const { data: clientProject } = await supabaseAdmin
          .from('client_projects')
          .select('client_email')
          .eq('id', clientProjectId)
          .single()

        if (clientProject?.client_email) {
          const { data: progressRows } = await supabaseAdmin
            .from('campaign_progress')
            .select(`
              id, enrollment_id,
              enrollment_criteria!inner (tracking_source, tracking_config)
            `)
            .eq('status', 'pending')
            .eq('enrollment_criteria.tracking_source', 'onboarding_milestone')

          if (progressRows) {
            for (const row of progressRows) {
              const config = (row.enrollment_criteria as unknown as { tracking_config: Record<string, unknown> })?.tracking_config
              const targetIndex = config?.milestone_index
              if (targetIndex !== undefined && Number(targetIndex) === milestone_index) {
                // Verify enrollment belongs to this client
                const { data: enrollment } = await supabaseAdmin
                  .from('campaign_enrollments')
                  .select('client_email')
                  .eq('id', row.enrollment_id)
                  .single()

                if (enrollment?.client_email === clientProject.client_email) {
                  await supabaseAdmin
                    .from('campaign_progress')
                    .update({
                      status: 'met',
                      progress_value: 100,
                      auto_tracked: true,
                      auto_source_ref: `milestone:${clientProjectId}:${milestone_index}`,
                    })
                    .eq('id', row.id)
                }
              }
            }
          }
        }
      } catch (campaignErr) {
        console.error('Error updating campaign progress for milestone:', campaignErr)
      }
    }

    // Schedule upsell follow-up tasks when all milestones are complete
    // Looks up the project's proposal line items and creates follow-up tasks
    // timed to each upsell path's next_problem_timing
    let upsellFollowUps: string[] = []
    if (allComplete) {
      try {
        // Fetch the proposal linked to this project
        const { data: project } = await supabaseAdmin
          .from('client_projects')
          .select('proposal_id')
          .eq('id', clientProjectId)
          .single()

        if (project?.proposal_id) {
          const { data: proposal } = await supabaseAdmin
            .from('proposals')
            .select('line_items')
            .eq('id', project.proposal_id)
            .single()

          type LineItem = { content_type?: string; content_id?: string }
          const lineItems = (proposal?.line_items || []) as LineItem[]

          for (const item of lineItems) {
            if (item.content_type && item.content_id) {
              const paths = await getUpsellPathsForOffer(
                item.content_type,
                String(item.content_id)
              )
              for (const path of paths) {
                const taskId = await scheduleUpsellFollowUp(
                  clientProjectId,
                  path
                )
                if (taskId) upsellFollowUps.push(taskId)
              }
            }
          }
        }
      } catch (upsellErr) {
        // Non-critical — continue without upsell follow-ups
        console.error('[Milestones] Error scheduling upsell follow-ups:', upsellErr)
      }
    }

    return NextResponse.json({
      success: true,
      milestone: milestones[milestone_index],
      milestone_index,
      old_status: oldStatus,
      new_status: nextStatus,
      milestones_completed: completedCount,
      milestones_total: totalCount,
      progress_update: progressResult
        ? {
            log_id: progressResult.logId,
            channel: progressResult.channel,
            update_type: progressResult.updateType,
          }
        : null,
      upsell_follow_ups: upsellFollowUps.length > 0 ? upsellFollowUps : null,
    })
  } catch (error) {
    console.error(
      'Error in PATCH /api/client-projects/[id]/milestones:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/client-projects/[id]/milestones
 * Add a milestone to the onboarding plan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id: clientProjectId } = await params
    const body = await request.json()
    const input = sanitizeMilestoneInput(body.milestone ?? body)

    if (!input.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (input.week === undefined) {
      return NextResponse.json({ error: 'week is required' }, { status: 400 })
    }
    if (input.phase === undefined) {
      return NextResponse.json({ error: 'phase is required' }, { status: 400 })
    }

    const planResult = await readOnboardingPlan(clientProjectId)
    if ('error' in planResult) {
      return NextResponse.json({ error: planResult.error }, { status: 404 })
    }

    const newMilestone: Milestone = {
      id: input.id || `milestone-${randomUUID()}`,
      week: input.week,
      title: input.title,
      description: input.description || '',
      deliverables: input.deliverables || [],
      phase: input.phase,
      target_date: input.target_date,
      status: input.status || 'pending',
      evidence: input.evidence,
      automation: input.automation,
    }

    const position =
      typeof body.position === 'number' && Number.isInteger(body.position)
        ? Math.max(0, Math.min(body.position, planResult.milestones.length))
        : planResult.milestones.length
    const milestones = [...planResult.milestones]
    milestones.splice(position, 0, newMilestone)

    const updateError = await persistMilestones(planResult.plan.id, milestones)
    if (updateError) {
      console.error('Error creating milestone:', updateError)
      return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      milestone: newMilestone,
      milestone_index: position,
      milestones_total: milestones.length,
    })
  } catch (error) {
    console.error('Error in POST /api/client-projects/[id]/milestones:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/client-projects/[id]/milestones
 * Remove a milestone from the onboarding plan.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id: clientProjectId } = await params
    const body = await request.json()
    const milestoneIndex = body.milestone_index

    const planResult = await readOnboardingPlan(clientProjectId)
    if ('error' in planResult) {
      return NextResponse.json({ error: planResult.error }, { status: 404 })
    }

    const indexError = validateMilestoneIndex(milestoneIndex, planResult.milestones)
    if (indexError) {
      return NextResponse.json({ error: indexError }, { status: 400 })
    }

    const milestones = [...planResult.milestones]
    const [removed] = milestones.splice(milestoneIndex, 1)

    const updateError = await persistMilestones(planResult.plan.id, milestones)
    if (updateError) {
      console.error('Error deleting milestone:', updateError)
      return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      removed_milestone: removed,
      milestone_index: milestoneIndex,
      milestones_total: milestones.length,
    })
  } catch (error) {
    console.error('Error in DELETE /api/client-projects/[id]/milestones:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
