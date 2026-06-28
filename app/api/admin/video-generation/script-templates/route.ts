import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  normalizeScriptOutline,
  normalizeVideoScriptTemplate,
  SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
  SEEDED_VIDEO_SCRIPT_TEMPLATES,
} from '@/lib/video-script-intelligence'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []
}

function isMissingTemplateTable(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  return message.includes('video_script_templates') && (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('Could not find the table')
  )
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('video_script_templates')
      .select('*')
      .eq('status', 'active')
      .order('source_type', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      if (isMissingTemplateTable(error)) {
        return NextResponse.json({
          templates: SEEDED_VIDEO_SCRIPT_TEMPLATES,
          unavailable: true,
          side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
        })
      }
      throw new Error(error.message)
    }

    return NextResponse.json({
      templates: ((data ?? []) as Array<Record<string, unknown>>).map((row) => normalizeVideoScriptTemplate(row)),
      side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
    })
  } catch (error) {
    console.error('[video-script-templates] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list script templates' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const name = asString(body.name)
  const key = asString(body.key) || name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!key || !name) {
    return NextResponse.json({ error: 'key and name are required' }, { status: 400 })
  }

  const sourceType = body.source_type === 'creator_pattern' || body.source_type === 'amadutown_performance'
    ? body.source_type
    : 'seeded'
  const outline = normalizeScriptOutline(body.outline)

  try {
    const { data, error } = await supabaseAdmin
      .from('video_script_templates')
      .insert({
        key,
        name,
        description: asString(body.description),
        source_type: sourceType,
        source_urls: asStringArray(body.source_urls),
        outline,
        status: 'active',
        created_by: auth.user.id,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      template: normalizeVideoScriptTemplate(data as Record<string, unknown>),
      side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
    })
  } catch (error) {
    console.error('[video-script-templates] create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create script template' },
      { status: 500 },
    )
  }
}
