/**
 * PATCH /api/admin/video-generation/ideas-queue/[id]
 * Update a pending video idea draft before generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildScriptOutlineFromText, evaluateVideoScript } from '@/lib/video-script-intelligence'

export const dynamic = 'force-dynamic'

const HEYGEN_SCRIPT_MAX = 5000
const MAX_STORYBOARD_SCENES = 12

type StoryboardScene = {
  sceneNumber?: number
  description?: string
  brollHint?: string
}

function cleanStoryboard(input: unknown): { scenes: StoryboardScene[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Storyboard must be an object with a scenes array.')
  }

  const scenes = (input as { scenes?: unknown }).scenes
  if (!Array.isArray(scenes)) {
    throw new Error('Storyboard must include a scenes array.')
  }
  if (scenes.length > MAX_STORYBOARD_SCENES) {
    throw new Error(`Storyboard cannot exceed ${MAX_STORYBOARD_SCENES} scenes.`)
  }

  return {
    scenes: scenes.map((scene, index) => {
      if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
        throw new Error(`Scene ${index + 1} must be an object.`)
      }
      const raw = scene as Record<string, unknown>
      const description = typeof raw.description === 'string' ? raw.description.trim() : ''
      const brollHint = typeof raw.brollHint === 'string' ? raw.brollHint.trim() : ''
      const sceneNumber = typeof raw.sceneNumber === 'number' && Number.isFinite(raw.sceneNumber)
        ? raw.sceneNumber
        : index + 1

      if (!description) {
        throw new Error(`Scene ${index + 1} needs a description.`)
      }

      return {
        sceneNumber,
        description,
        ...(brollHint ? { brollHint } : {}),
      }
    }),
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const scriptText = typeof body.scriptText === 'string' ? body.scriptText.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    }
    if (!scriptText) {
      return NextResponse.json({ error: 'Script is required.' }, { status: 400 })
    }
    if (scriptText.length > HEYGEN_SCRIPT_MAX) {
      return NextResponse.json(
        { error: `Script exceeds the ${HEYGEN_SCRIPT_MAX.toLocaleString()} character HeyGen limit.` },
        { status: 400 }
      )
    }

    let storyboardJson: { scenes: StoryboardScene[] }
    try {
      storyboardJson = cleanStoryboard(body.storyboardJson)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid storyboard.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const queueId = params.id
    const { data: queueItem, error: fetchErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .select('id, status, video_generation_job_id, script_template_id, script_outline, research_packet_ids')
      .eq('id', queueId)
      .single()

    if (fetchErr || !queueItem) {
      return NextResponse.json(
        { error: 'Ideas queue item not found' },
        { status: 404 }
      )
    }
    if (queueItem.status !== 'pending') {
      return NextResponse.json(
        { error: `Ideas queue item already ${queueItem.status}` },
        { status: 400 }
      )
    }
    if (queueItem.video_generation_job_id) {
      return NextResponse.json(
        { error: 'Generated drafts cannot be edited.' },
        { status: 400 }
      )
    }

    const scriptOutline = buildScriptOutlineFromText({
      scriptText,
      template: null,
    })
    const scriptScorecard = evaluateVideoScript({
      scriptText,
      outline: scriptOutline,
      researchPacketCount: Array.isArray(queueItem.research_packet_ids) ? queueItem.research_packet_ids.length : 0,
    })

    const { data: item, error: updateErr } = await supabaseAdmin
      .from('video_ideas_queue')
      .update({
        title,
        script_text: scriptText,
        storyboard_json: storyboardJson,
        script_outline: scriptOutline,
        script_scorecard: scriptScorecard,
      })
      .eq('id', queueId)
      .select('id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, script_template_id, script_outline, script_scorecard, research_packet_ids, created_at')
      .single()

    if (updateErr || !item) {
      console.error('[Video generation] Ideas queue update error:', updateErr)
      return NextResponse.json(
        { error: 'Failed to update draft' },
        { status: 500 }
      )
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[Video generation] Ideas queue update error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
