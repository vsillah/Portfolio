/**
 * POST /api/admin/video-generation/format-prompt
 * Takes raw notes/thoughts + optional detail fields and returns a structured
 * video content brief using the system prompt from the prompt library.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getVideoPromptFormatterPrompt } from '@/lib/system-prompts'
import { recordOpenAICost } from '@/lib/cost-calculator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
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

    const detailLines: string[] = []
    if (audience) detailLines.push(`TARGET AUDIENCE: ${audience}`)
    if (tone) detailLines.push(`TONE: ${tone}`)
    if (angle) detailLines.push(`ANGLE / HOOK: ${angle}`)

    const userMessage = detailLines.length > 0
      ? `${rawText}\n\nAdditional details provided by the user:\n${detailLines.join('\n')}`
      : rawText

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
      return NextResponse.json(
        { error: 'AI formatting failed' },
        { status: 500 }
      )
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content?.trim() ?? ''
    const usage = aiResult.usage
    if (usage) {
      recordOpenAICost(usage, model, undefined, {
        operation: 'video_prompt_format',
      }).catch(() => {})
    }

    return NextResponse.json({ formattedPrompt: content })
  } catch (error) {
    console.error('[format-prompt] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
