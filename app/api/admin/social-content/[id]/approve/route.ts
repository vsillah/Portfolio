import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import type { SocialPlatform } from '@/lib/social-content'
import { createAgentWorkItem } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

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
      title: 'Prepare approved Social Content illustration brief',
      ownerAgentKey: 'amadutown-brand',
      priority: 'medium' as const,
      productionLane: 'illustration',
      objective: [
        'Turn the approved draft into a brand-safe illustration brief and image prompt for the AmaduTown visual system.',
        'Document style, accessibility, claim, and evidence boundaries before any provider generation is requested.',
      ].join(' '),
      requiredActions: [
        'Confirm the illustration is labeled as an illustration, not evidence.',
        'Attach the approved image prompt and brand constraints.',
        'Identify any required operator approval before generation.',
      ],
    },
    {
      title: 'Prepare Social Content carousel production packet',
      ownerAgentKey: 'content-repurposing',
      priority: 'medium' as const,
      productionLane: 'carousel',
      objective: [
        'Prepare the optional carousel or single-image production packet from the approved draft, references, and illustration brief.',
        'Keep rendering, uploads, provider calls, and scheduling behind separate governed approvals.',
      ].join(' '),
      requiredActions: [
        'Draft the slide-by-slide carousel outline or record why single-image is better.',
        'Map any slide claims to approved references.',
        'Record render/provider prerequisites without triggering them.',
      ],
    },
    {
      title: 'Run post-approval visual QA',
      ownerAgentKey: 'risk-compliance-intelligence',
      priority: 'medium' as const,
      productionLane: 'visual_qa',
      objective: [
        'Review the reference, illustration, and carousel production packet for accessibility, privacy, unsupported claims, and misrepresentation risk.',
        'Return a clear pass/revise recommendation before any publish or provider-generation approval.',
      ].join(' '),
      requiredActions: [
        'Check accessibility and mobile readability risks.',
        'Confirm visual claims do not imply unsupported proof.',
        'List any residual risks for human publish approval.',
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

/**
 * POST /api/admin/social-content/[id]/approve
 * Approve content, create per-platform publish records, and trigger immediate publishing
 * if no scheduled_for date is set. For scheduled posts, WF-SOC-003 handles later dispatch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { id } = params

    const { data: item, error: fetchError } = await admin
      .from('social_content_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    if (item.status === 'published') {
      return NextResponse.json({ error: 'Content is already published' }, { status: 400 })
    }

    const ragContext = recordValue(item.rag_context)
    const isAgentOpsDraftOnly = ragContext?.source === 'agent_ops_social_outreach_goal' &&
      ragContext.publish_gate === 'draft_only'
    if (
      isAgentOpsDraftOnly &&
      ragContext.pass_to_human !== true
    ) {
      return NextResponse.json({
        error: 'Agent Ops content has not cleared challenger QA for human approval',
        current_gate: typeof ragContext.current_gate === 'string' ? ragContext.current_gate : null,
        challenger_status: typeof ragContext.challenger_status === 'string' ? ragContext.challenger_status : null,
      }, { status: 409 })
    }

    // Update status to approved
    const { data: updated, error: updateError } = await admin
      .from('social_content_queue')
      .update({
        status: 'approved',
        reviewed_by: authResult.user.id,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error approving content:', updateError)
      return NextResponse.json({ error: 'Failed to approve content' }, { status: 500 })
    }

    if (isAgentOpsDraftOnly) {
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

      return NextResponse.json({
        item: updated,
        publish_triggered: false,
        publishes: [],
        reference_work_item: productionWorkItems.find((workItem) => workItem.production_lane === 'references') ?? null,
        production_work_items: productionWorkItems,
      })
    }

    // Create social_content_publishes rows — one per target platform
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

    // Content approval prepares internal platform rows only. External submit now
    // requires the explicit final platform-submission gate.
    const publishTriggered = false

    // Load publish records for the response
    const { data: publishes } = await admin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)

    return NextResponse.json({
      item: updated,
      publish_triggered: publishTriggered,
      publishes,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
