import cohort from '@/artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/cohort.json'
import { createHash } from 'node:crypto'
import { rawResponseSha256 } from './attributable-performance-evidence'
import { YOUTUBE_READONLY_SCOPE } from './youtube-oauth'

export const YOUTUBE_EVIDENCE_CONTENT_ID = 'f966123f-05eb-48ec-a7c2-970afce642ef'
export const YOUTUBE_EVIDENCE_CALENDAR_ID = '669f6c22-d373-4423-bf7c-77661c484302'
export const YOUTUBE_EVIDENCE_COHORT_SHA256 = rawResponseSha256(cohort)
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const VIDEO_URL = 'https://www.googleapis.com/youtube/v3/videos'
const CHANNEL_URL = 'https://www.googleapis.com/youtube/v3/channels'
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/

type Credentials = { access_token?: string; refresh_token?: string; scope?: string; token_obtained_at?: string; expires_in?: number }
export type YouTubeEvidenceRequest = {
  content_id: typeof YOUTUBE_EVIDENCE_CONTENT_ID
  calendar_item_id: typeof YOUTUBE_EVIDENCE_CALENDAR_ID
  cohort_sha256: string
  expected_content_updated_at: string
}
export type YouTubeEvidenceResult = {
  contract_version: 'youtube-readonly-evidence-acquisition-v1'
  content_id: string
  calendar_item_id: string
  cohort_sha256: string
  status: 'acquired_unscored' | 'blocked'
  blockers: string[]
  qualification_blockers: string[]
  source_policy_expires_at: null
  records: Array<{
    role: 'approved_comparable'
    video_id: string
    channel_id: string
    format: 'shorts'
    canonical_url: string
    published_at: string
    observed_at: string
    duration_seconds: number
    views: number
    likes: number | null
    comments: number | null
    public_subscribers: number
    approved_inclusion_reason: string
    raw_response_sha256: string
    video_response_sha256: string
    channel_response_sha256: string
    video_body_sha256: string
    channel_body_sha256: string
  }>
  scoring_enabled: false
  persistence_enabled: false
  external_actions_enabled: false
  receipt_sha256: string
}

type Input = { request: YouTubeEvidenceRequest; credentials: Credentials | null; is_active: boolean; content_updated_at: string | null; calendar_bound: boolean; fetchImpl?: typeof fetch; now?: Date }
const obj = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const str = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
const count = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null
function result(request: YouTubeEvidenceRequest, blockers: string[], qualificationBlockers: string[], records: YouTubeEvidenceResult['records']): YouTubeEvidenceResult {
  const body = {
    contract_version: 'youtube-readonly-evidence-acquisition-v1' as const,
    content_id: request.content_id,
    calendar_item_id: request.calendar_item_id,
    cohort_sha256: request.cohort_sha256,
    status: blockers.length ? 'blocked' as const : 'acquired_unscored' as const,
    blockers,
    qualification_blockers: qualificationBlockers,
    source_policy_expires_at: null,
    records,
    scoring_enabled: false as const,
    persistence_enabled: false as const,
    external_actions_enabled: false as const,
  }
  return { ...body, receipt_sha256: rawResponseSha256(body) }
}
function durationSeconds(value: unknown): number | null {
  const parts = str(value)?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  return parts ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : null
}
async function readProviderBody(response: Response): Promise<{ parsed: unknown; bodySha256: string }> {
  const body = await response.text()
  if (body.length > 1_000_000) throw new Error('Provider response exceeded the read-only evidence limit.')
  return { parsed: JSON.parse(body), bodySha256: createHash('sha256').update(body).digest('hex') }
}

