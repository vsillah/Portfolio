import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'

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
    const input = {
      text: formData.get('text') || '',
      userId: formData.get('user_id'),
      userName: formData.get('user_name'),
    }
    const responseUrl = formData.get('response_url')
    const commandResult = runAgentCommand(input)

    if (responseUrl) {
      const result = await withTimeout(commandResult, 2500)
      if (result) {
        return NextResponse.json({
          response_type: result.responseType,
          text: result.text,
        })
      }

      waitUntil(postDelayedAgentResponse(responseUrl, commandResult))

      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Agent Ops received \`/agent ${input.text || 'help'}\`. I am preparing the result now.`,
      })
    }

    const result = await commandResult

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

async function runAgentCommand(
  input: { text: string; userId?: string | null; userName?: string | null },
) {
  const { handleAgentSlackCommand } = await import('@/lib/agent-slack-command')
  return handleAgentSlackCommand(input)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function postDelayedAgentResponse(
  responseUrl: string,
  commandResult: Promise<{ responseType: string; text: string }>,
) {
  try {
    const result = await commandResult
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: result.responseType,
        replace_original: false,
        text: result.text,
      }),
    })
  } catch (error) {
    console.error('Error posting delayed Slack agent command response:', error)
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        replace_original: false,
        text: 'Agent Ops command started, but the delayed result failed. Check Portfolio logs and /admin/agents/runs.',
      }),
    }).catch(() => {})
  }
}

function verifySlackSignature(request: NextRequest, rawBody: string) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    const allowUnsignedLocal =
      process.env.NODE_ENV !== 'production' && !process.env.VERCEL && process.env.NEXT_PUBLIC_APP_ENV !== 'staging'
    if (allowUnsignedLocal) {
      console.warn('SLACK_SIGNING_SECRET not configured -- skipping verification for local development')
      return true
    }
    console.warn('SLACK_SIGNING_SECRET not configured -- rejecting Slack request')
    return false
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
