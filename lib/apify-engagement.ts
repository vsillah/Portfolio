import {
  LINKEDIN_PROFILE_POSTS_ACTOR,
  LINKEDIN_PROFILE_POSTS_ACTOR_ID,
  normalizeEngagementRow,
  type NormalizedEngagementMetrics,
} from './social-engagement'
import type { SocialPlatform } from './social-content'

export type ApifyDatasetItem = Record<string, unknown>

export type EngagementFetchInput = {
  platform: SocialPlatform
  contentUrl: string | null
  platformPostId: string | null
  profileUrl?: string | null
  maxPosts?: number
}

export type EngagementFetchResult = {
  metrics: NormalizedEngagementMetrics
  actorId: string
  runId: string | null
  datasetId: string | null
  matchedItem: ApifyDatasetItem
}

function apifyToken() {
  return process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || null
}

function actorIdForLinkedInDirectPost() {
  return process.env.APIFY_LINKEDIN_POST_METRICS_ACTOR || 'iron-crawler/linkedin-post-metrics-scraper'
}

function profileUrlForLinkedIn() {
  return process.env.APIFY_LINKEDIN_PROFILE_URL || process.env.LINKEDIN_PROFILE_URL || null
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.trim().replace(/\/$/, '')
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function itemUrl(item: ApifyDatasetItem) {
  return normalizeUrl(
    stringValue(item.url) ??
    stringValue(item.postUrl) ??
    stringValue(item.post_url) ??
    stringValue(item.shareUrl) ??
    stringValue(item.shareLinkedinUrl) ??
    stringValue(item.linkedinUrl) ??
    stringValue(item.link),
  )
}

function itemId(item: ApifyDatasetItem) {
  return stringValue(item.id) ??
    stringValue(item.postId) ??
    stringValue(item.urn) ??
    stringValue(item.activityUrn) ??
    stringValue(item.shareUrn)
}

export function findBestEngagementMatch(input: {
  items: ApifyDatasetItem[]
  contentUrl: string | null
  platformPostId: string | null
}) {
  const expectedUrl = normalizeUrl(input.contentUrl)
  const expectedId = input.platformPostId

  if (expectedUrl) {
    const exact = input.items.find((item) => itemUrl(item) === expectedUrl)
    if (exact) return { item: exact, confidence: 'exact' as const }
  }

  if (expectedId) {
    const exactId = input.items.find((item) => itemId(item) === expectedId)
    if (exactId) return { item: exactId, confidence: 'exact' as const }
  }

  if (expectedUrl) {
    const matched = input.items.find((item) => {
      const url = itemUrl(item)
      return Boolean(url && (url.includes(expectedUrl) || expectedUrl.includes(url)))
    })
    if (matched) return { item: matched, confidence: 'matched' as const }
  }

  return input.items[0] ? { item: input.items[0], confidence: 'low' as const } : null
}

async function runActorAndGetDatasetItems(actorId: string, body: Record<string, unknown>) {
  const token = apifyToken()
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  const encodedActorId = actorId.replace('/', '~')
  const url = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Apify actor ${actorId} failed with ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }

  const runId = response.headers.get('x-apify-run-id')
  const datasetId = response.headers.get('x-apify-default-dataset-id')
  const data = await response.json()
  const items = Array.isArray(data) ? data : []
  return { items: items as ApifyDatasetItem[], runId, datasetId }
}

async function fetchLinkedInProfileMetrics(input: EngagementFetchInput): Promise<EngagementFetchResult | null> {
  const profileUrl = input.profileUrl || profileUrlForLinkedIn()
  if (!profileUrl) return null

  const actorId = LINKEDIN_PROFILE_POSTS_ACTOR
  const { items, runId, datasetId } = await runActorAndGetDatasetItems(actorId, {
    profileUrls: [profileUrl],
    maxPosts: input.maxPosts ?? 20,
    includeComments: true,
  })
  const match = findBestEngagementMatch({
    items,
    contentUrl: input.contentUrl,
    platformPostId: input.platformPostId,
  })
  if (!match) return null

  return {
    metrics: normalizeEngagementRow({
      platform: 'linkedin',
      row: match.item,
      contentUrl: input.contentUrl,
      platformPostId: input.platformPostId,
      actorId: LINKEDIN_PROFILE_POSTS_ACTOR_ID,
      runId,
      datasetId,
      confidence: match.confidence,
    }),
    actorId: LINKEDIN_PROFILE_POSTS_ACTOR_ID,
    runId,
    datasetId,
    matchedItem: match.item,
  }
}

async function fetchLinkedInDirectPostMetrics(input: EngagementFetchInput): Promise<EngagementFetchResult> {
  const actorId = actorIdForLinkedInDirectPost()
  if (!input.contentUrl && !input.platformPostId) {
    throw new Error('LinkedIn engagement refresh requires a platform post URL or post id')
  }

  const { items, runId, datasetId } = await runActorAndGetDatasetItems(actorId, {
    postUrls: input.contentUrl ? [input.contentUrl] : undefined,
    postUrl: input.contentUrl ?? undefined,
    urls: input.contentUrl ? [input.contentUrl] : undefined,
    postIds: input.platformPostId ? [input.platformPostId] : undefined,
    includeComments: true,
  })
  const match = findBestEngagementMatch({
    items,
    contentUrl: input.contentUrl,
    platformPostId: input.platformPostId,
  })
  if (!match) {
    throw new Error('Apify returned no LinkedIn engagement rows')
  }

  return {
    metrics: normalizeEngagementRow({
      platform: 'linkedin',
      row: match.item,
      contentUrl: input.contentUrl,
      platformPostId: input.platformPostId,
      actorId: actorId.replace('/', '~'),
      runId,
      datasetId,
      confidence: match.confidence,
    }),
    actorId: actorId.replace('/', '~'),
    runId,
    datasetId,
    matchedItem: match.item,
  }
}

export async function fetchEngagementMetrics(input: EngagementFetchInput): Promise<EngagementFetchResult> {
  if (input.platform !== 'linkedin') {
    throw new Error(`Automated engagement refresh currently supports LinkedIn only. Received ${input.platform}.`)
  }

  const profileResult = await fetchLinkedInProfileMetrics(input)
  if (profileResult) return profileResult
  return fetchLinkedInDirectPostMetrics(input)
}
