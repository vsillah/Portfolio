/**
 * POST /api/admin/video-generation/generate-ideas
 * Generate video ideas (script + storyboard) from context using LLM.
 * Optionally add ideas to video_ideas_queue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordOpenAICost } from '@/lib/cost-calculator'
import {
  fetchVideoIdeasContext,
  serializeContextForPrompt,
} from '@/lib/video-ideas-context'

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

const VIDEO_IDEAS_SYSTEM_PROMPT = `You are a video content strategist for AmaduTown (Vambah Sillah / Mad Hadda). Generate YouTube video ideas that are conversational, mission-driven, and no-BS. Each idea must include:
1. A catchy title
2. A voice script (300-800 words) suitable for HeyGen avatar narration — conversational, first-person, ends with "Let's get it" or similar sign-off
3. A storyboard with 3-6 scenes. Each scene has: sceneNumber, description, startPrompt (image prompt for start frame), endPrompt (image prompt for end frame), motionPrompt (what happens in the clip), brollHint (keyword for B-roll: e.g. "store", "services", "admin module sync", "about", "home")

Return a JSON array of ideas. Each idea:
{
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
}

Focus on topics that resonate with minority-owned businesses, technology as equalizer, AI adoption, and AmaduTown's offerings. Use the provided context (meetings, chat, website content) to inspire authentic, relevant ideas.`

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
    const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 10)
    const includeTranscripts = body.includeTranscripts !== false
    const addToQueue = body.addToQueue === true

    const ctx = await fetchVideoIdeasContext({
      includeTranscripts,
      meetingsLimit: 10,
      chatSessionsLimit: 5,
    })

    const contextText = serializeContextForPrompt(ctx)

    const userPrompt = `Based on the following context, generate ${limit} video ideas. Each idea must have a title, full voice script (300-800 words), and a storyboard with 3-6 scenes including brollHint for each scene.

Context:
${contextText}

Return a JSON object with a single key "ideas" containing an array of ideas. Example: { "ideas": [ { "title": "...", "script": "...", "storyboard": { "scenes": [...] } } ] }. No markdown, no code fences.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: VIDEO_IDEAS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[generate-ideas] OpenAI error:', errText)
      return NextResponse.json(
        { error: 'AI generation failed' },
        { status: 500 }
      )
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content
    const usage = aiResult.usage
    if (usage) {
      recordOpenAICost(usage, 'gpt-4o', undefined, {
        operation: 'video_ideas_generation',
      }).catch(() => {})
    }

    if (!content) {
      return NextResponse.json({ error: 'No AI response' }, { status: 500 })
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
          return NextResponse.json(
            { error: 'Failed to parse AI response' },
            { status: 500 }
          )
        }
      } else {
        console.error('[generate-ideas] No JSON array in response:', content.slice(0, 500))
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        )
      }
    }

    const ideas: VideoIdea[] = Array.isArray(parsed.ideas)
      ? parsed.ideas
      : Array.isArray(parsed)
        ? (parsed as unknown as VideoIdea[])
        : []

    if (ideas.length === 0) {
      return NextResponse.json({ ideas: [], addedToQueue: 0 })
    }

    let addedToQueue = 0
    if (addToQueue) {
      const rows = ideas.map((idea) => ({
        title: idea.title,
        script_text: idea.script,
        storyboard_json: idea.storyboard ?? { scenes: [] },
        source: 'llm_generated',
        status: 'pending',
      }))
      const { data: inserted, error } = await supabaseAdmin
        .from('video_ideas_queue')
        .insert(rows)
        .select('id')

      if (error) {
        console.error('[generate-ideas] Queue insert error:', error)
      } else if (inserted) {
        addedToQueue = inserted.length
      }
    }

    return NextResponse.json({
      ideas,
      addedToQueue,
    })
  } catch (error) {
    console.error('[generate-ideas] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
