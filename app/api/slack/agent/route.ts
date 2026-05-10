import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { verifySlackSignature } from '@/lib/slack-signature'

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
