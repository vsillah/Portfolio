import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerProgressUpdate } from '@/lib/progress-update-templates'
import type { Milestone } from '@/lib/onboarding-templates'
import crypto from 'crypto'

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
    const isValid = await verifySlackSignature(request)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Slack signature' },
        { status: 401 }
      )
    }

    // Parse form-encoded body
    const formData = await request.formData()
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
    })

    const channelLabel = result?.channel || 'unknown'

    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Marked milestone ${milestoneNumber} ("${milestoneName}") as complete for *${project.client_name}*.\nProgress update sent via *${channelLabel}*.\n\n_Tip: Use the admin dashboard to attach screenshots to progress updates._`,
    })
  } catch (error) {
    console.error('Error in Slack milestone-complete:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'An error occurred processing your request. Please try again.',
    })
  }
}

/**
 * Verify the Slack request signature using the signing secret.
 */
async function verifySlackSignature(request: NextRequest): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not configured -- skipping verification')
    return true // Allow in development
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')

  if (!timestamp || !signature) {
    return false
  }

  // Prevent replay attacks (5 minute window)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false
  }

  // Clone and read the body for verification
  const body = await request.clone().text()
  const sigBasestring = `v0:${timestamp}:${body}`
  const mySignature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring)
      .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  )
}
