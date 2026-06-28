import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  normalizeScriptOutline,
  normalizeVideoScriptTemplate,
  SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
} from '@/lib/video-script-intelligence'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()).slice(0, 5)
    : []
}

function outlineFromPackets(packets: Array<Record<string, unknown>>) {
  const first = packets[0] ?? {}
  const pattern = asRecord(first.pattern_packet)
  const hook = asString(pattern.hook_structure) || asString(first.hook_transcript)
  const promise = asString(pattern.promise_value)
  const tension = asString(pattern.tension_or_missed_opportunity)

  return normalizeScriptOutline({
    pain_point: tension || 'Use the source pattern to name the viewer pain before teaching.',
    hook: hook || 'Open with the problem the viewer already feels.',
    open_loop: promise || 'Promise a clearer way to understand the problem.',
    frame: asString(pattern.title_pattern) || 'Translate the source structure into an AmaduTown operating frame.',
    proof_demo: asString(pattern.proof_style) || 'Show AmaduTown proof rather than repeating the creator example.',
    teaching_beats: [
      'Name the audience problem.',
      'Reframe it into a practical operating lesson.',
      'Show the AmaduTown proof cue.',
    ],
    cta: asString(pattern.cta_style) || 'Close with one concrete action for the viewer.',
    closing_question: 'Ask where this problem is showing up in the viewer work.',
    thumbnail_promise: asString(pattern.thumbnail_pattern) || 'Translate the visual promise into AmaduTown style.',
    source_distance_notes: 'Creator research is used for outline structure only. Do not copy script, title, thumbnail, claims, or visual identity.',
  })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = asRecord(await request.json().catch(() => ({})))
  const researchPacketIds = cleanIds(body.research_packet_ids)
  if (researchPacketIds.length === 0) {
    return NextResponse.json({ error: 'research_packet_ids are required' }, { status: 400 })
  }

  try {
    const { data: packets, error: packetError } = await supabaseAdmin
      .from('social_content_research_packets')
      .select('id, source_url, platform, title, hook_transcript, pattern_packet, pattern_status, privacy_notes')
      .in('id', researchPacketIds)

    if (packetError) throw new Error(packetError.message)
    if (!packets || packets.length === 0) {
      return NextResponse.json({ error: 'No research packets found' }, { status: 404 })
    }

    const packetRows = packets as Array<Record<string, unknown>>
    const firstTitle = asString(packetRows[0].title) || 'Creator pattern'
    const key = asString(body.key) || `creator_pattern_${researchPacketIds[0].slice(0, 8)}`
    const outline = outlineFromPackets(packetRows)

    const { data: template, error: templateError } = await supabaseAdmin
      .from('video_script_templates')
      .insert({
        key,
        name: asString(body.name) || `Creator pattern: ${firstTitle}`.slice(0, 120),
        description: asString(body.description) || 'Reusable outline extracted from approved public creator research. Pattern only; no copying.',
        source_type: 'creator_pattern',
        source_urls: packetRows.map((packet) => asString(packet.source_url)).filter(Boolean),
        outline,
        status: 'active',
        created_by: auth.user.id,
      })
      .select('*')
      .single()

    if (templateError) throw new Error(templateError.message)

    return NextResponse.json({
      success: true,
      template: normalizeVideoScriptTemplate(template as Record<string, unknown>),
      research_packet_ids: researchPacketIds,
      side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
    })
  } catch (error) {
    console.error('[video-script-templates] research extraction failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create template from research' },
      { status: 500 },
    )
  }
}
