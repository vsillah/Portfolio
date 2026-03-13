/**
 * POST /api/admin/gamma-reports/with-video
 * Generate both a Gamma report and a companion video from a single context fetch.
 * Returns reportId, gammaGenerationId, jobId, heygenVideoId (report and video are started, not waited for).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGammaReportInput, fetchReportAndVideoContext, type GammaReportParams } from '@/lib/gamma-report-builder'
import { generateGamma } from '@/lib/gamma-client'
import { buildVideoScriptFromVideoContext } from '@/lib/video-script-from-context'
import { createVideo } from '@/lib/heygen'
import { isOverVideoGenerationLimit } from '@/lib/video-generation-rate-limit'
import { channelToAspectRatio } from '@/lib/constants/video-channel'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (process.env.VIDEO_REPORT_PLUS_VIDEO_ENABLED === 'false') {
      return NextResponse.json(
        { error: 'Report + video is not available.' },
        { status: 403 }
      )
    }

    const userId = auth.user?.id
    if (userId) {
      const overLimit = await isOverVideoGenerationLimit(userId)
      if (overLimit) {
        return NextResponse.json(
          { error: 'Daily video generation limit reached. Please try again tomorrow.' },
          { status: 429 }
        )
      }
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let body: GammaReportParams
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.reportType) {
      return NextResponse.json({ error: 'reportType is required' }, { status: 400 })
    }

    const validTypes = ['value_quantification', 'implementation_strategy', 'audit_summary', 'prospect_overview']
    if (!validTypes.includes(body.reportType)) {
      return NextResponse.json(
        { error: `Invalid reportType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Single context fetch for both report and video
    const { gammaInput, videoScriptContext } = await fetchReportAndVideoContext(body)

    const scriptText = buildVideoScriptFromVideoContext(videoScriptContext)
    const HEYGEN_SCRIPT_MAX = 5000
    if (scriptText.length > HEYGEN_SCRIPT_MAX) {
      return NextResponse.json(
        { error: 'Generated script is too long for video. Report will still be generated separately.' },
        { status: 400 }
      )
    }

    const { data: reportRow, error: insertReportErr } = await supabaseAdmin
      .from('gamma_reports')
      .insert({
        report_type: body.reportType,
        title: gammaInput.title,
        contact_submission_id: body.contactSubmissionId || null,
        diagnostic_audit_id: body.diagnosticAuditId || null,
        value_report_id: body.valueReportId || null,
        proposal_id: body.proposalId || null,
        input_text: gammaInput.inputText,
        external_inputs: body.externalInputs || {},
        gamma_options: gammaInput.options,
        status: 'generating',
        created_by: userId,
      })
      .select('id')
      .single()

    if (insertReportErr || !reportRow) {
      console.error('[Report+video] Failed to insert gamma report:', insertReportErr)
      return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 })
    }

    const reportId = reportRow.id

    let gammaGenerationId: string
    try {
      const { generationId } = await generateGamma(gammaInput.inputText, gammaInput.options)
      gammaGenerationId = generationId
      await supabaseAdmin
        .from('gamma_reports')
        .update({ gamma_generation_id: generationId })
        .eq('id', reportId)
    } catch (gammaErr) {
      console.error('[Report+video] Gamma start failed:', gammaErr)
      await supabaseAdmin
        .from('gamma_reports')
        .update({ status: 'failed', error_message: gammaErr instanceof Error ? gammaErr.message : 'Gamma start failed' })
        .eq('id', reportId)
      return NextResponse.json(
        { error: 'Failed to start Gamma report. Video was not started.' },
        { status: 502 }
      )
    }

    const templateId = process.env.HEYGEN_TEMPLATE_ID
    const brandVoiceId = process.env.HEYGEN_BRAND_VOICE_ID
    const avatarId = process.env.HEYGEN_AVATAR_ID
    const voiceId = process.env.HEYGEN_VOICE_ID
    if (!templateId && (!avatarId || !voiceId)) {
      return NextResponse.json({
        reportId,
        gammaGenerationId,
        message: 'Report started. Video skipped (HeyGen not configured).',
      })
    }

    const channel = 'youtube'
    const aspectRatio = channelToAspectRatio(channel)

    const videoResult = await createVideo({
      script: scriptText,
      title: `Companion video (${body.reportType})`,
      aspectRatio,
      channel,
      templateId: templateId || undefined,
      brandVoiceId: brandVoiceId || undefined,
      avatarId: avatarId || undefined,
      voiceId: voiceId || undefined,
    })

    if (videoResult.error || !videoResult.videoId) {
      console.error('[Report+video] HeyGen video start failed:', videoResult.error)
      return NextResponse.json({
        reportId,
        gammaGenerationId,
        message: 'Report started. Video failed to start.',
        videoError: videoResult.error,
      })
    }

    const { data: job, error: insertJobErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .insert({
        script_source: 'campaign',
        script_text: scriptText,
        target_type: null,
        target_id: null,
        avatar_id: avatarId ?? '',
        voice_id: voiceId ?? '',
        aspect_ratio: aspectRatio,
        channel,
        heygen_video_id: videoResult.videoId,
        heygen_status: 'pending',
        created_by: userId,
        gamma_report_id: reportId,
      })
      .select('id, heygen_video_id, heygen_status, created_at')
      .single()

    if (insertJobErr) {
      console.error('[Report+video] Failed to insert video job:', insertJobErr)
      return NextResponse.json({
        reportId,
        gammaGenerationId,
        jobId: null,
        heygenVideoId: videoResult.videoId,
        message: 'Report and video started; job record failed.',
      })
    }

    return NextResponse.json({
      reportId,
      gammaGenerationId,
      jobId: job.id,
      heygenVideoId: job.heygen_video_id,
      status: 'started',
    })
  } catch (error) {
    console.error('[Report+video] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
