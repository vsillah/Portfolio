import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CALENDAR_SIDE_EFFECTS,
  defaultAuthorizationDueAt,
  deriveDueStatus,
  isAuthorizationStatus,
  isCalendarChannel,
  isCampaignPhase,
  isDueStatus,
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

function nullableUuid(value: unknown) {
  const text = cleanText(value)
  return text || null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    for (const field of ['campaign_id', 'agent_work_item_id', 'social_content_id'] as const) {
      if (field in body) updates[field] = nullableUuid(body[field])
    }
    if ('channel' in body) {
      if (!isCalendarChannel(body.channel)) {
        return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
      }
      updates.channel = body.channel
    }
    if ('campaign_phase' in body) {
      if (!isCampaignPhase(body.campaign_phase)) {
        return NextResponse.json({ error: 'Invalid campaign phase' }, { status: 400 })
      }
      updates.campaign_phase = body.campaign_phase
    }
    if ('due_status' in body) {
      if (!isDueStatus(body.due_status)) {
        return NextResponse.json({ error: 'Invalid due status' }, { status: 400 })
      }
      updates.due_status = body.due_status
    }
    if ('authorization_status' in body) {
      if (!isAuthorizationStatus(body.authorization_status)) {
        return NextResponse.json({ error: 'Invalid authorization status' }, { status: 400 })
      }
      updates.authorization_status = body.authorization_status
    }
    if ('title' in body) {
      const title = cleanText(body.title)
      if (!title) return NextResponse.json({ error: 'Title cannot be blank' }, { status: 400 })
      updates.title = title.slice(0, 240)
    }
    if ('planned_angle' in body) updates.planned_angle = cleanText(body.planned_angle) || null
    if ('scheduled_for' in body) {
      const scheduledFor = isoOrNull(body.scheduled_for)
      if (!scheduledFor) return NextResponse.json({ error: 'Valid scheduled_for is required' }, { status: 400 })
      updates.scheduled_for = scheduledFor
      if (!('due_status' in body)) updates.due_status = deriveDueStatus(scheduledFor)
      if (!('authorization_due_at' in body)) {
        updates.authorization_due_at = defaultAuthorizationDueAt(scheduledFor)
      }
    }
    if ('authorization_due_at' in body) updates.authorization_due_at = isoOrNull(body.authorization_due_at)
    if ('last_pinged_at' in body) updates.last_pinged_at = isoOrNull(body.last_pinged_at)
    if ('autonomy_eligible' in body) updates.autonomy_eligible = body.autonomy_eligible === true

    const metadataPatch = parseMetadata(body.metadata)
    const decisionNote = cleanText(body.decision_note)
    if (updates.authorization_status === 'rejected' && !decisionNote) {
      return NextResponse.json({ error: 'Decision note is required when rejecting a calendar item' }, { status: 400 })
    }

    if (Object.keys(metadataPatch).length > 0 || decisionNote || updates.authorization_status) {
      const { data: existing, error: readError } = await supabaseAdmin
        .from('social_content_calendar_items')
        .select('metadata')
        .eq('id', params.id)
        .maybeSingle()
      if (readError) throw readError
      const currentMetadata = parseMetadata(existing?.metadata)
      updates.metadata = {
        ...currentMetadata,
        ...metadataPatch,
        external_execution_enabled: false,
      }
      if (decisionNote) {
        updates.metadata = {
          ...(updates.metadata as Record<string, unknown>),
          authorization_decision_note: decisionNote,
        }
      }
      if (updates.authorization_status === 'authorized') {
        updates.metadata = {
          ...(updates.metadata as Record<string, unknown>),
          authorized_at: new Date().toISOString(),
          authorized_by: auth.user.id,
          draft_handoff_only: true,
        }
      }
      if (updates.authorization_status === 'rejected') {
        updates.metadata = {
          ...(updates.metadata as Record<string, unknown>),
          rejected_at: new Date().toISOString(),
          rejected_by: auth.user.id,
          returned_to_shaka: true,
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('social_content_calendar_items')
      .update(updates)
      .eq('id', params.id)
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
    })
  } catch (error) {
    console.error('[social-content-calendar] update failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update calendar item' },
      { status: 500 },
    )
  }
}
