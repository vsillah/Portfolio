import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { handleAgentSlackCommand } from '@/lib/agent-slack-command'

export const dynamic = 'force-dynamic'

/**
 * POST /api/slack/agent
 * Slack slash command handler for /agent.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const isValid = verifySlackSignature(request, rawBody)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 })
    }

    const formData = new URLSearchParams(rawBody)
    const result = await handleAgentSlackCommand({
      text: formData.get('text') || '',
      userId: formData.get('user_id'),
      userName: formData.get('user_name'),
    })

    return NextResponse.json({
      response_type: result.responseType,
      text: result.text,
    })
  } catch (error) {
    console.error('Error in Slack agent command:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'An error occurred processing the Agent Ops command. Check the Portfolio logs and try again.',
    })
  }
}

function verifySlackSignature(request: NextRequest, rawBody: string) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not configured -- skipping verification')
    return true
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')
  if (!timestamp || !signature) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestampSeconds) > 300) return false

  const basestring = `v0:${timestamp}:${rawBody}`
  const expectedSignature = `v0=${createHmac('sha256', signingSecret).update(basestring).digest('hex')}`
  const expected = Buffer.from(expectedSignature)
  const actual = Buffer.from(signature)

  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
