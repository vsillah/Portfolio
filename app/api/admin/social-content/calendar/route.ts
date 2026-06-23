import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CALENDAR_SIDE_EFFECTS,
  defaultAuthorizationDueAt,
  deriveDueStatus,
  normalizeAuthorizationStatus,
  normalizeCalendarChannel,
  normalizeCampaignPhase,
  normalizeDueStatus,
  parseMetadata,
} from '@/lib/social-content-calendar'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isoOrNull(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function limitFrom(value: string | null) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(Math.max(Math.floor(parsed), 1), 100)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const limit = limitFrom(searchParams.get('limit'))
    const campaignId = searchParams.get('campaign_id')
    const channel = searchParams.get('channel')
    const phase = searchParams.get('campaign_phase')
    const dueStatus = searchParams.get('due_status')
    const authorizationStatus = searchParams.get('authorization_status')
    const dueWindow = searchParams.get('due_window')
    const from = isoOrNull(searchParams.get('from'))
    const to = isoOrNull(searchParams.get('to'))

    let query = supabaseAdmin
      .from('social_content_calendar_items')
      .select(`
        *,
        attraction_campaigns (id, name, slug, status, starts_at, ends_at),
        agent_work_items (id, title, status, priority),
        social_content_queue (id, status, post_text, scheduled_for)
      `)
      .order('scheduled_for', { ascending: true })
      .limit(limit)

    if (campaignId) query = query.eq('campaign_id', campaignId)
    if (channel) query = query.eq('channel', normalizeCalendarChannel(channel))
    if (phase) query = query.eq('campaign_phase', normalizeCampaignPhase(phase))
    if (dueStatus) query = query.eq('due_status', normalizeDueStatus(dueStatus))
    if (authorizationStatus) {
      query = query.eq('authorization_status', normalizeAuthorizationStatus(authorizationStatus))
    }
    if (from) query = query.gte('scheduled_for', from)
    if (to) query = query.lte('scheduled_for', to)

    if (dueWindow === '24h' || dueWindow === '2h') {
      const now = new Date()
      const hours = dueWindow === '2h' ? 2 : 24
      query = query.gte('scheduled_for', now.toISOString())
        .lte('scheduled_for', new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString())
    } else if (dueWindow === 'past_due') {
      query = query.lt('scheduled_for', new Date().toISOString())
    }

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ items: [], side_effects: CALENDAR_SIDE_EFFECTS })
      }
      throw error
    }

    return NextResponse.json({
      items: data ?? [],
      side_effects: CALENDAR_SIDE_EFFECTS,
    })
  } catch (error) {
    console.error('[social-content-calendar] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load content calendar' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const title = cleanText(body.title)
    const scheduledFor = isoOrNull(body.scheduled_for)

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!scheduledFor) {
      return NextResponse.json({ error: 'Valid scheduled_for is required' }, { status: 400 })
    }

    const authorizationDueAt = isoOrNull(body.authorization_due_at)
      ?? defaultAuthorizationDueAt(scheduledFor)

    const insert = {
      campaign_id: cleanText(body.campaign_id) || null,
      agent_work_item_id: cleanText(body.agent_work_item_id) || null,
      social_content_id: cleanText(body.social_content_id) || null,
      channel: normalizeCalendarChannel(body.channel),
      campaign_phase: normalizeCampaignPhase(body.campaign_phase),
      title: title.slice(0, 240),
      planned_angle: cleanText(body.planned_angle) || null,
      scheduled_for: scheduledFor,
      due_status: normalizeDueStatus(body.due_status ?? deriveDueStatus(scheduledFor)),
      authorization_status: normalizeAuthorizationStatus(body.authorization_status),
      authorization_due_at: authorizationDueAt,
      autonomy_eligible: body.autonomy_eligible === true,
      metadata: {
        ...parseMetadata(body.metadata),
        external_execution_enabled: false,
      },
      created_by: auth.user.id,
    }

    const { data, error } = await supabaseAdmin
      .from('social_content_calendar_items')
      .insert(insert)
      .select(`
        *,
        attraction_campaigns (id, name, slug, status, starts_at, ends_at),
        agent_work_items (id, title, status, priority),
        social_content_queue (id, status, post_text, scheduled_for)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      item: data,
      side_effects: CALENDAR_SIDE_EFFECTS,
    }, { status: 201 })
  } catch (error) {
    console.error('[social-content-calendar] create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create calendar item' },
      { status: 500 },
    )
  }
}
