import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { verifySlackSignature } from '@/lib/slack-signature'
import type { AgentSlackCommandResult } from '@/lib/agent-slack-command'

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
      logInvalidSlackCommandSignature(request, rawBody)
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
          ...(result.blocks ? { blocks: result.blocks } : {}),
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
      ...(result.blocks ? { blocks: result.blocks } : {}),
    })
  } catch (error) {
    console.error('Error in Slack agent command:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'An error occurred processing the Agent Ops command. Check the Portfolio logs and try again.',
    })
  }
}

function logInvalidSlackCommandSignature(request: NextRequest, rawBody: string) {
  const formData = new URLSearchParams(rawBody)
  const timestamp = request.headers.get('x-slack-request-timestamp')
  const timestampSeconds = timestamp ? Number(timestamp) : null
  const timestampSkewSeconds =
    timestampSeconds !== null && Number.isFinite(timestampSeconds)
      ? Math.floor(Date.now() / 1000) - timestampSeconds
      : null

  console.warn('Invalid Slack agent command signature', {
    api_app_id: formData.get('api_app_id') || null,
    team_id: formData.get('team_id') || null,
    team_domain: formData.get('team_domain') || null,
    command: formData.get('command') || null,
    channel_id: formData.get('channel_id') || null,
    user_id: formData.get('user_id') || null,
    has_signature: Boolean(request.headers.get('x-slack-signature')),
    has_timestamp: Boolean(timestamp),
    timestamp_skew_seconds: timestampSkewSeconds,
    body_length: rawBody.length,
  })
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
  commandResult: Promise<AgentSlackCommandResult>,
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
        ...(result.blocks ? { blocks: result.blocks } : {}),
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
