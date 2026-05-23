import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature } from '@/lib/slack-signature'
import { handleSlackAgentAction, type SlackInteractivePayload } from '@/lib/agent-slack-actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/slack/agent/actions
 *
 * Slack interactivity endpoint for Agent Ops mobile unblock controls.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const isValid = verifySlackSignature(request, rawBody)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 })
    }

    if (request.headers.get('x-slack-retry-num')) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'Agent Ops already received this Slack action.',
      })
    }

    const formData = new URLSearchParams(rawBody)
    const payloadRaw = formData.get('payload')
    if (!payloadRaw) {
      return NextResponse.json({ error: 'Missing Slack payload' }, { status: 400 })
    }

    let payload: SlackInteractivePayload
    try {
      payload = JSON.parse(payloadRaw) as SlackInteractivePayload
    } catch {
      return NextResponse.json({ error: 'Invalid Slack payload' }, { status: 400 })
    }

    if (payload.type !== 'block_actions' && payload.type !== 'view_submission') {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'Unsupported Agent Ops Slack interaction.',
      })
    }

    const result = await handleSlackAgentAction(payload)
    return NextResponse.json({
      response_type: result.responseType,
      text: result.text,
      replace_original: result.replaceOriginal ?? false,
    })
  } catch (error) {
    console.error('Error in Slack agent action handler:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Agent Ops could not complete that Slack action. Check Portfolio logs and try again.',
    })
  }
}
