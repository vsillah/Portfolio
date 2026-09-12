import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform } from '@/lib/social-content'
import { getProductionAssets, getVideoRedactionGate } from '@/lib/social-production-assets'
import {
  buildPlatformOrchestrationPlan,
  isAutomaticSubmissionSupported,
} from '@/lib/social-platform-orchestration'
import { syncCampaignCalendarForSocialContent } from '@/lib/social-content-calendar-linkage'
import {
  deriveSocialContentLifecycleProjection,
  lifecyclePrerequisiteFailure,
} from '@/lib/social-content-lifecycle'

import { hasIntactSocialReleaseReceipts, socialReleaseFingerprint } from '@/lib/social-release-evidence'
import { confirmedSocialPlatforms, hasAmbiguousSocialPublishRows, socialReleaseGate, isSocialReleaseLocked, nextSocialReleaseVersion } from '@/lib/social-release-safety'

export const dynamic = 'force-dynamic'

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
}

const FINAL_GATE_ONLY_PLATFORMS = new Set<SocialPlatform>(['youtube', 'instagram'])

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
      const blockedStage = platformPlan.stages.find((stage) => (
        stage.key !== 'automatic_submission' && stage.state === 'blocked'
      ))
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
    const requestedSubmitAfterApproval = body.submit_after_approval !== false
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
    const previousGate = socialReleaseGate(itemRecord.rag_context)
    const continuation = previousGate.status === 'partially_submitted'
    if (isSocialReleaseLocked(itemRecord.rag_context) && !continuation) {
      return NextResponse.json({ error: 'Release is submitting or requires reconciliation. Reload the current release evidence.' }, { status: 409 })
    }
    if (typeof body.expected_updated_at !== 'string' || body.expected_updated_at !== itemRecord.updated_at) {
      return NextResponse.json({ error: 'Content changed or displayed version is missing. Reload and review before final approval.' }, { status: 409 })
    }
    if (itemRecord.status !== 'approved' && itemRecord.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Content must be approved before platform submission.' },
        { status: 400 },
      )
    }

    const targetPlatforms = targetPlatformsFor(itemRecord, requestedPlatforms)
    const autoSubmitBlockedPlatforms = targetPlatforms.filter((platform) => (
      FINAL_GATE_ONLY_PLATFORMS.has(platform) || !isAutomaticSubmissionSupported(platform)
    ))
    const submitAfterApproval = requestedSubmitAfterApproval && autoSubmitBlockedPlatforms.length === 0
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

    const { data: existingPublishes, error: publishReadError } = await admin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)

    if (publishReadError || !existingPublishes || hasAmbiguousSocialPublishRows(existingPublishes)
      || (continuation ? !hasIntactSocialReleaseReceipts(itemRecord, existingPublishes)
        : existingPublishes.some((row: Record<string, unknown>) => row.status === 'published'))) {
      return NextResponse.json({ error: 'Existing provider release evidence requires reconciliation before a new final approval.' }, { status: 409 })
    }

    if (continuation && (!requestedPlatforms.length || targetPlatforms.some(platform =>
      !existingPublishes.some((row: Record<string, unknown>) => row.platform === platform && row.status === 'pending')))) {
      return NextResponse.json({ error: 'Approve only explicitly selected remaining pending targets.' }, { status: 409 })
    }

    const lifecycleFailure = lifecyclePrerequisiteFailure(
      deriveSocialContentLifecycleProjection({
        item: {
          ...itemRecord,
          publishes: existingPublishes ?? [],
        },
      }),
      'submit',
    )
    if (lifecycleFailure) {
      return NextResponse.json(lifecycleFailure, { status: 409 })
    }

    const publishes = existingPublishes ?? []

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

    const approvedAt = nextSocialReleaseVersion(itemRecord.updated_at)
    const updatedRagContext = {
      ...asRecord(itemRecord.rag_context),
      platform_submission_gate: {
        ...previousGate,
        confirmed_platforms: confirmedSocialPlatforms(itemRecord.rag_context),
        status: 'approved',
        approved_version: itemRecord.updated_at,
        approved_fingerprint: socialReleaseFingerprint(itemRecord),
        approved_at: approvedAt,
        approved_by: authResult.user.id,
        platforms: targetPlatforms,
        decision_note: decisionNote || null,
        submit_after_approval: submitAfterApproval,
        auto_submit_blocked_platforms: autoSubmitBlockedPlatforms,
        boundary: autoSubmitBlockedPlatforms.length
          ? 'Final human approval recorded for platform submission readiness. Manual-only or separately guarded platforms are not auto-triggered from this readiness gate.'
          : 'Final human approval for automatic platform submission. Provider generation, rendering, uploads, scheduling, and publishing remain limited to configured platform adapters.',
      },
    }

    const { data: updatedItem, error: updateError } = await admin
      .from('social_content_queue')
      .update({ rag_context: updatedRagContext, updated_at: approvedAt })
      .eq('id', id)
      .eq('updated_at', body.expected_updated_at)
      .eq('status', String(itemRecord.status))
      .select('*')
      .single()

    if (updateError || !updatedItem) {
      return NextResponse.json({ error: 'Final approval was not confirmed. Reload the current content before retrying.' }, { status: 409 })
    }

    const { error: upsertError } = await admin.from('social_content_publishes')
      .upsert(targetPlatforms.map(platform => ({ content_id: id, platform, status: 'pending' as const })),
        { onConflict: 'content_id,platform', ignoreDuplicates: true })
    if (upsertError) {
      return NextResponse.json({ error: 'Approval saved but publish rows could not be prepared. No submission started.' }, { status: 500 })
    }

    const calendarLinkage = await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: id,
      event: {
        type: 'platform_submission_approved',
        at: approvedAt,
        userId: authResult.user.id,
        platforms: targetPlatforms,
        submitAfterApproval,
      },
    })

    let publishResponse: unknown = null
    let submitTriggered = false
    let submissionStatus = 200
    let responseItem = updatedItem
    if (submitAfterApproval) {
      const origin = new URL(request.url).origin
      const response = await fetch(`${origin}/api/admin/social-content/${id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('authorization') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platforms: targetPlatforms, expected_updated_at: updatedItem.updated_at }),
      })
      submitTriggered = response.ok
      submissionStatus = response.status
      publishResponse = await response.json().catch(() => null)
      const readback = await admin.from('social_content_queue').select('*').eq('id', id).single()
      if (!readback.error && readback.data) responseItem = readback.data
    }

    return NextResponse.json({
      success: !submitAfterApproval || submitTriggered,
      final_approval_recorded: true,
      selected_published: asRecord(publishResponse).selected_published === true,
      published: asRecord(publishResponse).published === true,
      remaining_platforms: asRecord(publishResponse).remaining_platforms ?? [],
      reconciliation_required: asRecord(publishResponse).reconciliation_required === true,
      ...(!submitTriggered && submitAfterApproval ? { error: asRecord(publishResponse).error || 'Submission was not confirmed. Reload the saved release evidence.' } : {}),
      submit_triggered: submitTriggered,
      item: responseItem,
      publishes: asRecord(publishResponse).publishes ?? publishes ?? [],
      platform_submission_gate: asRecord(responseItem?.rag_context).platform_submission_gate,
      platform_submission_orchestration: readinessPlan,
      calendar_linkage: calendarLinkage,
      publish_response: publishResponse,
      auto_submit_blocked_platforms: autoSubmitBlockedPlatforms,
    }, { status: submitAfterApproval && !submitTriggered ? (submissionStatus >= 400 ? submissionStatus : 409) : 200 })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/platform-submission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