/** No DB client or writer is accepted. Every provider request is a single read-only GET, except one in-memory OAuth refresh. */
export async function acquireYouTubeReadOnlyEvidence(input: Input): Promise<YouTubeEvidenceResult> {
  const { request } = input
  const now = input.now ?? new Date()
  const blockers: string[] = []
  if (request.content_id !== YOUTUBE_EVIDENCE_CONTENT_ID || request.calendar_item_id !== YOUTUBE_EVIDENCE_CALENDAR_ID || request.cohort_sha256 !== YOUTUBE_EVIDENCE_COHORT_SHA256) blockers.push('Exact target or approved cohort binding differs.')
  if (!input.calendar_bound || !input.content_updated_at || request.expected_content_updated_at !== input.content_updated_at) blockers.push('Canonical Social Content and calendar version binding differs.')
  if (cohort.status !== 'approved' || cohort.included.length < 5 || cohort.included.some((entry) => entry.decision !== 'include' || !VIDEO_ID.test(entry.video_id) || !CHANNEL_ID.test(entry.channel_id) || entry.youtube_url !== `https://www.youtube.com/shorts/${entry.video_id}`)) blockers.push('Approved Shorts cohort identity is invalid.')
  if (!input.is_active || !input.credentials?.access_token) blockers.push('YouTube connection is inactive or incomplete.')
  if (!new Set(input.credentials?.scope?.split(/\s+/)).has(YOUTUBE_READONLY_SCOPE)) blockers.push('Stored YouTube connection lacks youtube.readonly.')
  if (blockers.length) return result(request, blockers, [], [])
  const credentials = input.credentials!
  const obtained = Date.parse(credentials.token_obtained_at ?? '')
  if (!Number.isFinite(obtained) || typeof credentials.expires_in !== 'number' || !Number.isFinite(credentials.expires_in) || credentials.expires_in <= 0) return result(request, ['Stored access-token expiry is unknown.'], [], [])
  let accessToken = credentials.access_token!
  const fetchImpl = input.fetchImpl ?? fetch
  if (obtained + credentials.expires_in * 1000 <= now.getTime() + 60_000) {
    const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET
    if (!credentials.refresh_token || !clientId || !clientSecret) return result(request, ['In-memory token refresh is unavailable.'], [], [])
    try {
      const response = await fetchImpl(TOKEN_URL, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token, client_id: clientId, client_secret: clientSecret }) })
      if (!response.ok) return result(request, ['In-memory token refresh failed.'], [], [])
      const refreshed = obj(await response.json())
      if (!str(refreshed?.access_token) || (refreshed?.scope && !new Set(String(refreshed.scope).split(/\s+/)).has(YOUTUBE_READONLY_SCOPE))) return result(request, ['In-memory token refresh failed.'], [], [])
      accessToken = String(refreshed?.access_token)
    } catch { return result(request, ['In-memory token refresh failed.'], [], []) }
  }
  const records: YouTubeEvidenceResult['records'] = []
  const qualificationBlockers: string[] = []
  qualificationBlockers.push('Approved exact-version YouTube public-metrics source-class freshness policy and expiry rule are missing; no expires_at can be assigned.')
  qualificationBlockers.push('Comparable privacy and rights clearance for the new response version is not bound to an approved receipt.')
  try {
    for (const seed of cohort.included) {
      const headers = { Authorization: `Bearer ${accessToken}` }
      const videoParams = new URLSearchParams({ part: 'snippet,contentDetails,statistics,status', id: seed.video_id })
      const videoResponse = await fetchImpl(`${VIDEO_URL}?${videoParams}`, { method: 'GET', headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!videoResponse.ok) return result(request, ['YouTube video lookup failed or quota/access was denied.'], qualificationBlockers, records)
      const { parsed: videoRaw, bodySha256: videoBodySha256 } = await readProviderBody(videoResponse)
      const videos = obj(videoRaw)?.items
      const video = Array.isArray(videos) && videos.length === 1 ? obj(videos[0]) : null
      const snippet = obj(video?.snippet), statistics = obj(video?.statistics), status = obj(video?.status)
      const publishedAt = str(snippet?.publishedAt)
      const duration = durationSeconds(obj(video?.contentDetails)?.duration)
      if (video?.id !== seed.video_id || snippet?.channelId !== seed.channel_id || status?.privacyStatus !== 'public' || !publishedAt || !Number.isFinite(Date.parse(publishedAt)) || publishedAt !== seed.published_at || duration === null || duration < 15 || duration > 60 || duration !== seed.duration_seconds) return result(request, ['Video identity, approved Shorts duration, publication, or public visibility differs.'], qualificationBlockers, records)
      const views = count(statistics?.viewCount)
      if (views === null) return result(request, ['Required public views are unavailable.'], qualificationBlockers, records)
      const channelParams = new URLSearchParams({ part: 'statistics', id: seed.channel_id })
      const channelResponse = await fetchImpl(`${CHANNEL_URL}?${channelParams}`, { method: 'GET', headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!channelResponse.ok) return result(request, ['YouTube channel lookup failed or quota/access was denied.'], qualificationBlockers, records)
      const { parsed: channelRaw, bodySha256: channelBodySha256 } = await readProviderBody(channelResponse)
      const channels = obj(channelRaw)?.items
      const channel = Array.isArray(channels) && channels.length === 1 ? obj(channels[0]) : null
      const channelStatistics = obj(channel?.statistics)
      const subscribers = count(channelStatistics?.subscriberCount)
      if (channel?.id !== seed.channel_id || subscribers === null || subscribers === 0 || channelStatistics?.hiddenSubscriberCount === true) return result(request, ['Channel identity or public subscriber baseline is unavailable.'], qualificationBlockers, records)
      records.push({ role: 'approved_comparable', video_id: seed.video_id, channel_id: seed.channel_id, format: 'shorts', canonical_url: seed.youtube_url, published_at: publishedAt, observed_at: now.toISOString(), duration_seconds: duration, views, likes: count(statistics?.likeCount), comments: count(statistics?.commentCount), public_subscribers: subscribers, approved_inclusion_reason: seed.inclusion_reason, raw_response_sha256: rawResponseSha256({ video: videoRaw, channel: channelRaw }), video_response_sha256: rawResponseSha256(videoRaw), channel_response_sha256: rawResponseSha256(channelRaw), video_body_sha256: videoBodySha256, channel_body_sha256: channelBodySha256 })
    }
    if (records.length < 5) return result(request, ['Fewer than five approved comparables were acquired.'], qualificationBlockers, records)
    return result(request, [], qualificationBlockers, records)
  } catch { return result(request, ['YouTube read-only acquisition failed.'], qualificationBlockers, records) }
  finally { accessToken = '' }
}
