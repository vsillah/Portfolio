/**
 * POST /api/admin/video-generation/generate-ideas
 * Generate video drafts (script + storyboard) from context using LLM.
 * Supports two modes:
 *   - from_scratch (default): brainstorm N ideas from background context
 *   - from_direction: user provides script/notes; LLM polishes and adds storyboard
 * Always inserts results into video_ideas_queue.
 *
 * When Accept: text/event-stream, streams per-phase progress via SSE.
 * Otherwise returns a single JSON response (backward compat).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordOpenAICost } from '@/lib/cost-calculator'
import {
  fetchVideoIdeasContext,
  serializeContextForPrompt,
} from '@/lib/video-ideas-context'
import { fetchVideoContextByEmail } from '@/lib/video-context'

export const dynamic = 'force-dynamic'

export interface VideoIdeaScene {
  sceneNumber: number
  description: string
  startPrompt?: string
  endPrompt?: string
  motionPrompt?: string
  brollHint?: string
}

export interface VideoIdea {
  title: string
  script: string
  storyboard: {
    scenes: VideoIdeaScene[]
  }
}

const IDEA_JSON_SCHEMA = `{
  "title": "string",
  "script": "string (full voice script)",
  "storyboard": {
    "scenes": [
      {
        "sceneNumber": 1,
        "description": "string",
        "startPrompt": "string (optional)",
        "endPrompt": "string (optional)",
        "motionPrompt": "string (optional)",
        "brollHint": "string (e.g. store, services, tools, admin, about, home)"
      }
    ]
  }
}`

const BRAINSTORM_SYSTEM_PROMPT = `You are a video content strategist for AmaduTown (Vambah Sillah / Mad Hadda). Generate YouTube video ideas that are conversational, mission-driven, and no-BS. Each idea must include:
1. A catchy title
2. A voice script (300-800 words) suitable for HeyGen avatar narration — conversational, first-person, ends with "Let's get it" or similar sign-off
3. A storyboard with 3-6 scenes. Each scene has: sceneNumber, description, startPrompt (image prompt for start frame), endPrompt (image prompt for end frame), motionPrompt (what happens in the clip), brollHint (keyword for B-roll: e.g. "store", "services", "admin module sync", "about", "home")

Return a JSON array of ideas. Each idea:
${IDEA_JSON_SCHEMA}

Focus on topics that resonate with minority-owned businesses, technology as equalizer, AI adoption, and AmaduTown's offerings. Use the provided context (meetings, chat, website content) to inspire authentic, relevant ideas.`

const POLISH_SYSTEM_PROMPT = `You are a video script editor and storyboard planner for AmaduTown (Vambah Sillah / Mad Hadda). The user has provided a draft script, notes, or topic. Your job is to:
1. Polish the script for HeyGen avatar narration — conversational, first-person, clear structure, 300-800 words. Keep the user's voice and intent; do not rewrite from scratch. If the input is rough notes or a topic, expand it into a full script.
2. Create a title if none is obvious.
3. Create a storyboard with 3-6 scenes. Each scene needs a brollHint keyword matching AmaduTown pages (store, services, tools, admin, about, home, resources, module sync, chat eval).

Return a JSON object with key "ideas" containing an array (usually 1 item for polish mode, more if the user asked for variations). Each idea:
${IDEA_JSON_SCHEMA}

Do not add sign-offs or catchphrases unless the original script has them. Preserve the user's style.`

interface GenerateParams {
  mode: 'from_scratch' | 'from_direction'
  limit: number
  includeTranscripts: boolean
  customPrompt: string
  email: string
  audience: string
  tone: string
  angle: string
  meetingIds: string[]
}

function parseBody(body: Record<string, unknown>): GenerateParams {
  const mode: 'from_scratch' | 'from_direction' = body.mode === 'from_direction' ? 'from_direction' : 'from_scratch'
  return {
    mode,
    limit: Math.min(Math.max(Number(body.limit) || (mode === 'from_direction' ? 1 : 5), 1), 10),
    includeTranscripts: body.includeTranscripts !== false,
    customPrompt: typeof body.customPrompt === 'string' ? (body.customPrompt as string).trim().slice(0, 5000) : '',
    email: typeof body.email === 'string' ? (body.email as string).trim().toLowerCase() : '',
    audience: typeof body.audience === 'string' ? (body.audience as string).trim() : '',
    tone: typeof body.tone === 'string' ? (body.tone as string).trim() : '',
    angle: typeof body.angle === 'string' ? (body.angle as string).trim() : '',
    meetingIds: Array.isArray(body.meetingIds) ? (body.meetingIds as string[]).filter(id => typeof id === 'string').slice(0, 50) : [],
  }
}

async function runGeneration(
  params: GenerateParams,
  apiKey: string,
  onStep?: (data: Record<string, unknown>) => void
): Promise<{ ideas: VideoIdea[]; addedToQueue: number; mode: string; error?: string }> {
  const { mode, limit, includeTranscripts, customPrompt, email, audience, tone, angle, meetingIds } = params

  onStep?.({ step: 'fetching_context', detail: email ? 'Loading client context...' : 'Loading meetings, chats, site content...' })

  let emailContext = ''
  if (email) {
    try {
      const ctx = await fetchVideoContextByEmail(email)
      if (ctx.found && ctx.project) {
        const parts: string[] = []
        if (ctx.project.client_name) parts.push(`Client: ${ctx.project.client_name}`)
        if (ctx.project.client_company) parts.push(`Company: ${ctx.project.client_company}`)
        const summary = ctx.diagnostic_audits?.[0]?.diagnostic_summary
        if (summary) parts.push(`Diagnostic summary: ${summary}`)
        emailContext = parts.join('\n')
      }
    } catch {
      // Non-fatal
    }
  }

  let contextText = ''
  if (mode === 'from_scratch' || !customPrompt) {
    const ctx = await fetchVideoIdeasContext({
      includeTranscripts,
      meetingsLimit: 10,
      chatSessionsLimit: 5,
      meetingIds: meetingIds.length > 0 ? meetingIds : undefined,
    })
    contextText = serializeContextForPrompt(ctx)
  }

  const directionDetails = [audience && `Target audience: ${audience}`, tone && `Tone/style: ${tone}`, angle && `Angle/hook: ${angle}`].filter(Boolean).join('\n')

  let systemPrompt: string
  let userPrompt: string

  if (mode === 'from_direction') {
    systemPrompt = POLISH_SYSTEM_PROMPT
    const parts = [`Here is the user's draft script, notes, or topic:\n\n---\n${customPrompt}\n---`]
    if (directionDetails) parts.push(`\nDirection:\n${directionDetails}`)
    if (emailContext) parts.push(`\nClient context:\n${emailContext}`)
    if (contextText) parts.push(`\nBackground context:\n${contextText}`)
    if (limit > 1) parts.push(`\nGenerate ${limit} variations.`)
    else parts.push('\nReturn 1 polished idea with storyboard.')
    parts.push('\nReturn a JSON object with key "ideas". No markdown, no code fences.')
    userPrompt = parts.join('\n')
  } else {
    systemPrompt = BRAINSTORM_SYSTEM_PROMPT
    const parts = [`Based on the following context, generate ${limit} video ideas. Each idea must have a title, full voice script (300-800 words), and a storyboard with 3-6 scenes including brollHint for each scene.`]
    if (customPrompt) parts.push(`\nThe user has a specific direction:\n\n---\n${customPrompt}\n---\n\nGenerate ideas that focus on this direction while incorporating relevant context below.`)
    if (directionDetails) parts.push(`\nDirection:\n${directionDetails}`)
    if (emailContext) parts.push(`\nClient context:\n${emailContext}`)
    parts.push(`\nContext:\n${contextText}`)
    parts.push('\nReturn a JSON object with a single key "ideas" containing an array of ideas. No markdown, no code fences.')
    userPrompt = parts.join('\n')
  }

  onStep?.({ step: 'calling_llm', detail: mode === 'from_direction' ? 'Polishing script with GPT-4o...' : 'Brainstorming with GPT-4o...' })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: mode === 'from_direction' ? 0.5 : 0.8,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[generate-ideas] OpenAI error:', errText)
    return { ideas: [], addedToQueue: 0, mode, error: 'AI generation failed' }
  }

  onStep?.({ step: 'parsing', detail: 'Processing AI response...' })

  const aiResult = await response.json()
  const content = aiResult.choices?.[0]?.message?.content
  const usage = aiResult.usage
  if (usage) {
    recordOpenAICost(usage, 'gpt-4o', undefined, {
      operation: 'video_ideas_generation',
      mode,
    }).catch(() => {})
  }

  if (!content) {
    return { ideas: [], addedToQueue: 0, mode, error: 'No AI response' }
  }

  let parsed: { ideas?: VideoIdea[] }
  try {
    parsed = JSON.parse(content)
  } catch {
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        parsed = { ideas: JSON.parse(match[0]) }
      } catch {
        console.error('[generate-ideas] Failed to parse AI response:', content.slice(0, 500))
        return { ideas: [], addedToQueue: 0, mode, error: 'Failed to parse AI response' }
      }
    } else {
      console.error('[generate-ideas] No JSON array in response:', content.slice(0, 500))
      return { ideas: [], addedToQueue: 0, mode, error: 'Failed to parse AI response' }
    }
  }

  const ideas: VideoIdea[] = Array.isArray(parsed.ideas)
    ? parsed.ideas
    : Array.isArray(parsed)
      ? (parsed as unknown as VideoIdea[])
      : []

  if (ideas.length === 0) {
    return { ideas: [], addedToQueue: 0, mode }
  }

  onStep?.({ step: 'inserting', detail: `Adding ${ideas.length} draft(s) to queue...` })

  const source = mode === 'from_direction' ? 'manual' : 'llm_generated'
  const rows = ideas.map((idea) => ({
    title: idea.title,
    script_text: idea.script,
    storyboard_json: idea.storyboard ?? { scenes: [] },
    source,
    status: 'pending',
    custom_prompt: customPrompt || null,
  }))
  const { data: inserted, error } = await supabaseAdmin
    .from('video_ideas_queue')
    .insert(rows)
    .select('id')

  let addedToQueue = 0
  if (error) {
    console.error('[generate-ideas] Queue insert error:', error)
  } else if (inserted) {
    addedToQueue = inserted.length
  }

  return { ideas, addedToQueue, mode }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const params = parseBody(body)
    const wantsSSE = request.headers.get('accept')?.includes('text/event-stream')

    if (!wantsSSE) {
      const result = await runGeneration(params, apiKey)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      return NextResponse.json({ ideas: result.ideas, addedToQueue: result.addedToQueue, mode: result.mode })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
        }

        try {
          const result = await runGeneration(params, apiKey, send)

          if (result.error) {
            send({ step: 'error', error: result.error })
          } else {
            send({
              step: 'done',
              ideas: result.ideas.length,
              addedToQueue: result.addedToQueue,
              mode: result.mode,
            })
          }
        } catch (err) {
          send({ step: 'error', error: err instanceof Error ? err.message : String(err) })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[generate-ideas] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
