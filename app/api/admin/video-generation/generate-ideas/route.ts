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
import { recordOpenAICost, type Usage } from '@/lib/cost-calculator'
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import {
  fetchVideoIdeasContext,
  serializeContextForPrompt,
} from '@/lib/video-ideas-context'
import { fetchVideoContextByEmail } from '@/lib/video-context'
import {
  evaluateVideoIdeasGenerationBudget,
  recordVideoIdeasGenerationBudgetDecision,
  VIDEO_IDEAS_GENERATION_MAX_TOKENS,
  VIDEO_IDEAS_GENERATION_MODEL,
  VIDEO_IDEAS_GENERATION_OPERATION,
  VideoIdeasGenerationError,
} from '@/lib/video-ideas-generation'
import { fetchProviderWithRetry } from '@/lib/llm/provider-fetch'
import {
  buildScriptOutlineFromText,
  evaluateVideoScript,
  normalizeVideoScriptTemplate,
  scriptTemplatePromptBlock,
  SEEDED_VIDEO_SCRIPT_TEMPLATES,
  type VideoScriptTemplate,
  type VideoScriptTemplateOutline,
} from '@/lib/video-script-intelligence'

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
  scriptOutline?: Partial<VideoScriptTemplateOutline>
  storyboard: {
    scenes: VideoIdeaScene[]
  }
}

