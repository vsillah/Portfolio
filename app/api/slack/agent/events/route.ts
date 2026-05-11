import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import {
  handleSlackAgentEvent,
  shouldHandleSlackAgentEvent,
  type SlackAgentEventPayload,
} from '@/lib/agent-slack-events'
import { verifySlackSignature } from '@/lib/slack-signature'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/slack/agent/events
 *
 * Slack Events API handler for conversational Agent Ops access. V1 supports
 * app mentions and direct messages, routes them into the read-only Chief of
 * Staff chat layer, and posts the response back to Slack.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const isValid = verifySlackSignature(request, rawBody)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 })
    }

    let payload: SlackAgentEventPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge ?? '' })
    }

    if (request.headers.get('x-slack-retry-num')) {
      return NextResponse.json({ ok: true, skipped: 'slack_retry' })
    }

    if (payload.type === 'event_callback' && !shouldHandleSlackAgentEvent(payload.event)) {
      return NextResponse.json({ ok: true, skipped: 'unsupported_event' })
    }

    waitUntil(handleSlackAgentEvent(payload))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in Slack agent event handler:', error)
    return NextResponse.json({ ok: false, error: 'Slack agent event failed' }, { status: 500 })
  }
}
