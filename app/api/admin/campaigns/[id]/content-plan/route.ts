import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  CALENDAR_SIDE_EFFECTS,
  campaignContentPlanSlots,
  type SocialContentCampaignPhase,
} from '@/lib/social-content-calendar'
import type { AttractionCampaign } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('attraction_campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (campaignError) {
      if (campaignError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      throw campaignError
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('social_content_calendar_items')
      .select('id, campaign_phase, channel')
      .eq('campaign_id', params.id)

    if (
      existingError
      && existingError.code !== '42P01'
      && existingError.code !== 'PGRST205'
    ) throw existingError

    const existingKeys = new Set(
      (existing ?? []).map((item: { campaign_phase: string; channel: string }) => (
        `${item.campaign_phase}:${item.channel}`
      )),
    )

    const slots = campaignContentPlanSlots(campaign as AttractionCampaign)
    const inserts = slots
      .filter((slot) => !existingKeys.has(`${slot.campaign_phase}:${slot.channel}`))
      .map((slot) => ({
        ...slot,
        campaign_id: params.id,
        created_by: auth.user.id,
        metadata: {
          ...slot.metadata,
          created_by_content_plan_route: true,
        },
      }))

    let insertedItems: unknown[] = []
    if (inserts.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('social_content_calendar_items')
        .insert(inserts)
        .select(`
          *,
          attraction_campaigns (id, name, slug, status, starts_at, ends_at),
          agent_work_items (id, title, status, priority),
          social_content_queue (id, status, post_text, scheduled_for)
        `)

      if (error) throw error
      insertedItems = data ?? []
    }

    return NextResponse.json({
      ok: true,
      campaign_id: params.id,
      created_count: insertedItems.length,
      skipped_existing_count: slots.length - inserts.length,
      planned_phases: slots.map((slot) => slot.campaign_phase as SocialContentCampaignPhase),
      items: insertedItems,
      side_effects: {
        ...CALENDAR_SIDE_EFFECTS,
        social_draft_created: false,
      },
    })
  } catch (error) {
    console.error('[campaign-content-plan] create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create campaign content plan' },
      { status: 500 },
    )
  }
}
