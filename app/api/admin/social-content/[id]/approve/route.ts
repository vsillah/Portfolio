import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import type { SocialPlatform } from '@/lib/social-content'
import { createAgentWorkItem } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
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
      const referenceWorkItem = await createAgentWorkItem({
        title: 'Attach approved Social Content references',
        objective: [
          'Add the approved draft references and source links to the Social Content packet after human editorial approval.',
          'Confirm public references are safe to cite, source URLs are traceable, and framework illustration/carousel needs are recorded as separate draft asset actions.',
          'Do not publish, schedule, send, call providers, or mutate production systems.',
        ].join(' '),
        priority: 'high',
        status: 'assigned',
        ownerAgentKey: 'research-source-register',
        source: {
          type: 'social_content_approval',
          id,
          label: 'Social Content draft approval',
        },
        expectedFiles: [],
        metadata: {
          source: 'social_content_reference_handoff',
          social_content_id: id,
          social_content_href: `/admin/social-content/${id}`,
          goal_id: typeof ragContext?.goal_id === 'string' ? ragContext.goal_id : null,
          goal_type: typeof ragContext?.goal_type === 'string' ? ragContext.goal_type : null,
          content_packet_id: typeof ragContext?.content_packet_id === 'string' ? ragContext.content_packet_id : null,
          publish_gate: 'draft_only',
          approval_boundary: 'reference_handoff_only',
          approval_result: 'human_editorial_approved',
          required_actions: [
            'Attach public source/reference links to the approved draft packet.',
            'Record whether framework illustration or carousel work is needed as separate draft asset actions.',
            'Keep publishing and provider generation behind separate approval.',
          ],
        },
        idempotencyKey: `social-content-reference-handoff:${id}`,
      })

      return NextResponse.json({
        item: updated,
        publish_triggered: false,
        publishes: [],
        reference_work_item: {
          id: referenceWorkItem.id,
          title: referenceWorkItem.title,
          status: referenceWorkItem.status,
          owner_agent_key: referenceWorkItem.owner_agent_key,
        },
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

    // If no scheduled_for → trigger immediate publish via internal API
    let publishTriggered = false
    if (!updated.scheduled_for) {
      try {
        const origin = new URL(request.url).origin
        const publishRes = await fetch(`${origin}/api/admin/social-content/${id}/publish`, {
          method: 'POST',
          headers: {
            Authorization: request.headers.get('authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platforms: targetPlatforms }),
        })
        publishTriggered = publishRes.ok
      } catch (err) {
        console.error('Failed to trigger publish:', err)
      }
    }

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
