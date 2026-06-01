import { fetchEngagementMetrics } from './apify-engagement'
import {
  buildHighSignalInsight,
  mapBacklogTheme,
  mergeEngagementIntoRagContext,
  scoreEngagement,
  type HighSignalInsight,
} from './social-engagement'
import type { SocialPlatform } from './social-content'

type SupabaseClientLike = {
  from: (table: string) => any
}

type PublishRow = {
  id: string
  content_id: string
  platform: SocialPlatform
  status: string
  platform_post_id: string | null
  platform_post_url: string | null
  published_at: string | null
}

type ContentRow = {
  id: string
  platform: SocialPlatform
  status: string
  post_text: string | null
  topic_extracted: Record<string, unknown> | null
  rag_context: Record<string, unknown> | null
  platform_post_id: string | null
  published_at: string | null
}

export type EngagementRefreshResult = {
  refreshed: number
  skipped: number
  errors: Array<{ contentId: string; message: string }>
  insights: HighSignalInsight[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function refreshedToday(ragContext: Record<string, unknown> | null, dateKey = todayKey()) {
  const latest = asRecord(asRecord(ragContext?.engagement)?.latest)
  const capturedAt = stringValue(latest?.capturedAt)
  return Boolean(capturedAt?.startsWith(dateKey))
}

export async function refreshPublishedSocialEngagement(input: {
  db: SupabaseClientLike
  platform?: SocialPlatform
  contentId?: string | null
  limit?: number
  force?: boolean
  captureDate?: Date
}): Promise<EngagementRefreshResult> {
  const platform = input.platform ?? 'linkedin'
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50)
  const captureDateKey = todayKey(input.captureDate)

  let publishQuery = input.db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at')
    .eq('status', 'published')
    .eq('platform', platform)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (input.contentId) {
    publishQuery = publishQuery.eq('content_id', input.contentId)
  }

  const publishesRes = await publishQuery
  if (publishesRes.error) throw new Error(publishesRes.error.message)
  const publishes = (publishesRes.data ?? []) as PublishRow[]
  if (!publishes.length) return { refreshed: 0, skipped: 0, errors: [], insights: [] }

  const contentIds = [...new Set(publishes.map((publish) => publish.content_id))]
  const contentRes = await input.db
    .from('social_content_queue')
    .select('id, platform, status, post_text, topic_extracted, rag_context, platform_post_id, published_at')
    .in('id', contentIds)

  if (contentRes.error) throw new Error(contentRes.error.message)
  const contentRows = (contentRes.data ?? []) as ContentRow[]
  const contentById = new Map<string, ContentRow>(contentRows.map((row) => [row.id, row]))

  const result: EngagementRefreshResult = { refreshed: 0, skipped: 0, errors: [], insights: [] }

  for (const publish of publishes) {
    const content = contentById.get(publish.content_id)
    if (!content) {
      result.errors.push({ contentId: publish.content_id, message: 'Social Content row not found' })
      continue
    }
    if (!input.force && refreshedToday(content.rag_context, captureDateKey)) {
      result.skipped += 1
      continue
    }

    try {
      const source = await fetchEngagementMetrics({
        platform: publish.platform,
        contentUrl: publish.platform_post_url,
        platformPostId: publish.platform_post_id ?? content.platform_post_id,
      })
      const score = scoreEngagement(source.metrics)
      const topic = stringValue(content.topic_extracted?.topic)
      const mapped = mapBacklogTheme({
        postText: content.post_text,
        topic,
        ragContext: content.rag_context,
      })
      const ragContext = mergeEngagementIntoRagContext({
        ragContext: content.rag_context,
        metrics: source.metrics,
        score,
        theme: mapped.theme,
        sourcePrdHref: mapped.href,
      })

      const updateRes = await input.db
        .from('social_content_queue')
        .update({ rag_context: ragContext })
        .eq('id', content.id)
        .select('id')
        .single()

      if (updateRes.error) throw new Error(updateRes.error.message)

      result.refreshed += 1
      result.insights.push(buildHighSignalInsight({
        contentId: content.id,
        postText: content.post_text,
        topic,
        ragContext,
        metrics: source.metrics,
      }))
    } catch (error) {
      result.errors.push({
        contentId: content.id,
        message: error instanceof Error ? error.message : 'Engagement refresh failed',
      })
    }
  }

  result.insights.sort((a, b) => b.score - a.score)
  return result
}
