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
}): Promise<PublishSocialContentResult> {
  const { admin, id, targetPlatforms } = input

  const { data: item, error: fetchError } = await asQuery(admin.from('social_content_queue'))
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !item) {
    return { status: 404, body: { error: 'Content not found' } }
  }

  if (item.status !== 'approved' && item.status !== 'scheduled') {
    return { status: 400, body: { error: 'Content must be approved before publishing' } }
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

  const { data: publishes } = await asQuery(admin.from('social_content_publishes'))
    .select('*')
    .eq('content_id', id)

  if (!publishes?.length) {
    return { status: 400, body: { error: 'No publish records found - approve the content first' } }
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

  const results = await Promise.allSettled(
    pendingPublishes.map(async (publish: PublishRecord): Promise<PlatformPublishResult> => {
      const platform = publish.platform as SocialPlatform
      const payload = {
        contentId: id,
        postText: item.post_text,
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
          return { platform, result: await publishToLinkedIn(payload as never) }
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
  const anyPublished = platformResults.some((result: PlatformPublishResult) => (
    result.result.success && result.result.status !== 'publishing'
  ))
  const publishedAt = new Date().toISOString()

  if (anyPublished) {
    await asQuery(admin.from('social_content_queue'))
      .update({ status: 'published', published_at: publishedAt })
      .eq('id', id)
  }

  const { data: updatedPublishes } = await asQuery(admin.from('social_content_publishes'))
    .select('*')
    .eq('content_id', id)

  const publishedPlatforms = asPlatformList(
    platformResults
      .filter((result: PlatformPublishResult) => result.result.success && result.result.status !== 'publishing')
      .map((result: PlatformPublishResult) => result.platform),
  )
  const platformPostUrls = ((updatedPublishes ?? []) as Array<{ platform_post_url?: unknown }>)
    .map((publish) => publish.platform_post_url)
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)

  const calendarLinkage = anyPublished
    ? await syncCampaignCalendarForSocialContent({
      admin,
      socialContentId: id,
      event: {
        type: 'published',
        at: publishedAt,
        platforms: publishedPlatforms,
        platformPostUrls,
      },
    })
    : null

  return {
    status: 200,
    body: {
      published: anyPublished,
      results: platformResults,
      publishes: updatedPublishes,
      calendar_linkage: calendarLinkage,
    },
  }
}
