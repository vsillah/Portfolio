import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform } from '@/lib/social-content'
import { getProductionAssets, getVideoRedactionGate } from '@/lib/social-production-assets'
import { buildPlatformOrchestrationPlan } from '@/lib/social-platform-orchestration'

export const dynamic = 'force-dynamic'

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizePlatforms(value: unknown): SocialPlatform[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value)).filter((platform): platform is SocialPlatform => (
    typeof platform === 'string' && Boolean(PLATFORM_LABELS[platform as SocialPlatform])
  ))
}

function targetPlatformsFor(item: Record<string, unknown>, requested: SocialPlatform[]) {
  if (requested.length) return requested
  const targets = normalizePlatforms(item.target_platforms)
  if (targets.length) return targets
  return normalizePlatforms([item.platform]).length ? normalizePlatforms([item.platform]) : ['linkedin' as SocialPlatform]
}

function gateBlockers(plan: ReturnType<typeof buildPlatformOrchestrationPlan>) {
  return plan.platforms
    .map((platformPlan) => {
      const blockedStage = platformPlan.stages.find((stage) => stage.state === 'blocked')
      return blockedStage ? `${platformPlan.label}: ${blockedStage.detail}` : null
    })
    .filter((blocker): blocker is string => Boolean(blocker))
}

/**
 * POST /api/admin/social-content/[id]/platform-submission
 * Records the final human platform-submission gate, then optionally triggers
 * automatic submission through the existing publish dispatcher.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const body = await request.json().catch(() => ({}))
    const requestedPlatforms = normalizePlatforms(body.platforms)
    const submitAfterApproval = body.submit_after_approval !== false
    const decisionNote = typeof body.decision_note === 'string' ? body.decision_note.trim() : ''

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
    if (itemRecord.status !== 'approved' && itemRecord.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Content must be approved before platform submission.' },
        { status: 400 },
      )
    }

    const targetPlatforms = targetPlatformsFor(itemRecord, requestedPlatforms)
    const productionAssets = getProductionAssets(itemRecord.rag_context)
    const redactionGate = getVideoRedactionGate(productionAssets)
    if (!redactionGate.ready) {
      return NextResponse.json(
        {
          error: redactionGate.message || 'Video privacy review required before platform submission.',
          unresolved_redaction_items: redactionGate.unresolvedItems.length,
        },
        { status: 409 },
      )
    }

    const publishRows = targetPlatforms.map((platform) => ({
      content_id: id,
      platform,
      status: 'pending' as const,
    }))
    const { error: upsertError } = await admin
      .from('social_content_publishes')
      .upsert(publishRows, { onConflict: 'content_id,platform', ignoreDuplicates: true })

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to prepare platform publish rows.' }, { status: 500 })
    }

    const { data: publishes } = await admin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)

    const { data: platformConfigs } = await admin
      .from('social_content_config')
      .select('*')

    const readinessPlan = buildPlatformOrchestrationPlan({
      item: item as never,
      targetPlatforms,
      publishRecords: publishes ?? [],
      platformConfigs: platformConfigs ?? [],
      copyApproved: true,
      productionReady: true,
      redactionReady: true,
      draftHandoffReady: true,
      finalSubmissionGateReady: true,
    })
    const blockers = gateBlockers(readinessPlan)
    if (blockers.length) {
      return NextResponse.json(
        {
          error: 'Platform submission is blocked.',
          blockers,
          platform_submission_orchestration: readinessPlan,
        },
        { status: 409 },
      )
    }

    const approvedAt = new Date().toISOString()
    const updatedRagContext = {
      ...asRecord(itemRecord.rag_context),
      platform_submission_gate: {
        status: 'approved',
        approved_at: approvedAt,
        approved_by: authResult.user.id,
        platforms: targetPlatforms,
        decision_note: decisionNote || null,
        submit_after_approval: submitAfterApproval,
        boundary: 'Final human approval for automatic platform submission. Provider generation, rendering, uploads, scheduling, and publishing remain limited to configured platform adapters.',
      },
    }

    const { data: updatedItem, error: updateError } = await admin
      .from('social_content_queue')
      .update({ rag_context: updatedRagContext })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Failed to record platform submission gate.' }, { status: 500 })
    }

    let publishResponse: unknown = null
    let submitTriggered = false
    if (submitAfterApproval) {
      const origin = new URL(request.url).origin
      const response = await fetch(`${origin}/api/admin/social-content/${id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('authorization') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platforms: targetPlatforms }),
      })
      submitTriggered = response.ok
      publishResponse = await response.json().catch(() => null)
    }

    return NextResponse.json({
      success: true,
      submit_triggered: submitTriggered,
      item: updatedItem,
      publishes: publishes ?? [],
      platform_submission_gate: updatedRagContext.platform_submission_gate,
      platform_submission_orchestration: readinessPlan,
      publish_response: publishResponse,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/platform-submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
