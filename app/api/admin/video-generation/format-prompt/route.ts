/**
 * POST /api/admin/video-generation/format-prompt
 * Takes raw notes/thoughts + optional detail fields and returns a structured
 * video content brief using the system prompt from the prompt library.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getVideoPromptFormatterPrompt } from '@/lib/system-prompts'
import { recordOpenAICost, type Usage } from '@/lib/cost-calculator'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  buildVideoPromptFormatterUserMessage,
  evaluateVideoPromptFormatterBudget,
  recordVideoPromptFormatterBudgetDecision,
  VIDEO_PROMPT_FORMAT_OPERATION,
  VideoPromptFormatError,
} from '@/lib/video-prompt-format'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let agentRunId: string | null = null
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const rawText = (body.rawText as string | undefined)?.trim()
    if (!rawText) {
      return NextResponse.json(
        { error: 'rawText is required' },
        { status: 400 }
      )
    }

    const audience = (body.audience as string | undefined)?.trim() || ''
    const tone = (body.tone as string | undefined)?.trim() || ''
    const angle = (body.angle as string | undefined)?.trim() || ''

    const systemPromptObj = await getVideoPromptFormatterPrompt()
    const systemPrompt = systemPromptObj?.prompt ?? ''
    const config = (systemPromptObj?.config ?? {}) as Record<string, unknown>
    const model = (config.model as string) || 'gpt-4o-mini'
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0.5
    const maxTokens = typeof config.maxTokens === 'number' ? config.maxTokens : 800

    const userMessage = buildVideoPromptFormatterUserMessage({
      rawText,
      audience,
      tone,
      angle,
    })

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'video_prompt_format',
      title: 'Format video generation prompt',
      subject: {
        type: 'video_prompt',
        label: rawText.slice(0, 80),
      },
      triggerSource: 'admin:video_prompt_format',
      triggeredByUserId: auth.user.id,
      currentStep: 'Video prompt request validated',
      metadata: {
        model,
        max_tokens: maxTokens,
        has_audience: !!audience,
        has_tone: !!tone,
        has_angle: !!angle,
        prompt_key: systemPromptObj?.key ?? 'video_prompt_formatter',
      },
    })
    agentRunId = agentRun.id

    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'video_prompt_request_validated',
      name: 'Video prompt request validated',
      status: 'completed',
      inputSummary: rawText.slice(0, 240),
      metadata: {
        model,
        max_tokens: maxTokens,
        raw_text_chars: rawText.length,
        user_message_chars: userMessage.length,
      },
      idempotencyKey: `${agentRunId}:video_prompt_request_validated`,
    }).catch((err) => console.warn('[format-prompt] agent validation step failed:', err))

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new VideoPromptFormatError('OPENAI_API_KEY is not configured', 'openai_not_configured')
    }

    const budgetDecision = evaluateVideoPromptFormatterBudget({
      systemPrompt,
      userMessage,
      model,
      maxTokens,
    })
    await recordVideoPromptFormatterBudgetDecision({
      agentRunId,
      decision: budgetDecision,
    })
    if (budgetDecision.status === 'blocked') {
      throw new VideoPromptFormatError(budgetDecision.reason, 'budget_blocked')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[format-prompt] OpenAI error:', errText)
      throw new VideoPromptFormatError('AI formatting failed', 'openai_upstream')
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content?.trim() ?? ''
    const usage = aiResult.usage as Usage | undefined
    if (usage) {
      recordOpenAICost(
        usage,
        model,
        { type: 'video_prompt_format', id: agentRunId },
        {
          operation: VIDEO_PROMPT_FORMAT_OPERATION,
          budget_status: budgetDecision.status,
          budget_rule_key: budgetDecision.rule.key,
          budget_estimated_cost_usd: budgetDecision.estimatedCostUsd,
        },
        agentRunId,
      ).catch(() => {})
    }

    if (!content) {
      throw new VideoPromptFormatError('No AI response', 'invalid_response')
    }

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Video prompt formatted',
      outcome: {
        model,
        prompt_chars: content.length,
      },
    }).catch((err) => console.warn('[format-prompt] end agent run failed:', err))

    return NextResponse.json({ formattedPrompt: content, agentRunId })
  } catch (error) {
    console.error('[format-prompt] Error:', error)

    const message = error instanceof Error ? error.message : String(error)
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'video_prompt_format_failed',
        name: 'Video prompt formatting failed',
        status: 'failed',
        outputSummary: message,
        idempotencyKey: `${agentRunId}:video_prompt_format_failed`,
      }).catch((stepErr) => console.warn('[format-prompt] agent failure step failed:', stepErr))
      await markAgentRunFailed(agentRunId, message, {
        operation: VIDEO_PROMPT_FORMAT_OPERATION,
      }).catch((runErr) => console.warn('[format-prompt] mark agent run failed:', runErr))
    }

    if (error instanceof VideoPromptFormatError) {
      if (error.code === 'budget_blocked') {
        return NextResponse.json(
          { error: 'This video prompt formatting request is over the current Agent Ops budget limit. Shorten the notes or reduce the configured max tokens before retrying.' },
          { status: 400 },
        )
      }
      if (error.code === 'openai_not_configured') {
        return NextResponse.json(
          { error: 'OpenAI API key not configured' },
          { status: 503 },
        )
      }
      if (error.code === 'openai_upstream') {
        return NextResponse.json(
          { error: 'AI formatting failed' },
          { status: 502 },
        )
      }
      if (error.code === 'invalid_response') {
        return NextResponse.json(
          { error: 'The AI returned an empty response. Try formatting again or adjust the video prompt formatter system prompt.' },
          { status: 502 },
        )
      }
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
