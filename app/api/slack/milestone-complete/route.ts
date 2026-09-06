import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerProgressUpdate } from '@/lib/progress-update-templates'
import type { Milestone } from '@/lib/onboarding-templates'
import { verifySlackSignature } from '@/lib/slack-signature'
import { requireAuthorizedSlackActor } from '@/lib/slack-agent-access'

export const dynamic = 'force-dynamic'

/**
 * POST /api/slack/milestone-complete
 * Slack slash command handler for /milestone-complete
 *
 * Usage: /milestone-complete [client-id] [milestone-number]
 * Example: /milestone-complete cli_20260201_1 3
 *
 * Slack sends form-encoded body with:
 * - token, team_id, team_domain, channel_id, channel_name
 * - user_id, user_name, command, text, response_url
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Slack request signature
    const rawBody = await request.text()
    const isValid = verifySlackSignature(request, rawBody)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Slack signature' },
        { status: 401 }
      )
    }

    // Parse form-encoded body
    const formData = new URLSearchParams(rawBody)
    const authorization = requireAuthorizedSlackActor({
      userId: formData.get('user_id'),
      userName: formData.get('user_name'),
      teamId: formData.get('team_id'),
    })
    if (!authorization.ok) {
      return NextResponse.json({ response_type: 'ephemeral', text: authorization.text }, { status: 403 })
    }
    const text = (formData.get('text') as string) || ''
    const userName = (formData.get('user_name') as string) || 'Unknown'

    // Parse command arguments
    const args = text.trim().split(/\s+/)
    if (args.length < 2) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'Usage: `/milestone-complete [client-id] [milestone-number]`\nExample: `/milestone-complete cli_20260201_1 3`',
      })
    }

    const clientId = args[0]
    const milestoneNumber = parseInt(args[1], 10)

    if (isNaN(milestoneNumber) || milestoneNumber < 1) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'Milestone number must be a positive integer (1-based).',
      })
    }

    // Look up the client project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('client_projects')
      .select('id, client_name, client_email, product_purchased')
      .eq('client_id', clientId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Could not find a project with client ID: \`${clientId}\`. Check the ID and try again.`,
      })
    }

    // Fetch the onboarding plan
    const { data: plan } = await supabaseAdmin
      .from('onboarding_plans')
      .select('id, milestones')
      .eq('client_project_id', project.id)
      .single()

    if (!plan) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `No onboarding plan found for ${project.client_name}. Create one first.`,
      })
    }

    const milestones = (plan.milestones || []) as Milestone[]
    const milestoneIndex = milestoneNumber - 1 // Convert 1-based to 0-based

    if (milestoneIndex < 0 || milestoneIndex >= milestones.length) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Milestone ${milestoneNumber} is out of range. This project has ${milestones.length} milestones (1-${milestones.length}).`,
      })
    }

    const milestoneName = milestones[milestoneIndex].title

    if (milestones[milestoneIndex].status === 'complete') {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Milestone ${milestoneNumber} ("${milestoneName}") is already marked as complete.`,
      })
    }

    // Update the milestone
    milestones[milestoneIndex].status = 'complete'

    const { error: updateError } = await supabaseAdmin
      .from('onboarding_plans')
      .update({ milestones })
      .eq('id', plan.id)

    if (updateError) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Failed to update milestone: ${updateError.message}`,
      })
    }

    // Trigger progress update
    const result = await triggerProgressUpdate({
      clientProjectId: project.id,
      milestoneIndex,
      newStatus: 'complete',
      senderName: userName,
      triggeredBy: 'slack_cmd',
    }).catch(() => null)

    const channelLabel = result?.channel || 'unknown'

    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Marked milestone ${milestoneNumber} ("${milestoneName}") as complete for *${project.client_name}*.\n${result ? `Progress update prepared for *${channelLabel}*; delivery is not confirmed.` : 'Progress update preparation failed; milestone completion was saved.'}\n\n_Tip: Use the admin dashboard to attach screenshots to progress updates._`,
    })
  } catch (error) {
    console.error('Error in Slack milestone-complete:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'An error occurred processing your request. Please try again.',
    })
  }
}
