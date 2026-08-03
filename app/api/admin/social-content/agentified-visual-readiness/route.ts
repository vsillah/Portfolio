import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getAgentifiedVisualStrategyQaPackets,
  type AgentifiedVisualStrategyQaPacket,
} from '@/lib/agentified-visual-strategy-qa'

export const dynamic = 'force-dynamic'

type AgentifiedVisualReadinessBody = {
  social_content_ids?: string[]
}

type SocialContentRow = {
  id: string
  status: string | null
  rag_context: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function absoluteUrl(origin: string, path: string) {
  if (/^https?:\/\//.test(path)) return path
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

function packetById(ids: string[]) {
  const packets = getAgentifiedVisualStrategyQaPackets()
  if (ids.length === 0) return packets
  return packets.filter((packet) => ids.includes(packet.socialContentId))
}

function approvedSectionGate(
  gate: 'visual_assets' | 'asset_packet' | 'privacy',
  userId: string,
  decidedAt: string,
  packet: AgentifiedVisualStrategyQaPacket,
) {
  return {
    status: 'approved',
    decided_at: decidedAt,
    decided_by: userId,
    note: `Batch-approved from Amina visual strategy QA packet ${packet.reportVersion}.`,
    repair_status: null,
    repair_requested_at: null,
  }
}

function nextRagContext({
  existing,
  packet,
  userId,
  decidedAt,
  candidateUrls,
  primaryCandidateUrl,
}: {
  existing: Record<string, unknown> | null
  packet: AgentifiedVisualStrategyQaPacket
  userId: string
  decidedAt: string
  candidateUrls: string[]
  primaryCandidateUrl: string | null
}) {
  const current = asRecord(existing)
  const existingReviews = asRecord(current.section_gate_reviews)

  return {
    ...current,
    section_gate_reviews: {
      ...existingReviews,
      visual_assets: approvedSectionGate('visual_assets', userId, decidedAt, packet),
      asset_packet: approvedSectionGate('asset_packet', userId, decidedAt, packet),
      privacy: approvedSectionGate('privacy', userId, decidedAt, packet),
    },
    agentified_visual_strategy_qa: {
      status: 'approved',
      approved_at: decidedAt,
      approved_by: userId,
      report_version: packet.reportVersion,
      report_date: packet.reportDate,
      owner_agent_key: packet.ownerAgentKey,
      owner_display_name: packet.ownerDisplayName,
      asset_id: packet.assetId,
      format: packet.format,
      selected_form: packet.selectedForm,
      source_asset: packet.sourceAsset,
      support_assets: packet.supportAssets,
      source_inputs: packet.sourceInputs,
      research_pattern: packet.researchPattern,
      rationale: packet.rationale,
      alt_text: packet.altText,
      candidate_urls: candidateUrls,
      primary_candidate_url: primaryCandidateUrl,
      all_qa_passed: packet.allQaPassed,
      privacy_rights_result: packet.privacyRightsFinding?.result ?? null,
      qa_findings: packet.qaFindings,
      linkedin_provider_capability: packet.format === 'carousel'
        ? {
            publish_mode: 'multi_image_post',
            native_organic_carousel_supported: false,
            note: 'LinkedIn organic carousel is not supported by the current Posts API; Portfolio publishes the approved slide set as a non-sponsored multi-image post when the connected provider token is valid.',
          }
        : {
            publish_mode: 'single_image_post',
            native_organic_carousel_supported: null,
          },
      side_effect_boundary: {
        external_publish: false,
        external_schedule: false,
        provider_upload: false,
        provider_generation: false,
      },
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({})) as AgentifiedVisualReadinessBody
    const requestedIds = stringArray(body.social_content_ids)
    const packets = packetById(requestedIds)
    const knownIds = getAgentifiedVisualStrategyQaPackets().map((packet) => packet.socialContentId)
    const invalidIds = requestedIds.filter((id) => !knownIds.includes(id))

    if (invalidIds.length > 0) {
      return NextResponse.json({
        error: 'Unknown Agentified visual QA social content id',
        invalidIds,
        knownIds,
      }, { status: 400 })
    }

    if (packets.length === 0) {
      return NextResponse.json({ error: 'No Agentified visual QA packets matched the request.' }, { status: 400 })
    }

    const ids = packets.map((packet) => packet.socialContentId)
    const { data: rows, error: fetchError } = await admin
      .from('social_content_queue')
      .select('id, status, rag_context')
      .in('id', ids)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to load Social Content rows.' }, { status: 500 })
    }

    const typedRows = (rows ?? []) as SocialContentRow[]
    const rowsById = new Map(typedRows.map((row) => [row.id, row]))
    const missingIds = ids.filter((id) => !rowsById.has(id))
    if (missingIds.length > 0) {
      return NextResponse.json({
        error: 'One or more Social Content rows are missing.',
        missingIds,
      }, { status: 404 })
    }

    const decidedAt = new Date().toISOString()
    const origin = new URL(request.url).origin
    const applied = []

    for (const packet of packets) {
      if (!packet.allQaPassed || packet.privacyRightsFinding?.result === 'blocked') {
        return NextResponse.json({
          error: 'Amina visual QA packet is not safe to approve.',
          socialContentId: packet.socialContentId,
          assetId: packet.assetId,
        }, { status: 409 })
      }

      const row = rowsById.get(packet.socialContentId)!
      const candidateUrls = packet.candidateUrls.map((path) => absoluteUrl(origin, path))
      const primaryCandidateUrl = candidateUrls[0] ?? null
      const update = {
        content_format: packet.format === 'carousel' ? 'carousel' : 'single_image',
        image_url: primaryCandidateUrl,
        carousel_slide_urls: packet.format === 'carousel' ? candidateUrls : null,
        rag_context: nextRagContext({
          existing: row.rag_context,
          packet,
          userId: auth.user.id,
          decidedAt,
          candidateUrls,
          primaryCandidateUrl,
        }),
      }

      const { data: updated, error: updateError } = await admin
        .from('social_content_queue')
        .update(update)
        .eq('id', packet.socialContentId)
        .select('id, status, content_format, image_url, carousel_slide_urls, rag_context')
        .single()

      if (updateError) {
        return NextResponse.json({
          error: 'Failed to apply Agentified visual readiness.',
          socialContentId: packet.socialContentId,
        }, { status: 500 })
      }

      applied.push({
        id: packet.socialContentId,
        assetId: packet.assetId,
        format: packet.format,
        selectedForm: packet.selectedForm,
        candidateCount: candidateUrls.length,
        href: `/admin/social-content/${packet.socialContentId}?step=visuals`,
        item: updated,
      })
    }

    return NextResponse.json({
      success: true,
      applied,
      summary: {
        requested: ids.length,
        applied: applied.length,
        singleImage: applied.filter((item) => item.format === 'single_image').length,
        carousel: applied.filter((item) => item.format === 'carousel').length,
      },
      remainingExternalGates: [
        'linkedin_provider_reconnect_if_token_expired',
        'final_platform_submission',
        'external_publish',
      ],
    })
  } catch (error) {
    console.error('[agentified-visual-readiness] run failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
