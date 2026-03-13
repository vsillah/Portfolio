/**
 * POST /api/admin/video-generation/companion-from-report
 * Generate a companion video from the same context as a Gamma report.
 * Body: { gammaReportId } or { reportType, contactSubmissionId?, valueReportId?, diagnosticAuditId? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { createVideo } from '@/lib/heygen'
import { buildVideoScriptFromContext } from '@/lib/video-script-from-context'
import { isOverVideoGenerationLimit } from '@/lib/video-generation-rate-limit'
import { channelToAspectRatio } from '@/lib/constants/video-channel'
import type { GammaReportParams } from '@/lib/gamma-report-builder'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (process.env.VIDEO_COMPANION_FROM_REPORT_ENABLED === 'false') {
      return NextResponse.json(
        { error: 'Companion video from report is not available.' },
        { status: 403 }
      )
    }

    const userId = auth.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const overLimit = await isOverVideoGenerationLimit(userId)
    if (overLimit) {
      return NextResponse.json(
        { error: 'Daily video generation limit reached. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    let params: GammaReportParams

    const gammaReportId = body.gammaReportId as string | undefined
    if (gammaReportId?.trim()) {
      const { data: report, error: reportErr } = await supabaseAdmin
        .from('gamma_reports')
        .select('report_type, contact_submission_id, diagnostic_audit_id, value_report_id, proposal_id')
        .eq('id', gammaReportId.trim())
        .single()

      if (reportErr || !report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }
      params = {
        reportType: report.report_type as GammaReportParams['reportType'],
        contactSubmissionId: report.contact_submission_id ?? undefined,
        diagnosticAuditId: report.diagnostic_audit_id ?? undefined,
        valueReportId: report.value_report_id ?? undefined,
        proposalId: report.proposal_id ?? undefined,
      }
    } else {
      const reportType = body.reportType as string
      if (!reportType) {
        return NextResponse.json(
          { error: 'gammaReportId or reportType is required' },
          { status: 400 }
        )
      }
      const validTypes = ['value_quantification', 'implementation_strategy', 'audit_summary', 'prospect_overview']
      if (!validTypes.includes(reportType)) {
        return NextResponse.json({ error: 'Invalid reportType' }, { status: 400 })
      }
      params = {
        reportType: reportType as GammaReportParams['reportType'],
        contactSubmissionId: body.contactSubmissionId ?? undefined,
        diagnosticAuditId: body.diagnosticAuditId ?? undefined,
        valueReportId: body.valueReportId ?? undefined,
        proposalId: body.proposalId ?? undefined,
      }
    }

    const scriptText = await buildVideoScriptFromContext(params)
    const HEYGEN_SCRIPT_MAX = 5000
    if (scriptText.length > HEYGEN_SCRIPT_MAX) {
      return NextResponse.json(
        { error: 'Generated script is too long. Try a different report or shorten context.' },
        { status: 400 }
      )
    }

    const templateId = process.env.HEYGEN_TEMPLATE_ID
    const brandVoiceId = process.env.HEYGEN_BRAND_VOICE_ID
    const avatarId = process.env.HEYGEN_AVATAR_ID
    const voiceId = process.env.HEYGEN_VOICE_ID
    if (!templateId && (!avatarId || !voiceId)) {
      return NextResponse.json(
        { error: 'HeyGen template or avatar and voice must be configured.' },
        { status: 500 }
      )
    }

    const channel = 'youtube'
    const aspectRatio = channelToAspectRatio(channel)

    const result = await createVideo({
      script: scriptText,
      title: `Companion video (${params.reportType})`,
      aspectRatio,
      channel,
      templateId: templateId || undefined,
      brandVoiceId: brandVoiceId || undefined,
      avatarId: avatarId || undefined,
      voiceId: voiceId || undefined,
    })

    if (result.error) {
      console.error('[Companion video] HeyGen error:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    if (!result.videoId) {
      return NextResponse.json(
        { error: 'Video generation did not return an ID. Please try again.' },
        { status: 500 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      script_source: 'campaign',
      script_text: scriptText,
      target_type: null,
      target_id: null,
      avatar_id: avatarId ?? '',
      voice_id: voiceId ?? '',
      aspect_ratio: aspectRatio,
      channel,
      heygen_video_id: result.videoId,
      heygen_status: 'pending',
      created_by: userId,
    }
    if (gammaReportId?.trim()) {
      insertPayload.gamma_report_id = gammaReportId.trim()
    }

    const { data: job, error: insertErr } = await supabaseAdmin
      .from('video_generation_jobs')
      .insert(insertPayload)
      .select('id, heygen_video_id, heygen_status, created_at')
      .single()

    if (insertErr) {
      console.error('[Companion video] Insert error:', insertErr)
      return NextResponse.json(
        { error: 'Failed to create job record. Please try again.' },
        { status: 500 }
      )
    }

    console.log('[Companion video] Job created', job.id, gammaReportId ? `gamma_report_id=${gammaReportId}` : '')

    return NextResponse.json({
      jobId: job.id,
      heygenVideoId: job.heygen_video_id,
      status: job.heygen_status,
      createdAt: job.created_at,
      gammaReportId: gammaReportId?.trim() ?? null,
    })
  } catch (error) {
    console.error('[Companion video] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
