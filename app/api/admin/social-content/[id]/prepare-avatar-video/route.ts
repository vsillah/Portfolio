import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createVideo } from '@/lib/heygen'
import { getHeyGenDefaults } from '@/lib/heygen-config'
import { supabaseAdmin } from '@/lib/supabase'
import { getProductionAssets, getVideoRedactionGate } from '@/lib/social-production-assets'
import { videoRenderApprovalError, parseVideoRenderApproval } from '@/lib/video-render-approval'
import {
  buildSocialVideoProductionProjection,
  buildSocialVideoProductionStoredState,
  getSocialVideoProductionState,
  isYouTubeSocialTarget,
  selectProductionBrollAssets,
  type SocialVideoGenerationJobProjection,
} from '@/lib/social-video-production'
import { evaluateVideoScript, SCRIPT_INTELLIGENCE_SIDE_EFFECTS } from '@/lib/video-script-intelligence'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function mapJob(row: Record<string, unknown> | null): SocialVideoGenerationJobProjection | null {
  if (!row) return null
  return {
    id: asString(row.id),
    heygenVideoId: asString(row.heygen_video_id) || null,
    heygenStatus: asString(row.heygen_status) || null,
    videoUrl: asString(row.video_url) || null,
    videoShareUrl: asString(row.video_share_url) || null,
    thumbnailUrl: asString(row.thumbnail_url) || null,
    avatarId: asString(row.avatar_id) || null,
    voiceId: asString(row.voice_id) || null,
    brollAssetIds: asStringArray(row.broll_asset_ids),
    createdAt: asString(row.created_at) || null,
    updatedAt: asString(row.updated_at) || null,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const approvalError = videoRenderApprovalError(asRecord(body).renderApproval)
    if (approvalError) {
      return NextResponse.json({ error: approvalError }, { status: 400 })
    }
    const renderApproval = parseVideoRenderApproval(asRecord(body).renderApproval)

    const { data: item, error: fetchError } = await supabaseAdmin
      .from('social_content_queue')
      .select('id, status, platform, target_platforms, post_text, video_url, image_url, youtube_title, rag_context')
      .eq('id', params.id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    if (!isYouTubeSocialTarget(item)) {
      return NextResponse.json({ error: 'Avatar video preparation is only available for YouTube Social Content drafts.' }, { status: 409 })
    }

    if (item.status !== 'approved') {
      return NextResponse.json({ error: 'Copy must be approved before HeyGen avatar video preparation.' }, { status: 409 })
    }

    const ragContext = asRecord(item.rag_context)
    const existingState = getSocialVideoProductionState(ragContext)
    if (existingState?.video_generation_job_id) {
      const { data: existingJob } = await supabaseAdmin
        .from('video_generation_jobs')
        .select('id, heygen_video_id, heygen_status, video_url, video_share_url, thumbnail_url, avatar_id, voice_id, broll_asset_ids, created_at, updated_at')
        .eq('id', existingState.video_generation_job_id)
        .maybeSingle()
      if (existingJob) {
        const defaults = await getHeyGenDefaults()
        return NextResponse.json({
          error: 'This Social Content draft already has a linked HeyGen job.',
          social_video_production: buildSocialVideoProductionProjection({
            item,
            defaults,
            job: mapJob(existingJob),
          }),
        }, { status: 409 })
      }
    }

    const productionAssets = getProductionAssets(ragContext)
    if (!productionAssets) {
      const defaults = await getHeyGenDefaults()
      return NextResponse.json({
        error: 'Prepare the production asset packet before HeyGen avatar video preparation.',
        social_video_production: buildSocialVideoProductionProjection({ item, defaults, job: null }),
      }, { status: 409 })
    }

    const redactionGate = getVideoRedactionGate(productionAssets)
    if (!redactionGate.ready) {
      const defaults = await getHeyGenDefaults()
      return NextResponse.json({
        error: redactionGate.message || 'Resolve video privacy and redaction review before HeyGen avatar video preparation.',
        unresolved_redaction_items: redactionGate.unresolvedItems.length,
        social_video_production: buildSocialVideoProductionProjection({ item, defaults, job: null }),
      }, { status: 409 })
    }

    const defaults = await getHeyGenDefaults()
    const avatarId = defaults.avatarId
    const voiceId = defaults.voiceId
    if (!avatarId || !voiceId) {
      return NextResponse.json({
        error: 'Default Vambah HeyGen avatar and voice must be configured before render preparation.',
        social_video_production: buildSocialVideoProductionProjection({ item, defaults, job: null }),
      }, { status: 409 })
    }

    const selectedBroll = selectProductionBrollAssets(
      productionAssets,
      asStringArray(asRecord(body).brollAssetIds),
    )
    if (selectedBroll.missingIds.length > 0) {
      return NextResponse.json({
        error: 'Selected B-roll assets are not in the prepared production packet.',
        missing_broll_asset_ids: selectedBroll.missingIds,
      }, { status: 400 })
    }
    if (selectedBroll.ids.length === 0) {
      return NextResponse.json({
        error: 'Select or capture B-roll from the B-roll library before HeyGen avatar video preparation.',
        social_video_production: buildSocialVideoProductionProjection({ item, defaults, job: null }),
      }, { status: 409 })
    }

    const scriptText = productionAssets.video_script.script_text.trim()
    if (!scriptText) {
      return NextResponse.json({ error: 'Production asset packet has no video script.' }, { status: 409 })
    }

    const scriptScorecard = evaluateVideoScript({
      scriptText,
      outline: {
        hook: scriptText.split(/\n+/).find(Boolean) ?? '',
        proof_demo: 'Social Content production asset packet.',
        cta: asString(item.youtube_title) || productionAssets.video_script.title,
        source_distance_notes: 'Generated from the approved Social Content production asset packet.',
      },
      researchPacketCount: productionAssets.references.public_sources.length + productionAssets.references.open_brain.length,
    })
    if (scriptScorecard.blockers.length > 0) {
      return NextResponse.json({
        error: `Script intelligence gate blocked render: ${scriptScorecard.blockers.join(' ')}`,
        scorecard: scriptScorecard,
        side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
      }, { status: 409 })
    }

    const result = await createVideo({
      script: scriptText,
      title: asString(item.youtube_title) || productionAssets.video_script.title || `Social Content video ${params.id}`,
      aspectRatio: '16:9',
      channel: 'youtube',
      avatarId,
      voiceId,
    })

    if (result.error || !result.videoId) {
      return NextResponse.json({ error: result.error || 'HeyGen did not return a video ID.' }, { status: 502 })
    }

    const { data: job, error: insertError } = await supabaseAdmin
      .from('video_generation_jobs')
      .insert({
        script_source: 'campaign',
        script_text: scriptText,
        drive_file_id: null,
        drive_file_name: asString(item.youtube_title) || productionAssets.video_script.title,
        avatar_id: avatarId,
        voice_id: voiceId,
        aspect_ratio: '16:9',
        channel: 'youtube',
        heygen_video_id: result.videoId,
        heygen_status: 'pending',
        broll_asset_ids: selectedBroll.ids,
        created_by: auth.user?.id,
      })
      .select('id, heygen_video_id, heygen_status, video_url, video_share_url, thumbnail_url, avatar_id, voice_id, broll_asset_ids, created_at, updated_at')
      .single()

    if (insertError || !job) {
      console.error('[social-content avatar video] job insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to create video generation job.' }, { status: 500 })
    }

    const storedState = buildSocialVideoProductionStoredState({
      existing: existingState,
      jobId: job.id,
      avatarId,
      voiceId,
      brollCandidates: selectedBroll.assets,
      selectedBrollAssetIds: selectedBroll.ids,
      renderApproval: {
        approvedBy: renderApproval?.approvedBy ?? 'Shaka',
        scope: renderApproval?.scope ?? '',
        packetPath: renderApproval?.packetPath ?? '',
      },
    })
    const nextRagContext = {
      ...ragContext,
      social_video_production: storedState,
    }

    const { error: updateError } = await supabaseAdmin
      .from('social_content_queue')
      .update({
        rag_context: nextRagContext,
        video_generation_method: 'heygen_avatar',
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('[social-content avatar video] queue update failed:', updateError)
      return NextResponse.json({ error: 'HeyGen job was created, but Social Content projection failed to update.' }, { status: 500 })
    }

    const updatedItem = {
      ...item,
      rag_context: nextRagContext,
      video_generation_method: 'heygen_avatar',
    }
    const mappedJob = mapJob(job)

    return NextResponse.json({
      success: true,
      job_id: job.id,
      heygen_video_id: job.heygen_video_id,
      rag_context: nextRagContext,
      social_video_production: buildSocialVideoProductionProjection({
        item: updatedItem,
        defaults,
        job: mappedJob,
      }),
    })
  } catch (error) {
    console.error('[social-content avatar video] error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
