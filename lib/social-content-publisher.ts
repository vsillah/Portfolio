import { hasCurrentSocialReleaseApproval, hasIntactSocialReleaseReceipts } from '@/lib/social-release-evidence'
import { randomUUID } from 'node:crypto'
import { confirmedSocialPlatforms, hasAmbiguousSocialPublishRows, isSocialReleaseLocked, nextSocialReleaseVersion, socialReleaseGate } from '@/lib/social-release-safety'
import { publishToFacebook } from '@/lib/publishing/facebook'
import { publishToInstagram } from '@/lib/publishing/instagram'
import { publishToLinkedIn } from '@/lib/publishing/linkedin'
import { publishToTikTok } from '@/lib/publishing/tiktok'
import { publishToX } from '@/lib/publishing/x'
import { publishToYouTube } from '@/lib/publishing/youtube'
import type { SocialPlatform } from '@/lib/social-content'
import { syncCampaignCalendarForSocialContent } from '@/lib/social-content-calendar-linkage'
import { buildPlatformOrchestrationPlan, isPlatformSubmissionGateApproved } from '@/lib/social-platform-orchestration'
import { getProductionAssets, getVideoRedactionGate } from '@/lib/social-production-assets'
import {
  deriveSocialContentLifecycleProjection,
  lifecyclePrerequisiteFailure,
} from '@/lib/social-content-lifecycle'

type AdminClient = {
  from: (table: string) => unknown
}

type PublishRecord = Record<string, unknown>
type PlatformPublishResult = {
  platform: SocialPlatform | 'unknown'
  result: {
    success?: boolean
    status?: string
    error?: string
  }
}

function asQuery(value: unknown): any {
  return value
}

function asPlatform(value: unknown): SocialPlatform | null {
  return typeof value === 'string' && ['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok', 'x'].includes(value)
    ? value as SocialPlatform
    : null
}

function asPlatformList(values: unknown[]): SocialPlatform[] {
  return values.map(asPlatform).filter((platform): platform is SocialPlatform => Boolean(platform))
}

export type PublishSocialContentResult = {
  status: number
  body: Record<string, unknown>
}