const IDEA_JSON_SCHEMA = `{
  "title": "string",
  "script": "string (full voice script)",
  "scriptOutline": {
    "pain_point": "string",
    "hook": "string",
    "open_loop": "string",
    "frame": "string",
    "proof_demo": "string",
    "teaching_beats": ["string"],
    "cta": "string",
    "closing_question": "string",
    "thumbnail_promise": "string",
    "source_distance_notes": "string"
  },
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
  scriptTemplateId: string
  researchPacketIds: string[]
  scriptIntent: string
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
    scriptTemplateId: typeof body.scriptTemplateId === 'string' ? (body.scriptTemplateId as string).trim() : '',
    researchPacketIds: Array.isArray(body.researchPacketIds) ? (body.researchPacketIds as string[]).filter(id => typeof id === 'string').slice(0, 5) : [],
    scriptIntent: typeof body.scriptIntent === 'string' ? (body.scriptIntent as string).trim().slice(0, 1000) : '',
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function fetchScriptTemplate(templateId: string): Promise<VideoScriptTemplate | null> {
  if (!templateId) return null
  const seeded = SEEDED_VIDEO_SCRIPT_TEMPLATES.find((template) => template.id === templateId || template.key === templateId)
  if (!isUuid(templateId)) return seeded ?? null

  const { data, error } = await supabaseAdmin
    .from('video_script_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (error || !data) return seeded ?? null
  return normalizeVideoScriptTemplate(data as Record<string, unknown>)
}

async function fetchResearchPackets(researchPacketIds: string[]) {
  if (researchPacketIds.length === 0) return []
  const { data, error } = await supabaseAdmin
    .from('social_content_research_packets')
    .select('id, source_url, platform, title, hook_transcript, pattern_packet, pattern_status, privacy_notes')
    .in('id', researchPacketIds)
  if (error) return []
  return (data ?? []) as Array<Record<string, unknown>>
}

async function runGeneration(
  params: GenerateParams,
  apiKey: string,
  agentRunId?: string | null,
  onStep?: (data: Record<string, unknown>) => void
): Promise<{ ideas: VideoIdea[]; addedToQueue: number; mode: string; error?: string }> {
  const { mode, limit, includeTranscripts, customPrompt, email, audience, tone, angle, meetingIds, scriptTemplateId, researchPacketIds, scriptIntent } = params

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

  const scriptTemplate = await fetchScriptTemplate(scriptTemplateId)
  const researchPackets = await fetchResearchPackets(researchPacketIds)
  const scriptTemplateBlock = scriptTemplatePromptBlock(scriptTemplate, researchPackets)

  const directionDetails = [
    audience && `Target audience: ${audience}`,
    tone && `Tone/style: ${tone}`,
    angle && `Angle/hook: ${angle}`,
    scriptIntent && `Script intent: ${scriptIntent}`,
    scriptTemplateBlock && `Script intelligence:\n${scriptTemplateBlock}`,
  ].filter(Boolean).join('\n')

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
    parts.push('\nReturn a JSON object with key "ideas". Every idea must include scriptOutline with pain_point, hook, open_loop, frame, proof_demo, teaching_beats, cta, closing_question, thumbnail_promise, and source_distance_notes. No markdown, no code fences.')
    userPrompt = parts.join('\n')
  } else {
    systemPrompt = BRAINSTORM_SYSTEM_PROMPT
    const parts = [`Based on the following context, generate ${limit} video ideas. Each idea must have a title, full voice script (300-800 words), and a storyboard with 3-6 scenes including brollHint for each scene.`]
    if (customPrompt) parts.push(`\nThe user has a specific direction:\n\n---\n${customPrompt}\n---\n\nGenerate ideas that focus on this direction while incorporating relevant context below.`)
    if (directionDetails) parts.push(`\nDirection:\n${directionDetails}`)
    if (emailContext) parts.push(`\nClient context:\n${emailContext}`)
    parts.push(`\nContext:\n${contextText}`)
    parts.push('\nReturn a JSON object with a single key "ideas" containing an array of ideas. Every idea must include scriptOutline with pain_point, hook, open_loop, frame, proof_demo, teaching_beats, cta, closing_question, thumbnail_promise, and source_distance_notes. No markdown, no code fences.')
    userPrompt = parts.join('\n')
  }

  onStep?.({ step: 'budget_check', detail: 'Checking Agent Ops budget before AI dispatch...' })
  const budgetDecision = evaluateVideoIdeasGenerationBudget({
    systemPrompt,
    userPrompt,
    model: VIDEO_IDEAS_GENERATION_MODEL,
    maxTokens: VIDEO_IDEAS_GENERATION_MAX_TOKENS,
  })
  await recordVideoIdeasGenerationBudgetDecision({
    agentRunId,
    mode,
    limit,
    decision: budgetDecision,
  })
  if (budgetDecision.status === 'blocked') {
    throw new VideoIdeasGenerationError(budgetDecision.reason, 'budget_blocked')
  }

  onStep?.({ step: 'calling_llm', detail: mode === 'from_direction' ? 'Polishing script with GPT-4o...' : 'Brainstorming with GPT-4o...' })

  const response = await fetchProviderWithRetry('openai', 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VIDEO_IDEAS_GENERATION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: mode === 'from_direction' ? 0.5 : 0.8,
      max_tokens: VIDEO_IDEAS_GENERATION_MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[generate-ideas] OpenAI error:', errText)
    throw new VideoIdeasGenerationError('AI generation failed', 'openai_upstream')
  }

  onStep?.({ step: 'parsing', detail: 'Processing AI response...' })

  const aiResult = await response.json()
  const content = aiResult.choices?.[0]?.message?.content
  const usage = aiResult.usage as Usage | undefined
  if (usage) {
    recordOpenAICost(
      usage,
      VIDEO_IDEAS_GENERATION_MODEL,
      { type: 'video_ideas_generation', id: agentRunId ?? mode },
      {
        operation: VIDEO_IDEAS_GENERATION_OPERATION,
        mode,
        budget_status: budgetDecision.status,
        budget_rule_key: budgetDecision.rule.key,
        budget_estimated_cost_usd: budgetDecision.estimatedCostUsd,
      },
      agentRunId ?? undefined,
    ).catch(() => {})
  }

  if (!content) {
    throw new VideoIdeasGenerationError('No AI response', 'invalid_response')
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
        throw new VideoIdeasGenerationError('Failed to parse AI response', 'invalid_response')
      }
    } else {
      console.error('[generate-ideas] No JSON array in response:', content.slice(0, 500))
      throw new VideoIdeasGenerationError('Failed to parse AI response', 'invalid_response')
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
  const templateDbId = scriptTemplate && isUuid(scriptTemplate.id) ? scriptTemplate.id : null
  const rows = ideas.map((idea) => {
    const ideaRecord = idea as VideoIdea & { script_outline?: Partial<VideoScriptTemplateOutline> }
    const providedOutline = ideaRecord.scriptOutline ?? ideaRecord.script_outline
    const scriptOutline = providedOutline && Object.keys(providedOutline).length > 0
      ? providedOutline
      : buildScriptOutlineFromText({ scriptText: idea.script, template: scriptTemplate })
    const scriptScorecard = evaluateVideoScript({
      scriptText: idea.script,
      outline: scriptOutline,
      template: scriptTemplate,
      researchPacketCount: researchPackets.length,
    })
    return {
      title: idea.title,
      script_text: idea.script,
      storyboard_json: idea.storyboard ?? { scenes: [] },
      source,
      status: 'pending',
      custom_prompt: customPrompt || null,
      script_template_id: templateDbId,
      script_outline: scriptOutline,
      script_scorecard: scriptScorecard,
      research_packet_ids: researchPackets.map((packet) => packet.id).filter((id): id is string => typeof id === 'string'),
    }
  })
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
  let agentRunId: string | null = null
  let parsedParams: GenerateParams | null = null
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const params = parseBody(body)
    parsedParams = params
    const wantsSSE = request.headers.get('accept')?.includes('text/event-stream')

    const agentRun = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'video_ideas_generation',
      title: params.mode === 'from_direction' ? 'Polish video idea draft' : 'Generate video ideas',
      subject: {
        type: 'video_ideas',
        label: params.customPrompt ? params.customPrompt.slice(0, 80) : `${params.mode}:${params.limit}`,
      },
      triggerSource: 'admin:video_generate_ideas',
      triggeredByUserId: auth.user.id,
      currentStep: 'Video ideas request validated',
      metadata: {
        mode: params.mode,
        limit: params.limit,
        include_transcripts: params.includeTranscripts,
        has_custom_prompt: !!params.customPrompt,
        has_email_context: !!params.email,
        meeting_ids_count: params.meetingIds.length,
        script_template_id: params.scriptTemplateId || null,
        research_packet_ids_count: params.researchPacketIds.length,
        has_script_intent: !!params.scriptIntent,
      },
    })
    agentRunId = agentRun.id
    const activeAgentRunId = agentRun.id

    await recordAgentStep({
      runId: activeAgentRunId,
      stepKey: 'video_ideas_request_validated',
      name: 'Video ideas request validated',
      status: 'completed',
      inputSummary: params.customPrompt ? params.customPrompt.slice(0, 240) : `${params.mode} request for ${params.limit} idea(s).`,
      metadata: {
        mode: params.mode,
        limit: params.limit,
        include_transcripts: params.includeTranscripts,
        meeting_ids_count: params.meetingIds.length,
        script_template_id: params.scriptTemplateId || null,
        research_packet_ids_count: params.researchPacketIds.length,
      },
      idempotencyKey: `${activeAgentRunId}:video_ideas_request_validated`,
    }).catch((err) => console.warn('[generate-ideas] agent validation step failed:', err))

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new VideoIdeasGenerationError('OPENAI_API_KEY is not configured', 'openai_not_configured')
    }

    if (!wantsSSE) {
      const result = await runGeneration(params, apiKey, activeAgentRunId)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      await endAgentRun({
        runId: activeAgentRunId,
        status: 'completed',
        currentStep: 'Video ideas queued',
        outcome: {
          mode: result.mode,
          ideas: result.ideas.length,
          added_to_queue: result.addedToQueue,
        },
      }).catch((err) => console.warn('[generate-ideas] end agent run failed:', err))
      return NextResponse.json({ ideas: result.ideas, addedToQueue: result.addedToQueue, mode: result.mode, agentRunId: activeAgentRunId })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
        }

        try {
          const result = await runGeneration(params, apiKey, activeAgentRunId, send)

          if (result.error) {
            send({ step: 'error', error: result.error })
          } else {
            await endAgentRun({
              runId: activeAgentRunId,
              status: 'completed',
              currentStep: 'Video ideas queued',
              outcome: {
                mode: result.mode,
                ideas: result.ideas.length,
                added_to_queue: result.addedToQueue,
              },
            }).catch((err) => console.warn('[generate-ideas] end agent run failed:', err))
            send({
              step: 'done',
              ideas: result.ideas.length,
              addedToQueue: result.addedToQueue,
              mode: result.mode,
              agentRunId: activeAgentRunId,
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await recordAgentStep({
            runId: activeAgentRunId,
            stepKey: 'video_ideas_generation_failed',
            name: 'Video ideas generation failed',
            status: 'failed',
            outputSummary: message,
            idempotencyKey: `${activeAgentRunId}:video_ideas_generation_failed`,
          }).catch((stepErr) => console.warn('[generate-ideas] agent failure step failed:', stepErr))
          await markAgentRunFailed(activeAgentRunId, message, {
            operation: VIDEO_IDEAS_GENERATION_OPERATION,
            mode: params.mode,
          }).catch((runErr) => console.warn('[generate-ideas] mark agent run failed:', runErr))
          send({ step: 'error', error: safeVideoIdeasErrorMessage(err), agentRunId: activeAgentRunId })
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
    if (agentRunId) {
      await recordAgentStep({
        runId: agentRunId,
        stepKey: 'video_ideas_generation_failed',
        name: 'Video ideas generation failed',
        status: 'failed',
        outputSummary: message,
        idempotencyKey: `${agentRunId}:video_ideas_generation_failed`,
      }).catch((stepErr) => console.warn('[generate-ideas] agent failure step failed:', stepErr))
      await markAgentRunFailed(agentRunId, message, {
        operation: VIDEO_IDEAS_GENERATION_OPERATION,
        mode: parsedParams?.mode ?? null,
      }).catch((runErr) => console.warn('[generate-ideas] mark agent run failed:', runErr))
    }

    if (error instanceof VideoIdeasGenerationError) {
      return NextResponse.json(
        { error: safeVideoIdeasErrorMessage(error), agentRunId },
        { status: videoIdeasErrorStatus(error) },
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function safeVideoIdeasErrorMessage(error: unknown): string {
  if (error instanceof VideoIdeasGenerationError) {
    if (error.code === 'budget_blocked') {
      return 'This video ideas request is over the current Agent Ops budget limit. Use fewer ideas, shorter notes, or less transcript context before retrying.'
    }
    if (error.code === 'openai_not_configured') {
      return 'OpenAI API key not configured'
    }
    if (error.code === 'openai_upstream') {
      return 'AI generation failed'
    }
    if (error.code === 'invalid_response') {
      return 'The AI returned an unexpected response. Try generating again or adjust the video idea prompt.'
    }
  }

  return error instanceof Error ? error.message : String(error)
}

function videoIdeasErrorStatus(error: VideoIdeasGenerationError): number {
  if (error.code === 'budget_blocked') return 400
  if (error.code === 'openai_not_configured') return 503
  if (error.code === 'openai_upstream' || error.code === 'invalid_response') return 502
  return 500
}
