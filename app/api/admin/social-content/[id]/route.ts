import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { extractMeetingTitle, extractMeetingSourceUrl } from '@/lib/social-content'
import { getHeyGenConfigByType, getHeyGenDefaults } from '@/lib/heygen-config'
import {
  buildSocialVideoProductionProjection,
  getSocialVideoProductionState,
  type SocialVideoGenerationJobProjection,
} from '@/lib/social-video-production'
import {
  deriveSocialContentLifecycleProjection,
  isDurableCopyApprovedStatus,
  lifecyclePrerequisiteFailure,
  socialContentFinalCopyQualityFailure,
  validateSocialContentFinalCopyQuality,
} from '@/lib/social-content-lifecycle'
import {
  buildScheduleRecoveryProjection,
  createSupabaseSocialScheduleRecoveryRepository,
} from '@/lib/social-schedule-recovery'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function sectionGateApprovalTarget(bodyRagContext: unknown): 'visuals' | 'draft' | null {
  const reviews = asRecord(asRecord(bodyRagContext)?.section_gate_reviews)
  if (!reviews) return null
  const approvedKeys = ['visual_assets', 'asset_packet', 'privacy', 'linkedin_draft']
    .filter((key) => asString(asRecord(reviews[key])?.status) === 'approved')
  if (approvedKeys.includes('linkedin_draft')) return 'draft'
  return approvedKeys.length ? 'visuals' : null
}

const FINAL_COPY_FIELDS = new Set([
  'post_text',
  'cta_text',
  'voiceover_text',
  'youtube_title',
  'youtube_description',
])

function mapVideoGenerationJob(row: Record<string, unknown> | null): SocialVideoGenerationJobProjection | null {
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

/**
 * GET /api/admin/social-content/[id]
 * Get a single social content item with its source meeting record
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params

    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    let meetingRecord = null
    if (data.meeting_record_id) {
      const { data: meeting } = await supabaseAdmin
        .from('meeting_records')
        .select('id, meeting_type, meeting_date, transcript, raw_notes, recording_url, structured_notes, key_decisions, attendees, duration_minutes')
        .eq('id', data.meeting_record_id)
        .single()
      if (meeting) {
        const notes = meeting.structured_notes as Record<string, unknown> | null
        meetingRecord = {
          ...meeting,
          meeting_title: extractMeetingTitle(meeting.raw_notes, notes),
          source_url: extractMeetingSourceUrl(meeting.raw_notes),
        }
      }
    }

    // Load per-platform publish records
    const { data: publishes } = await supabaseAdmin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)
      .order('created_at', { ascending: true })

    const recoveryRepository = createSupabaseSocialScheduleRecoveryRepository(supabaseAdmin)
    const scheduleRecovery = buildScheduleRecoveryProjection(
      await recoveryRepository.readRecoveryItems(id),
      id,
    )

    const [defaults, avatars, voices] = await Promise.all([
      getHeyGenDefaults(),
      getHeyGenConfigByType('avatar'),
      getHeyGenConfigByType('voice'),
    ])
    const socialVideoState = getSocialVideoProductionState(data.rag_context)
    let socialVideoJob: SocialVideoGenerationJobProjection | null = null
    if (socialVideoState?.video_generation_job_id) {
      const { data: job } = await supabaseAdmin
        .from('video_generation_jobs')
        .select('id, heygen_video_id, heygen_status, video_url, video_share_url, thumbnail_url, avatar_id, voice_id, broll_asset_ids, created_at, updated_at')
        .eq('id', socialVideoState.video_generation_job_id)
        .maybeSingle()
      socialVideoJob = mapVideoGenerationJob(job)
    }
    const socialVideoProduction = buildSocialVideoProductionProjection({
      item: data,
      defaults,
      favoriteAvatars: avatars.filter((asset) => asset.is_favorite),
      favoriteVoices: voices.filter((asset) => asset.is_favorite),
      job: socialVideoJob,
    })

    return NextResponse.json({
      item: {
        ...data,
        meeting_record: meetingRecord,
        publishes: publishes || [],
        social_video_production: socialVideoProduction,
        schedule_recovery: scheduleRecovery,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/social-content/[id]
 * Update a social content item (edit text, change status, add notes)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params
    const body = await request.json()

    const allowedFields = [
      'post_text', 'cta_text', 'cta_url', 'hashtags',
      'image_prompt', 'voiceover_text', 'platform',
      'status', 'scheduled_for', 'admin_notes',
      'rag_context',
      'framework_visual_type', 'target_platforms',
      'video_generation_method', 'youtube_title', 'youtube_description',
    ]

    const sanitized: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in body) sanitized[key] = body[key]
    }

    if (sanitized.status === 'approved' || sanitized.status === 'rejected') {
      sanitized.reviewed_by = authResult.user.id
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updatesFinalCopy = Object.keys(sanitized).some((key) => FINAL_COPY_FIELDS.has(key))
    const lifecycleTarget = sanitized.status === 'approved'
      ? 'copy'
      : sectionGateApprovalTarget(sanitized.rag_context)

    if (lifecycleTarget || updatesFinalCopy) {
      const { data: currentItem, error: currentError } = await supabaseAdmin
        .from('social_content_queue')
        .select('*')
        .eq('id', id)
        .single()

      if (currentError || !currentItem) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 })
      }

      const candidateItem = {
        ...currentItem,
        ...sanitized,
      }
      if (sanitized.status === 'approved' || (updatesFinalCopy && isDurableCopyApprovedStatus(candidateItem.status))) {
        const copyQualityFailure = socialContentFinalCopyQualityFailure(
          validateSocialContentFinalCopyQuality(candidateItem),
        )
        if (copyQualityFailure) {
          return NextResponse.json(copyQualityFailure, { status: 409 })
        }
      }

      const projection = deriveSocialContentLifecycleProjection({
        item: candidateItem,
      })
      const failure = lifecyclePrerequisiteFailure(projection, lifecycleTarget)
      if (failure) {
        return NextResponse.json(failure, { status: 409 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .update(sanitized)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating social content:', error)
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('Error in PUT /api/admin/social-content/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