export async function publishSocialContentItem(input: {
  admin: AdminClient
  id: string
  targetPlatforms?: SocialPlatform[]
  expectedUpdatedAt?: string
}): Promise<PublishSocialContentResult> {
  const { admin, id, targetPlatforms } = input

  const { data: item, error: fetchError } = await asQuery(admin.from('social_content_queue'))
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !item) {
    return { status: 404, body: { error: 'Content not found' } }
  }

  if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== item.updated_at) {
    return { status: 409, body: { error: 'Content changed since confirmation. Refresh and review before submitting.' } }
  }

  if (item.status !== 'approved' && item.status !== 'scheduled') {
    return { status: 400, body: { error: 'Content must be approved before publishing' } }
  }

  if (isSocialReleaseLocked(item.rag_context) && socialReleaseGate(item.rag_context).status !== 'approved') {
    return { status: 409, body: { error: 'Release is already submitting or requires reconciliation. No retry was dispatched.' } }
  }

  const redactionGate = getVideoRedactionGate(getProductionAssets(item.rag_context))
  if (!redactionGate.ready) {
    return {
      status: 409,
      body: {
        error: redactionGate.message || 'Video privacy review required before publishing',
        unresolved_redaction_items: redactionGate.unresolvedItems.length,
      },
    }
  }

  const { data: publishes, error: publishesError } = await asQuery(admin.from('social_content_publishes'))
    .select('*')
    .eq('content_id', id)

  if (publishesError || !publishes?.length) {
    return { status: 400, body: { error: 'No publish records found - approve the content first' } }
  }

  if (hasAmbiguousSocialPublishRows(publishes)) {
    return { status: 409, body: { error: 'Existing provider dispatch requires reconciliation before another release.', reconciliation_required: true } }
  }

  if ((Object.keys(confirmedSocialPlatforms(item.rag_context)).length || publishes.some((row: PublishRecord) => row.status === 'published'))
    && !hasIntactSocialReleaseReceipts(item, publishes)) {
    return { status: 409, body: { error: 'Reviewed content or confirmed receipts changed. Reconciliation required.', reconciliation_required: true } }
  }
  if (targetPlatforms?.some(platform => !publishes.some((row: PublishRecord) => row.platform === platform && row.status === 'pending'))) {
    return { status: 409, body: { error: 'Select only unsubmitted pending targets. Published targets cannot be repeated.' } }
  }

  const lifecycleFailure = lifecyclePrerequisiteFailure(
    deriveSocialContentLifecycleProjection({
      item: {
        ...item,
        publishes,
      },
    }),
    'submit',
  )
  if (lifecycleFailure) {
    return { status: 409, body: lifecycleFailure }
  }

  let pendingPublishes = publishes.filter((publish: PublishRecord) => (
    publish.status === 'pending' || publish.status === 'failed'
  ))

  if (targetPlatforms?.length) {
    pendingPublishes = pendingPublishes.filter((publish: PublishRecord) => (
      targetPlatforms.includes(publish.platform as SocialPlatform)
    ))
  }

  if (!pendingPublishes.length) {
    return {
      status: 200,
      body: {
        message: 'No pending platforms to publish',
        results: publishes.map((publish: PublishRecord) => ({
          platform: publish.platform,
          status: publish.status,
          skipped: true,
        })),
      },
    }
  }

  const publishPlatforms = asPlatformList(pendingPublishes.map((publish: PublishRecord) => publish.platform))
  const { data: platformConfigs } = await asQuery(admin.from('social_content_config')).select('*')

  const platformSubmissionPlan = buildPlatformOrchestrationPlan({
    item: item as never,
    targetPlatforms: publishPlatforms,
    publishRecords: publishes as never,
    platformConfigs: platformConfigs ?? [],
    copyApproved: true,
    productionReady: true,
    redactionReady: true,
    draftHandoffReady: true,
    finalSubmissionGateReady: isPlatformSubmissionGateApproved(item.rag_context, publishPlatforms),
  })
  const blockedStages = platformSubmissionPlan.platforms
    .map((platformPlan) => {
      const blockedStage = platformPlan.stages.find((stage) => stage.state === 'blocked')
      return blockedStage ? `${platformPlan.label}: ${blockedStage.detail}` : null
    })
    .filter((blocker): blocker is string => Boolean(blocker))
  const unavailablePlatforms = platformSubmissionPlan.platforms.filter((platformPlan) => {
    const automaticStage = platformPlan.stages.find((stage) => stage.key === 'automatic_submission')
    return automaticStage?.state !== 'available'
  })

  if (blockedStages.length || unavailablePlatforms.length) {
    return {
      status: 409,
      body: {
        error: 'Platform submission requires final approval and connected platform configuration.',
        blockers: blockedStages.length
          ? blockedStages
          : unavailablePlatforms.map((platformPlan) => `${platformPlan.label}: ${platformPlan.nextAction}`),
        platform_submission_orchestration: platformSubmissionPlan,
      },
    }
  }

  if (!hasCurrentSocialReleaseApproval(item)) {
    return { status: 409, body: { error: 'Final platform approval does not match the current content version. Reload and approve the release.' } }
  }
  const releaseId = randomUUID()
  const claimedVersion = nextSocialReleaseVersion(item.updated_at)
  const claimedContext = {
    ...item.rag_context,
    platform_submission_gate: { ...socialReleaseGate(item.rag_context), status: 'submitting',
      release_id: releaseId, claimed_at: claimedVersion, release_platforms: publishPlatforms },
  }
  const { data: claimed, error: claimError } = await asQuery(admin.from('social_content_queue'))
    .update({ rag_context: claimedContext, updated_at: claimedVersion })
    .eq('id', id).eq('updated_at', item.updated_at).eq('status', item.status)
    .select('*').maybeSingle()
  if (claimError || !claimed) {
    return { status: 409, body: { error: 'Release claim was not confirmed. Reload before taking another action.', reconciliation_required: true } }
  }

  const ownedVersion = claimed.updated_at
  if (typeof ownedVersion !== 'string') {
    return { status: 409, body: { error: 'Release version unconfirmed. Reconciliation required.', reconciliation_required: true } }
  }

  const results = await Promise.allSettled(
    pendingPublishes.map(async (publish: PublishRecord): Promise<PlatformPublishResult> => {
      const platform = publish.platform as SocialPlatform
      const payload = {
        contentId: id,
        postText: item.post_text,
        companionPostText: item.companion_post_text,
        ctaText: item.cta_text,
        ctaUrl: item.cta_url,
        hashtags: item.hashtags,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        carouselSlideUrls: item.carousel_slide_urls,
        youtubeTitle: item.youtube_title,
        youtubeDescription: item.youtube_description,
        ragContext: item.rag_context,
      }

      switch (platform) {
        case 'linkedin':
          return { platform, result: await publishToLinkedIn({ ...payload, releaseClaimId: releaseId } as never) }
        case 'youtube':
          return { platform, result: await publishToYouTube(payload as never) }
        case 'instagram':
          return { platform, result: await publishToInstagram(payload as never) }
        case 'facebook':
          return { platform, result: await publishToFacebook(payload as never) }
        case 'tiktok':
          return { platform, result: await publishToTikTok(payload as never) }
        case 'x':
          return { platform, result: await publishToX(payload as never) }
        default:
          await asQuery(admin.from('social_content_publishes'))
            .update({ status: 'skipped', error_message: `${platform} publishing not yet implemented` })
            .eq('content_id', id)
            .eq('platform', platform)
          return {
            platform,
            result: { success: false, error: `${platform} publishing not yet implemented` },
          }
      }
    }),
  )

  const platformResults = results.map((result): PlatformPublishResult => {
    if (result.status === 'fulfilled') return result.value
    return { platform: 'unknown', result: { success: false, error: result.reason?.message || 'Unknown error' } }
  })
  // A failed or empty provider result cannot prove that no external effect occurred.
  // Retain a queue-wide reconciliation lock even when an adapter marked its row failed.
  const allConfirmed = platformResults.length === pendingPublishes.length && platformResults.every(result =>
    result.result?.success === true && result.result.status !== 'publishing')
  const publishedAt = new Date().toISOString()
  let updatedPublishes: PublishRecord[] | null = null
  try {
    const readback = await asQuery(admin.from('social_content_publishes')).select('*').eq('content_id', id)
    if (readback.error) throw new Error('Publish evidence read failed')
    updatedPublishes = readback.data
  } catch { /* The submitting claim remains the durable safety boundary. */ }
  const selectedPublished = allConfirmed && Boolean(updatedPublishes)
    && !hasAmbiguousSocialPublishRows(updatedPublishes!)
    && publishPlatforms.every(platform => updatedPublishes!.filter(row => row.platform === platform
      && row.status === 'published' && typeof row.platform_post_id === 'string' && row.platform_post_id.length > 0).length === 1)
    && Object.entries(confirmedSocialPlatforms(item.rag_context)).every(([platform, id]) =>
      updatedPublishes!.some(row => row.platform === platform && row.status === 'published' && row.platform_post_id === id))
  const confirmedPlatforms = selectedPublished ? Object.fromEntries(updatedPublishes!
    .filter(row => row.status === 'published').map(row => [row.platform, row.platform_post_id])) : confirmedSocialPlatforms(item.rag_context)
  const remainingPlatforms = (updatedPublishes ?? []).filter(row => row.status === 'pending').map(row => row.platform)
  const allPublished = selectedPublished && Boolean(updatedPublishes?.length) && updatedPublishes!.every(row =>
    row.status === 'published' && typeof row.platform_post_id === 'string' && row.platform_post_id.length > 0)
  const finalContext = { ...claimedContext, platform_submission_gate: {
    ...claimedContext.platform_submission_gate, status: allPublished ? 'submitted' : selectedPublished ? 'partially_submitted' : 'uncertain',
    confirmed_platforms: confirmedPlatforms,
    reconciliation_required: !selectedPublished,
  } }
  try {
    const saved = await asQuery(admin.from('social_content_queue'))
      .update({ rag_context: finalContext, updated_at: nextSocialReleaseVersion(ownedVersion),
        ...(allPublished ? { status: 'published', published_at: publishedAt } : {}) })
      .eq('id', id).eq('updated_at', ownedVersion)
      .eq('rag_context->platform_submission_gate->>release_id', releaseId)
      .select('id').maybeSingle()
    if (saved.error || !saved.data) throw new Error('Release outcome was not saved')
  } catch {
    return { status: 409, body: { error: 'Provider outcome persistence is unconfirmed. Reconcile this release; do not resubmit.',
      reconciliation_required: true, release_id: releaseId, results: platformResults } }
  }

  let calendarLinkage: unknown = null
  if (allPublished) {
    try {
      calendarLinkage = await syncCampaignCalendarForSocialContent({ admin, socialContentId: id,
        event: { type: 'published', at: publishedAt, platforms: asPlatformList(updatedPublishes!.map(row => row.platform)),
          platformPostUrls: updatedPublishes!.map(row => row.platform_post_url).filter((url): url is string => typeof url === 'string') } })
    } catch { calendarLinkage = { error: 'Published release requires calendar reconciliation.' } }
  }
  return { status: selectedPublished ? 200 : 409, body: {
    published: allPublished, selected_published: selectedPublished, remaining_platforms: remainingPlatforms, reconciliation_required: !selectedPublished, release_id: releaseId,
    results: platformResults, publishes: updatedPublishes, calendar_linkage: calendarLinkage,
    ...(!selectedPublished ? { error: 'Release outcome requires reconciliation. No automatic retry is permitted.' } : {}),
  } }
}
