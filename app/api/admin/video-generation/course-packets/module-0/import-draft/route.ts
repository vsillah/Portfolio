import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  ACCELERATED_MODULE0_DRAFT_MARKER,
  buildAcceleratedModule0VideoDraft,
} from '@/lib/accelerated-module0-video-draft'
import { normalizeVideoScriptTemplate, SCRIPT_INTELLIGENCE_SIDE_EFFECTS } from '@/lib/video-script-intelligence'

export const dynamic = 'force-dynamic'

function isMissingScriptIntelligenceColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42703' && /script_template_id|script_outline|script_scorecard|research_packet_ids/.test(error.message ?? '')
}

async function getAcceleratedLessonTemplateId() {
  const { data, error } = await supabaseAdmin
    .from('video_script_templates')
    .select('id, key, name, description, source_type, source_urls, outline, status')
    .eq('key', 'accelerated_lesson')
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.warn('[video-generation] Module 0 template lookup skipped:', error)
    return null
  }

  return data ? normalizeVideoScriptTemplate(data).id : null
}

async function findExistingDraft() {
  const { data, error } = await supabaseAdmin
    .from('video_ideas_queue')
    .select('id, title, status, created_at, custom_prompt')
    .eq('custom_prompt', ACCELERATED_MODULE0_DRAFT_MARKER)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[video-generation] Module 0 draft lookup error:', error)
    throw new Error('Failed to check for existing Module 0 draft')
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({})) as { force?: boolean }
    const existingDraft = await findExistingDraft()

    if (existingDraft && !body.force) {
      return NextResponse.json({
        draft: existingDraft,
        reused: true,
        marker: ACCELERATED_MODULE0_DRAFT_MARKER,
        side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
      })
    }

    const templateId = await getAcceleratedLessonTemplateId()
    const draft = buildAcceleratedModule0VideoDraft()
    const insertPayload = {
      ...draft,
      script_template_id: templateId,
    }

    let { data, error } = await supabaseAdmin
      .from('video_ideas_queue')
      .insert(insertPayload)
      .select('id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, created_at, script_template_id, script_outline, script_scorecard, research_packet_ids')
      .single()

    if (isMissingScriptIntelligenceColumn(error)) {
      const fallbackPayload = {
        title: draft.title,
        script_text: draft.script_text,
        storyboard_json: draft.storyboard_json,
        source: draft.source,
        status: draft.status,
        custom_prompt: draft.custom_prompt,
      }

      const fallback = await supabaseAdmin
        .from('video_ideas_queue')
        .insert(fallbackPayload)
        .select('id, title, script_text, storyboard_json, source, status, video_generation_job_id, custom_prompt, created_at')
        .single()

      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[video-generation] Module 0 draft insert error:', error)
      return NextResponse.json({ error: 'Failed to import Module 0 draft' }, { status: 500 })
    }

    return NextResponse.json({
      draft: data,
      reused: false,
      marker: ACCELERATED_MODULE0_DRAFT_MARKER,
      side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
    })
  } catch (error) {
    console.error('[video-generation] Module 0 draft import error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
