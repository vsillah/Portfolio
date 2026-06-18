import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import { getFullPostText } from '@/lib/social-content'
import { getProductionAssets, getVideoRedactionGate } from '@/lib/social-production-assets'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getVisualAsset(item: Record<string, unknown>) {
  const contentFormat = typeof item.content_format === 'string' ? item.content_format : 'single_image'
  const carouselUrls = asStringArray(item.carousel_slide_urls)
  if (contentFormat === 'carousel') {
    return carouselUrls.length
      ? {
          type: 'carousel',
          slide_urls: carouselUrls,
          pdf_url: typeof item.carousel_pdf_url === 'string' ? item.carousel_pdf_url : null,
        }
      : null
  }

  return typeof item.image_url === 'string' && item.image_url
    ? {
        type: 'single_image',
        image_url: item.image_url,
      }
    : null
}

function readinessBlockers(item: Record<string, unknown>, productionAssets: ReturnType<typeof getProductionAssets>) {
  const blockers: string[] = []
  if (item.status !== 'approved') blockers.push('Copy must be approved first.')
  if (!getVisualAsset(item)) blockers.push('Choose and generate a visual asset first.')
  if (!productionAssets) blockers.push('Prepare the asset packet first.')

  const redactionGate = getVideoRedactionGate(productionAssets)
  if (productionAssets && !redactionGate.ready) {
    blockers.push(redactionGate.message || 'Resolve video privacy review first.')
  }

  return blockers
}

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

    const itemRecord = asRecord(item)
    const ragContext = asRecord(itemRecord.rag_context)
    const isDraftOnlyAgentOps = ragContext.source === 'agent_ops_social_outreach_goal' &&
      ragContext.publish_gate === 'draft_only'
    if (!isDraftOnlyAgentOps) {
      return NextResponse.json(
        { error: 'LinkedIn draft handoff is only available for draft-only Agent Ops content.' },
        { status: 400 }
      )
    }

    const productionAssets = getProductionAssets(ragContext)
    const blockers = readinessBlockers(itemRecord, productionAssets)
    if (blockers.length) {
      return NextResponse.json({ error: 'LinkedIn draft is not ready.', blockers }, { status: 409 })
    }

    const generatedAt = new Date().toISOString()
    const visualAsset = getVisualAsset(itemRecord)
    const fullPostText = getFullPostText({
      ...itemRecord,
      post_text: typeof itemRecord.post_text === 'string' ? itemRecord.post_text : '',
      cta_text: typeof itemRecord.cta_text === 'string' ? itemRecord.cta_text : null,
      cta_url: typeof itemRecord.cta_url === 'string' ? itemRecord.cta_url : null,
      hashtags: asStringArray(itemRecord.hashtags),
    } as never)

    const draftPacket = {
      version: 'linkedin_draft_handoff_v1',
      status: 'ready_for_linkedin_draft',
      platform: 'linkedin',
      created_at: generatedAt,
      created_by: authResult.user.id,
      external_account_draft_created: false,
      delivery_boundary: 'Internal LinkedIn-ready draft packet only. This does not publish, schedule, send to LinkedIn, or create an external account draft.',
      social_content_id: id,
      social_content_href: `/admin/social-content/${id}`,
      goal_id: typeof ragContext.goal_id === 'string' ? ragContext.goal_id : null,
      content_packet_id: typeof ragContext.content_packet_id === 'string' ? ragContext.content_packet_id : null,
      post_text: typeof itemRecord.post_text === 'string' ? itemRecord.post_text : '',
      full_post_text: fullPostText,
      cta_text: typeof itemRecord.cta_text === 'string' ? itemRecord.cta_text : null,
      cta_url: typeof itemRecord.cta_url === 'string' ? itemRecord.cta_url : null,
      hashtags: asStringArray(itemRecord.hashtags),
      content_format: typeof itemRecord.content_format === 'string' ? itemRecord.content_format : 'single_image',
      visual_asset: visualAsset,
      production_assets_generated_at: productionAssets?.generated_at ?? null,
      redaction_status: productionAssets?.video_redaction_manifest.status ?? null,
      next_action: 'Create or paste this packet into LinkedIn as a draft, then return for final publish approval.',
    }

    const workItem = await createAgentWorkItem({
      title: 'Create LinkedIn draft from approved Social Content packet',
      objective: [
        'Create a LinkedIn-ready draft from the approved Social Content packet, selected visual asset, source references, and reviewed production assets.',
        'Keep the output as a draft handoff only. Do not publish, schedule, send DMs, or create public external content without the final approval gate.',
      ].join(' '),
      priority: 'high',
      status: 'assigned',
      ownerAgentKey: 'content-repurposing',
      source: {
        type: 'social_content_linkedin_draft_handoff',
        id,
        label: 'LinkedIn draft handoff',
      },
      expectedFiles: [],
      metadata: {
        source: 'social_content_linkedin_draft_handoff',
        social_content_id: id,
        social_content_href: `/admin/social-content/${id}`,
        platform: 'linkedin',
        draft_packet: draftPacket,
        approval_boundary: 'draft_handoff_only_no_external_publish',
        blocked_actions: [
          'Do not publish publicly.',
          'Do not schedule.',
          'Do not send DMs or external outreach.',
          'Do not bypass final human approval.',
        ],
      },
      idempotencyKey: `social-content-linkedin-draft-handoff:${id}`,
    })

    const linkedinDraftHandoff = {
      ...draftPacket,
      work_item: {
        id: workItem.id,
        title: workItem.title,
        status: workItem.status,
        owner_agent_key: workItem.owner_agent_key,
      },
    }

    const updatedRagContext = {
      ...ragContext,
      linkedin_draft_handoff: linkedinDraftHandoff,
    }

    const { data: updated, error: updateError } = await admin
      .from('social_content_queue')
      .update({ rag_context: updatedRagContext })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save LinkedIn draft handoff' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item: updated,
      linkedin_draft_handoff: linkedinDraftHandoff,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/create-linkedin-draft:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
