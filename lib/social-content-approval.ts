import type { SupabaseClient } from '@supabase/supabase-js'
import type { SocialPlatform } from '@/lib/social-content'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import { syncCampaignCalendarForSocialContent } from '@/lib/social-content-calendar-linkage'

type SocialContentApprovalPayload = Record<string, unknown>

export class SocialContentApprovalError extends Error {
  status: number
  payload: SocialContentApprovalPayload

  constructor(status: number, payload: SocialContentApprovalPayload) {
    super(typeof payload.error === 'string' ? payload.error : 'Social content approval failed')
    this.status = status
    this.payload = payload
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function productionHandoffDefinitions(id: string, ragContext: Record<string, unknown> | null) {
  const commonMetadata = {
    social_content_id: id,
    social_content_href: `/admin/social-content/${id}`,
    goal_id: stringValue(ragContext?.goal_id),
    goal_type: stringValue(ragContext?.goal_type),
    content_packet_id: stringValue(ragContext?.content_packet_id),
    launch_draft_asset_id: stringValue(ragContext?.launch_draft_asset_id),
    launch_packet_path: stringValue(ragContext?.launch_packet_path),
    publish_gate: 'draft_only',
    approval_result: 'human_editorial_approved',
    approval_boundary: 'post_approval_production_handoff_only',
    blocked_actions: [
      'Do not publish or schedule.',
      'Do not send DMs or external outreach.',
      'Do not call image, audio, carousel render, or provider-generation APIs.',
      'Do not mutate production systems outside Agent Ops work-item routing.',
    ],
  }

  return [
    {
      title: 'Attach approved Social Content references',
      ownerAgentKey: 'research-source-register',
      priority: 'high' as const,
      productionLane: 'references',
      objective: [
        'Add the approved draft references and source links to the Social Content packet after human editorial approval.',
        'Confirm public references are safe to cite, source URLs are traceable, and claim boundaries are visible.',
        'Do not publish, schedule, send, call providers, or mutate production systems.',
      ].join(' '),
      requiredActions: [
        'Attach public source/reference links to the approved draft packet.',
        'Mark unsupported or private-derived claims for revision before publish approval.',
        'Record reference placement guidance for the final post or carousel.',
      ],
    },
    {
      title: 'Select Agentified visual strategy and run QA',
      ownerAgentKey: 'strategic-narrative',
      priority: 'medium' as const,
      productionLane: 'visual_strategy_qa',
      objective: [
        'Amina selects the right visual form for the approved draft using recorded context, approved brand/source assets, channel constraints, and public-safe comparable creator patterns.',
        'Reuse or derive from approved assets when suitable; otherwise generate candidates through the bounded internal visual suitability loop.',
        'Record rationale, provenance, originality and rights checks, accessibility findings, mobile legibility, privacy risks, and pass/fail QA before final human visual review.',
        'Do not publish, schedule, submit to LinkedIn, or call external provider handoff actions.',
      ].join(' '),
      requiredActions: [
        'Search approved Portfolio, Agentified, AmaduTown, and comparable-pattern sources before creating anything new.',
        'Choose the visual form: carousel, framework, diagram, photo-led composition, or no visual if that is the safest channel fit.',
        'Create or attach candidate assets with source provenance and rationale.',
        'Run the agent-led QA gate across brand fit, factual consistency, LinkedIn/mobile legibility, alt-text readiness, privacy, rights, quality, and artifacts.',
        'Escalate only rights/privacy uncertainty, unsupported claims, failed QA, low confidence, budget thresholds, or provider/publication boundaries.',
      ],
    },
  ].map((definition) => ({
    ...definition,
    metadata: {
      ...commonMetadata,
      source: 'social_content_production_handoff',
      production_lane: definition.productionLane,
      required_actions: definition.requiredActions,
    },
  }))
}

export async function approveSocialContentItem({
  admin,
  id,
  reviewedByUserId,
}: {
  admin: SupabaseClient
  id: string
  reviewedByUserId: string
}) {
  const { data: item, error: fetchError } = await admin
    .from('social_content_queue')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !item) {
    throw new SocialContentApprovalError(404, { error: 'Content not found' })
  }

  if (item.status === 'published') {
    throw new SocialContentApprovalError(400, { error: 'Content is already published' })
  }

  const ragContext = recordValue(item.rag_context)
  const isAgenticLaunchDraft = ragContext?.source === 'agentic_sales_outreach_launch_draft'
  const isDraftOnlyReview = ragContext?.publish_gate === 'draft_only' || isAgenticLaunchDraft
  const isAgentOpsDraftOnly = ragContext?.source === 'agent_ops_social_outreach_goal' && isDraftOnlyReview

  if (
    isAgentOpsDraftOnly &&
    ragContext.pass_to_human !== true
  ) {
    throw new SocialContentApprovalError(409, {
      error: 'Agent Ops content has not cleared challenger QA for human approval',
      current_gate: typeof ragContext.current_gate === 'string' ? ragContext.current_gate : null,
      challenger_status: typeof ragContext.challenger_status === 'string' ? ragContext.challenger_status : null,
    })
  }

  const { data: updated, error: updateError } = await admin
    .from('social_content_queue')
    .update({
      status: 'approved',
      reviewed_by: reviewedByUserId,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) {
    console.error('Error approving content:', updateError)
    throw new SocialContentApprovalError(500, { error: 'Failed to approve content' })
  }

  const calendarLinkage = await syncCampaignCalendarForSocialContent({
    admin,
    socialContentId: id,
    event: {
      type: 'copy_approved',
      at: new Date().toISOString(),
      userId: reviewedByUserId,
    },
  })

  if (isDraftOnlyReview) {
    const productionWorkItems = []
    for (const definition of productionHandoffDefinitions(id, ragContext)) {
      const workItem = await createAgentWorkItem({
        title: definition.title,
        objective: definition.objective,
        priority: definition.priority,
        status: 'assigned',
        ownerAgentKey: definition.ownerAgentKey,
        source: {
          type: 'social_content_approval',
          id,
          label: 'Social Content draft approval',
        },
        expectedFiles: [],
        metadata: definition.metadata,
        idempotencyKey: definition.productionLane === 'references'
          ? `social-content-reference-handoff:${id}`
          : `social-content-production-handoff:${id}:${definition.productionLane}`,
      })
      productionWorkItems.push({
        id: workItem.id,
        title: workItem.title,
        status: workItem.status,
        owner_agent_key: workItem.owner_agent_key,
        production_lane: definition.productionLane,
      })
    }

    return {
      item: updated,
      publish_triggered: false,
      publishes: [],
      calendar_linkage: calendarLinkage,
      reference_work_item: productionWorkItems.find((workItem) => workItem.production_lane === 'references') ?? null,
      production_work_items: productionWorkItems,
    }
  }

  const targetPlatforms: SocialPlatform[] = updated.target_platforms?.length
    ? updated.target_platforms
    : ['linkedin']

  const publishRows = targetPlatforms.map((platform: SocialPlatform) => ({
    content_id: id,
    platform,
    status: 'pending' as const,
  }))

  const { error: insertError } = await admin
    .from('social_content_publishes')
    .upsert(publishRows, { onConflict: 'content_id,platform' })

  if (insertError) {
    console.error('Error creating publish records:', insertError)
  }

  const { data: publishes } = await admin
    .from('social_content_publishes')
    .select('*')
    .eq('content_id', id)

  return {
    item: updated,
    publish_triggered: false,
    publishes,
    calendar_linkage: calendarLinkage,
  }
}
