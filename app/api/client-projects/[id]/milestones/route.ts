import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerProgressUpdate } from '@/lib/progress-update-templates'
import { getUpsellPathsForOffer, scheduleUpsellFollowUp } from '@/lib/upsell-paths'
import type { Milestone } from '@/lib/onboarding-templates'

export const dynamic = 'force-dynamic'

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
      attachments,
      note,
      sender_name,
      triggered_by,
    } = body

    // Validate inputs
    if (milestone_index === undefined || milestone_index === null) {
      return NextResponse.json(
        { error: 'milestone_index is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'in_progress', 'complete', 'skipped']
    if (!new_status || !validStatuses.includes(new_status)) {
      return NextResponse.json(
        { error: `new_status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch the onboarding plan for this project
    const { data: plan, error: planError } = await supabaseAdmin
      .from('onboarding_plans')
      .select('id, milestones')
      .eq('client_project_id', clientProjectId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'No onboarding plan found for this project' },
        { status: 404 }
      )
    }

    const milestones = (plan.milestones || []) as Milestone[]

    if (milestone_index < 0 || milestone_index >= milestones.length) {
      return NextResponse.json(
        {
          error: `milestone_index out of range (0-${milestones.length - 1})`,
        },
        { status: 400 }
      )
    }

    // Update the milestone status
    const oldStatus = milestones[milestone_index].status
    milestones[milestone_index].status = new_status

    // Persist the updated milestones
    const { error: updateError } = await supabaseAdmin
      .from('onboarding_plans')
      .update({ milestones })
      .eq('id', plan.id)

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
    } else if (new_status === 'complete' || new_status === 'in_progress') {
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
    if (new_status === 'complete' && oldStatus !== 'complete') {
      progressResult = await triggerProgressUpdate({
        clientProjectId,
        milestoneIndex: milestone_index,
        newStatus: new_status,
        senderName: sender_name || 'Your Project Lead',
        customNote: note,
        attachments: attachments || [],
        triggeredBy: (triggered_by as 'admin' | 'slack_cmd') || 'admin',
      })
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
      new_status,
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
