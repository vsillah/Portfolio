import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import {
  agentifiedLaunchImportPlan,
  agentifiedLaunchSummary,
  buildAgentifiedCalendarRow,
  buildAgentifiedWorkItemInput,
} from '@/lib/agentified-launch-campaign'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type CampaignRow = {
  id: string
  slug: string
  status?: string | null
}

type ExistingCalendarRow = {
  id: string
  metadata?: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

async function upsertCampaign(userId: string) {
  const plan = agentifiedLaunchImportPlan()
  const { data: existing, error: readError } = await supabaseAdmin
    .from('attraction_campaigns')
    .select('*')
    .eq('slug', plan.campaign.slug)
    .maybeSingle()

  if (readError) throw readError

  const campaignPatch = {
    name: plan.campaign.name,
    slug: plan.campaign.slug,
    description: plan.campaign.description,
    campaign_type: plan.campaign.campaign_type,
    starts_at: plan.campaign.starts_at,
    ends_at: plan.campaign.ends_at,
    enrollment_deadline: plan.campaign.enrollment_deadline,
    completion_window_days: plan.campaign.completion_window_days,
    min_purchase_amount: plan.campaign.min_purchase_amount,
    payout_type: plan.campaign.payout_type,
    payout_amount_type: plan.campaign.payout_amount_type,
    payout_amount_value: plan.campaign.payout_amount_value,
    rollover_bonus_multiplier: plan.campaign.rollover_bonus_multiplier,
    hero_image_url: plan.campaign.hero_image_url,
    promo_copy: plan.campaign.promo_copy,
  }

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('attraction_campaigns')
      .update(campaignPatch)
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return { campaign: data as CampaignRow, created: false, updated: true }
  }

  const { data, error } = await supabaseAdmin
    .from('attraction_campaigns')
    .insert({
      ...campaignPatch,
      status: plan.campaign.status,
      created_by: userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return { campaign: data as CampaignRow, created: true, updated: false }
}

async function readExistingCalendarItems(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('social_content_calendar_items')
    .select('id, metadata')
    .eq('campaign_id', campaignId)

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw error
  }

  return (data ?? []) as ExistingCalendarRow[]
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    summary: agentifiedLaunchSummary(),
  })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const plan = agentifiedLaunchImportPlan()
    const campaignResult = await upsertCampaign(auth.user.id)

    const workItems = []
    for (const item of plan.calendar_items) {
      const workItem = await createAgentWorkItem(buildAgentifiedWorkItemInput(item))
      workItems.push({ asset_id: item.asset_id, work_item: workItem })
    }

    const existingCalendar = await readExistingCalendarItems(campaignResult.campaign.id)
    const existingByAssetId = new Map<string, ExistingCalendarRow>()
    for (const row of existingCalendar) {
      const assetId = asRecord(row.metadata).agentified_asset_id
      if (typeof assetId === 'string') existingByAssetId.set(assetId, row)
    }

    const inserted = []
    const updated = []
    for (const { asset_id, work_item } of workItems) {
      const item = plan.calendar_items.find((candidate) => candidate.asset_id === asset_id)
      if (!item) continue
      const row = buildAgentifiedCalendarRow({
        item,
        campaignId: campaignResult.campaign.id,
        workItemId: work_item.id,
        createdBy: auth.user.id,
      })
      const existing = existingByAssetId.get(asset_id)

      if (existing) {
        const { data, error } = await supabaseAdmin
          .from('social_content_calendar_items')
          .update(row)
          .eq('id', existing.id)
          .select('id, title, channel, campaign_phase, authorization_status, agent_work_item_id, metadata')
          .single()

        if (error) throw error
        updated.push(data)
      } else {
        const { data, error } = await supabaseAdmin
          .from('social_content_calendar_items')
          .insert(row)
          .select('id, title, channel, campaign_phase, authorization_status, agent_work_item_id, metadata')
          .single()

        if (error) throw error
        inserted.push(data)
      }
    }

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaignResult.campaign.id,
        slug: campaignResult.campaign.slug,
        created: campaignResult.created,
        updated: campaignResult.updated,
      },
      work_items: {
        total: workItems.length,
        ids: workItems.map(({ work_item }) => work_item.id),
      },
      calendar_items: {
        inserted_count: inserted.length,
        updated_count: updated.length,
        total: inserted.length + updated.length,
        inserted,
        updated,
      },
      review_links: {
        content_intelligence: '/admin/agents/content-intelligence',
        campaign_calendar: `/admin/campaigns/${campaignResult.campaign.id}`,
        agentified_admin: '/admin/content/agentified',
      },
      side_effects: plan.side_effects,
    })
  } catch (error) {
    console.error('[agentified-campaign-import] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import Agentified launch campaign' },
      { status: 500 },
    )
  }
}
