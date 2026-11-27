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
const MIN_BASELINE = cohort.target.minimum_channel_baseline_size
const MIN_COHORT = 5
const BAND_ORDER = ['micro', 'emerging', 'established', 'large'] as const
type AudienceBand = typeof BAND_ORDER[number]
type Credentials = { access_token?: string; refresh_token?: string; scope?: string; token_obtained_at?: string; expires_in?: number }
export type YouTubeEvidenceRequest = {
  content_id: typeof YOUTUBE_EVIDENCE_CONTENT_ID
  calendar_item_id: typeof YOUTUBE_EVIDENCE_CALENDAR_ID
  cohort_sha256: string
  expected_content_updated_at: string
}
type Exclusion = { video_id: string; reason: string; response_sha256: string | null }
type Baseline = {
  seed_video_ids: string[]
  included_video_ids: string[]
  excluded: Exclusion[]
  median_views: number | null
  receipt_sha256: string
}
type RecordEvidence = {
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
  audience_band: AudienceBand
  approved_inclusion_reason: string
  baseline: Baseline
  channel_relative_ratio: number
  audience_view_ratio: number
  recency_adjusted_views_per_day: number
  age_days: number
  raw_response_sha256: string
  video_response_sha256: string
  channel_response_sha256: string
  video_body_sha256: string
  channel_body_sha256: string
}
type ComparableDecision = { video_id: string; channel_id: string; status: 'included' | 'excluded'; reason: string; audience_band: AudienceBand | null }
type ProviderResponse = { kind: 'video' | 'channel'; object_id: string; http_status: number; body_sha256: string }
type FieldDecision = 'match' | 'mismatch' | 'unavailable'
type CandidateObservation = {
  approved_video_id: string
  approved_published_at: string
  response_body_sha256: string
  // Only these public, bounded videos.list fields are needed to reconcile the seed.
  raw_response_evidence: { video_id: string | null; channel_id: string | null; published_at: string | null; duration: string | null; privacy_status: 'public' | 'private' | 'unlisted' | null }
  parsed_duration_seconds: number | null
  shorts_format_determination: 'duration_band_match' | 'outside_duration_band' | 'unavailable'
  field_decisions: { video_id: FieldDecision; channel_id: FieldDecision; published_at: FieldDecision; duration: FieldDecision; public_status: FieldDecision; shorts_duration_band: FieldDecision }
  inclusion: 'included' | 'excluded'
  exclusion_fields: Array<keyof CandidateObservation['field_decisions']>
}
export type YouTubeEvidenceResult = {
  contract_version: 'youtube-readonly-evidence-acquisition-v2'
  content_id: string
  calendar_item_id: string
  cohort_sha256: string
  observed_at: string
  status: 'acquired_unscored' | 'blocked'
  blockers: string[]
  qualification_blockers: string[]
  source_policy_expires_at: null
  selected_audience_band: AudienceBand | null
  included_video_ids: string[]
  comparable_decisions: ComparableDecision[]
  baseline_receipts: Array<{ comparable_video_id: string; channel_id: string; baseline: Baseline }>
  provider_responses: ProviderResponse[]
  candidate_observations: CandidateObservation[]
  seed_exclusions: Array<{ video_id: string; reason: string }>
  records: RecordEvidence[]
  scoring_enabled: false
  persistence_enabled: false
  external_actions_enabled: false
  receipt_sha256: string
}

type Input = { request: YouTubeEvidenceRequest; credentials: Credentials | null; is_active: boolean; content_updated_at: string | null; calendar_bound: boolean; fetchImpl?: typeof fetch; now?: Date }
type Seed = typeof cohort.included[number]
type VideoSnapshot = { id: string; channelId: string; publishedAt: string; duration: number; views: number; likes: number | null; comments: number | null; responseSha256: string; bodySha256: string }
type VideoRead = { video: VideoSnapshot | null; exclusion: Exclusion | null; evidence: CandidateObservation['raw_response_evidence'] | null; bodySha256: string }
const obj = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const str = (value: unknown) => typeof value === 'string' && value.trim() ? value : null
const count = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null
const round4 = (value: number) => Number(value.toFixed(4))
const band = (subscribers: number): AudienceBand => subscribers < 10_000 ? 'micro' : subscribers < 100_000 ? 'emerging' : subscribers < 1_000_000 ? 'established' : 'large'
function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
function result(input: Input, blockers: string[], qualificationBlockers: string[], records: RecordEvidence[], decisions: ComparableDecision[], selectedBand: AudienceBand | null, baselineReceipts: YouTubeEvidenceResult['baseline_receipts'] = [], providerResponses: ProviderResponse[] = [], candidateObservations: CandidateObservation[] = []): YouTubeEvidenceResult {
  const included = decisions.filter((decision) => decision.status === 'included').map((decision) => decision.video_id)
  const body = {
    contract_version: 'youtube-readonly-evidence-acquisition-v2' as const,
    content_id: input.request.content_id,
    calendar_item_id: input.request.calendar_item_id,
    cohort_sha256: input.request.cohort_sha256,
    observed_at: (input.now ?? new Date()).toISOString(),
    status: blockers.length ? 'blocked' as const : 'acquired_unscored' as const,
    blockers,
    qualification_blockers: qualificationBlockers,
    source_policy_expires_at: null,
    selected_audience_band: selectedBand,
    included_video_ids: included,
    comparable_decisions: decisions,
    baseline_receipts: baselineReceipts,
    provider_responses: providerResponses,
    candidate_observations: candidateObservations,
    seed_exclusions: cohort.excluded.map((entry) => ({ video_id: entry.video_id, reason: entry.exclusion_reason })),
    records,
    scoring_enabled: false as const,
    persistence_enabled: false as const,
    external_actions_enabled: false as const,
  }
  return { ...body, receipt_sha256: rawResponseSha256(body) }
}
function durationSeconds(value: unknown): number | null {
  const parts = str(value)?.match(/^PT(?=.)(?:(\d{1,4})H)?(?:(\d{1,4})M)?(?:(\d{1,4})S)?$/)
  if (!parts) return null
  const seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
  return Number.isSafeInteger(seconds) ? seconds : null
}
const safeVideoId = (value: unknown) => typeof value === 'string' && VIDEO_ID.test(value) ? value : null
const safeChannelId = (value: unknown) => typeof value === 'string' && CHANNEL_ID.test(value) ? value : null
function utcInstant(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const parts = value.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,3}))?Z$/)
  if (!parts) return null
  const instant = Date.parse(value)
  if (!Number.isFinite(instant)) return null
  const canonical = `${parts[1]}.${(parts[2] ?? '').padEnd(3, '0')}Z`
  return new Date(instant).toISOString() === canonical ? instant : null
}
const safePublishedAt = (value: unknown) => utcInstant(value) === null ? null : value as string
const safeDuration = (value: unknown) => typeof value === 'string' && value.length <= 24 && durationSeconds(value) !== null ? value : null
const safePrivacy = (value: unknown) => value === 'public' || value === 'private' || value === 'unlisted' ? value : null
function compare(observed: string | number | null, expected: string | number): FieldDecision { return observed === null ? 'unavailable' : observed === expected ? 'match' : 'mismatch' }
function comparePublication(observed: string | null, expected: string): FieldDecision {
  const observedInstant = utcInstant(observed)
  const expectedInstant = utcInstant(expected)
  return observedInstant === null || expectedInstant === null ? 'unavailable' : observedInstant === expectedInstant ? 'match' : 'mismatch'
}
async function readProviderBody(response: Response): Promise<{ parsed: unknown; bodySha256: string }> {
  const body = await response.text()
  if (body.length > 1_000_000) throw new Error('Provider response exceeded read-only evidence limit.')
  let parsed: unknown = null
  try { parsed = JSON.parse(body) } catch { /* malformed response fails identity checks */ }
  return { parsed, bodySha256: createHash('sha256').update(body).digest('hex') }
}
function seedValid(seed: Seed): boolean {
  const ids = seed.channel_baseline?.video_ids
  return seed.decision === 'include' && VIDEO_ID.test(seed.video_id) && CHANNEL_ID.test(seed.channel_id)
    && seed.youtube_url === `https://www.youtube.com/shorts/${seed.video_id}`
    && Number.isFinite(Date.parse(seed.published_at)) && seed.duration_seconds >= 15 && seed.duration_seconds <= 60
    && Array.isArray(ids) && ids.length >= MIN_BASELINE && ids.length <= 10 && new Set(ids).size === ids.length && ids.every((id) => VIDEO_ID.test(id))
}

/** Only fixed Data API GETs and, on expiry, one in-memory OAuth refresh. No DB client or writer is accepted. */
export async function acquireYouTubeReadOnlyEvidence(input: Input): Promise<YouTubeEvidenceResult> {
  const { request } = input
  const now = input.now ?? new Date()
  const blocked = (reasons: string[], records: RecordEvidence[] = [], decisions: ComparableDecision[] = []) => result(input, reasons, [], records, decisions, null)
  const blockers: string[] = []
  if (request.content_id !== YOUTUBE_EVIDENCE_CONTENT_ID || request.calendar_item_id !== YOUTUBE_EVIDENCE_CALENDAR_ID || request.cohort_sha256 !== YOUTUBE_EVIDENCE_COHORT_SHA256) blockers.push('Exact target or approved cohort binding differs.')
  if (!input.calendar_bound || !input.content_updated_at || request.expected_content_updated_at !== input.content_updated_at) blockers.push('Canonical Social Content and calendar version binding differs.')
  if (cohort.status !== 'approved' || cohort.included.length < MIN_COHORT || cohort.included.some((seed) => !seedValid(seed))) blockers.push('Approved Shorts comparable or exact baseline identities are invalid.')
  if (!input.is_active || !input.credentials?.access_token) blockers.push('YouTube connection is inactive or incomplete.')
  if (!new Set(input.credentials?.scope?.split(/\s+/)).has(YOUTUBE_READONLY_SCOPE)) blockers.push('Stored YouTube connection lacks youtube.readonly.')
  if (blockers.length) return blocked(blockers)
  const credentials = input.credentials!
  const obtained = Date.parse(credentials.token_obtained_at ?? '')
  if (!Number.isFinite(obtained) || typeof credentials.expires_in !== 'number' || !Number.isFinite(credentials.expires_in) || credentials.expires_in <= 0) return blocked(['Stored access-token expiry is unknown.'])
  let accessToken = credentials.access_token!
  const fetchImpl = input.fetchImpl ?? fetch
  if (obtained + credentials.expires_in * 1000 <= now.getTime() + 60_000) {
    const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET
    if (!credentials.refresh_token || !clientId || !clientSecret) return blocked(['In-memory token refresh is unavailable.'])
    try {
      const response = await fetchImpl(TOKEN_URL, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token, client_id: clientId, client_secret: clientSecret }) })
      if (!response.ok) return blocked(['In-memory token refresh failed.'])
      const refreshed = obj(await response.json())
      if (!str(refreshed?.access_token) || (refreshed?.scope && !new Set(String(refreshed.scope).split(/\s+/)).has(YOUTUBE_READONLY_SCOPE))) return blocked(['In-memory token refresh failed.'])
      accessToken = String(refreshed?.access_token)
    } catch { return blocked(['In-memory token refresh failed.']) }
  }
  const headers = () => ({ Authorization: `Bearer ${accessToken}` })
  const videoCache = new Map<string, VideoRead>()
  const records: RecordEvidence[] = []
  const decisions: ComparableDecision[] = []
  const baselineReceipts: YouTubeEvidenceResult['baseline_receipts'] = []
  const providerResponses: ProviderResponse[] = []
  const candidateObservations: CandidateObservation[] = []
  const qualificationBlockers = [
    'Approved exact-version YouTube external-creator public-metrics source-class freshness policy and expiry rule are missing; no expires_at can be assigned.',
    'Comparable privacy and rights clearance for the new response version is not bound to an approved receipt.',
  ]
  async function videoRead(id: string, expectedChannel: string): Promise<VideoRead> {
    const key = `${expectedChannel}:${id}`
    const cached = videoCache.get(key)
    if (cached) return cached
    const params = new URLSearchParams({ part: 'snippet,contentDetails,statistics,status', id })
    const response = await fetchImpl(`${VIDEO_URL}?${params}`, { method: 'GET', headers: headers(), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const { parsed, bodySha256 } = await readProviderBody(response)
    providerResponses.push({ kind: 'video', object_id: id, http_status: response.status, body_sha256: bodySha256 })
    if (!response.ok && response.status !== 404) throw new Error('YouTube video lookup failed or quota/access was denied.')
    if (response.status === 404) {
      const missing: VideoRead = { video: null, exclusion: { video_id: id, reason: 'Approved video identity is unavailable.', response_sha256: rawResponseSha256(parsed) }, evidence: null, bodySha256 }
      videoCache.set(key, missing)
      return missing
    }
    const responseSha256 = rawResponseSha256(parsed)
    const items = obj(parsed)?.items
    const video = Array.isArray(items) && items.length === 1 ? obj(items[0]) : null
    const snippet = obj(video?.snippet), stats = obj(video?.statistics), status = obj(video?.status)
    const duration = durationSeconds(obj(video?.contentDetails)?.duration)
    const views = count(stats?.viewCount)
    const publishedAt = str(snippet?.publishedAt)
    const evidence: CandidateObservation['raw_response_evidence'] = {
      video_id: safeVideoId(video?.id), channel_id: safeChannelId(snippet?.channelId),
      published_at: safePublishedAt(snippet?.publishedAt), duration: safeDuration(obj(video?.contentDetails)?.duration),
      privacy_status: safePrivacy(status?.privacyStatus),
    }
    let reason: string | null = null
    if (video?.id !== id) reason = 'Approved video identity is unavailable or changed.'
    else if (snippet?.channelId !== expectedChannel) reason = 'Video channel differs from the approved seed channel.'
    else if (status?.privacyStatus !== 'public') reason = 'Video is no longer public.'
    else if (duration === null || duration < 15 || duration > 60) reason = 'Video no longer meets the approved 15–60 second Shorts band.'
    else if (!publishedAt || utcInstant(publishedAt) === null) reason = 'Video publication time is unavailable.'
    else if (Date.parse(publishedAt) > now.getTime()) reason = 'Video publication time is in the future.'
    else if (views === null) reason = 'Required public views are unavailable.'
    const found: VideoRead = reason
      ? { video: null, exclusion: { video_id: id, reason, response_sha256: responseSha256 }, evidence, bodySha256 }
      : { video: { id, channelId: expectedChannel, publishedAt: publishedAt!, duration: duration!, views: views!, likes: count(stats?.likeCount), comments: count(stats?.commentCount), responseSha256, bodySha256 }, exclusion: null, evidence, bodySha256 }
    videoCache.set(key, found)
    return found
  }
  try {
    for (const seed of cohort.included) {
      const candidate = await videoRead(seed.video_id, seed.channel_id)
      const observed = candidate.evidence ?? { video_id: null, channel_id: null, published_at: null, duration: null, privacy_status: null }
      const parsedDuration = durationSeconds(observed.duration)
      const shortsBand = parsedDuration === null ? 'unavailable' : parsedDuration >= 15 && parsedDuration <= 60 ? 'duration_band_match' : 'outside_duration_band'
      const fields: CandidateObservation['field_decisions'] = {
        video_id: compare(observed.video_id, seed.video_id), channel_id: compare(observed.channel_id, seed.channel_id),
        published_at: comparePublication(observed.published_at, seed.published_at), duration: compare(parsedDuration, seed.duration_seconds),
        public_status: compare(observed.privacy_status, 'public'),
        shorts_duration_band: shortsBand === 'unavailable' ? 'unavailable' : shortsBand === 'duration_band_match' ? 'match' : 'mismatch',
      }
      const exclusionFields = (Object.keys(fields) as Array<keyof typeof fields>).filter((field) => fields[field] !== 'match')
      candidateObservations.push({ approved_video_id: seed.video_id, approved_published_at: seed.published_at, response_body_sha256: candidate.bodySha256,
        raw_response_evidence: observed, parsed_duration_seconds: parsedDuration,
        shorts_format_determination: shortsBand, field_decisions: fields,
        inclusion: 'excluded', exclusion_fields: exclusionFields })
      let reason = candidate.exclusion?.reason ?? null
      if (!reason && fields.published_at !== 'match') reason = 'Comparable publication timestamp differs from the approved seed.'
      if (!reason && fields.duration !== 'match') reason = 'Comparable duration differs from the approved seed.'
      const channelParams = new URLSearchParams({ part: 'statistics', id: seed.channel_id })
      const channelResponse = await fetchImpl(`${CHANNEL_URL}?${channelParams}`, { method: 'GET', headers: headers(), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
      const channelBody = await readProviderBody(channelResponse)
      providerResponses.push({ kind: 'channel', object_id: seed.channel_id, http_status: channelResponse.status, body_sha256: channelBody.bodySha256 })
      if (!channelResponse.ok && channelResponse.status !== 404) throw new Error('YouTube channel lookup failed or quota/access was denied.')
      const channels = obj(channelBody.parsed)?.items
      const channel = Array.isArray(channels) && channels.length === 1 ? obj(channels[0]) : null
      const stats = obj(channel?.statistics)
      const subscribers = count(stats?.subscriberCount)
      if (!reason && channel?.id !== seed.channel_id) reason = 'Channel identity differs from the approved seed channel.'
      if (!reason && (subscribers === null || subscribers === 0 || stats?.hiddenSubscriberCount === true)) reason = 'Public subscriber baseline is hidden or unavailable.'
      const baselineIncluded: VideoSnapshot[] = []
      const baselineExcluded: Exclusion[] = []
      for (const id of seed.channel_baseline.video_ids) {
        const read = await videoRead(id, seed.channel_id)
        if (read.video) baselineIncluded.push(read.video)
        else baselineExcluded.push(read.exclusion!)
      }
      const baselineMedian = median(baselineIncluded.map((item) => item.views))
      const baselineBody = { seed_video_ids: [...seed.channel_baseline.video_ids], included_video_ids: baselineIncluded.map((item) => item.id), excluded: baselineExcluded, median_views: baselineMedian, video_response_hashes: baselineIncluded.map((item) => ({ video_id: item.id, sha256: item.responseSha256 })) }
      const baseline: Baseline = { seed_video_ids: baselineBody.seed_video_ids, included_video_ids: baselineBody.included_video_ids, excluded: baselineExcluded, median_views: baselineMedian, receipt_sha256: rawResponseSha256(baselineBody) }
      baselineReceipts.push({ comparable_video_id: seed.video_id, channel_id: seed.channel_id, baseline })
      if (!reason && baselineIncluded.length < MIN_BASELINE) reason = `Only ${baselineIncluded.length} of ${MIN_BASELINE} required approved same-channel Shorts baseline videos remain qualified.`
      if (!reason && (!baselineMedian || baselineMedian <= 0)) reason = 'Current same-channel Shorts median views are unavailable or zero.'
      const audienceBand = subscribers && subscribers > 0 ? band(subscribers) : null
      if (reason || !candidate.video || !audienceBand || !subscribers || !baselineMedian) {
        decisions.push({ video_id: seed.video_id, channel_id: seed.channel_id, status: 'excluded', reason: reason ?? 'Attributable comparable is incomplete.', audience_band: audienceBand })
        continue
      }
      const elapsedDays = (now.getTime() - Date.parse(candidate.video.publishedAt)) / 86_400_000
      const ageDays = Number(Math.max(1, elapsedDays).toFixed(2))
      if (elapsedDays < 1) {
        decisions.push({ video_id: seed.video_id, channel_id: seed.channel_id, status: 'excluded', reason: 'Comparable was observed less than 24 hours after publication.', audience_band: audienceBand })
        continue
      }
      if (elapsedDays > cohort.target.recency_window_days) {
        decisions.push({ video_id: seed.video_id, channel_id: seed.channel_id, status: 'excluded', reason: `Comparable exceeds the approved ${cohort.target.recency_window_days}-day publication window.`, audience_band: audienceBand })
        continue
      }
      records.push({ role: 'approved_comparable', video_id: seed.video_id, channel_id: seed.channel_id, format: 'shorts', canonical_url: seed.youtube_url, published_at: candidate.video.publishedAt, observed_at: now.toISOString(), duration_seconds: candidate.video.duration, views: candidate.video.views, likes: candidate.video.likes, comments: candidate.video.comments, public_subscribers: subscribers, audience_band: audienceBand, approved_inclusion_reason: seed.inclusion_reason, baseline, channel_relative_ratio: round4(candidate.video.views / baselineMedian), audience_view_ratio: round4(candidate.video.views / subscribers), recency_adjusted_views_per_day: round4(candidate.video.views / ageDays), age_days: ageDays, raw_response_sha256: rawResponseSha256({ video_response_sha256: candidate.video.responseSha256, channel_response_sha256: rawResponseSha256(channelBody.parsed), baseline_receipt_sha256: baseline.receipt_sha256 }), video_response_sha256: candidate.video.responseSha256, channel_response_sha256: rawResponseSha256(channelBody.parsed), video_body_sha256: candidate.video.bodySha256, channel_body_sha256: channelBody.bodySha256 })
    }
    const counts = BAND_ORDER.map((value) => ({ band: value, count: records.filter((record) => record.audience_band === value).length }))
    const selected = counts.sort((a, b) => b.count - a.count || BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band))[0]
    const selectedBand = selected?.count >= MIN_COHORT ? selected.band : null
    for (const record of records) decisions.push({ video_id: record.video_id, channel_id: record.channel_id, status: record.audience_band === selectedBand ? 'included' : 'excluded', reason: record.audience_band === selectedBand ? 'Current exact baseline, public audience, and approved Shorts identity qualify in the selected band.' : `Audience band ${record.audience_band} differs from the selected ${selectedBand ?? 'at-least-five'} band.`, audience_band: record.audience_band })
    decisions.sort((a, b) => cohort.included.findIndex((seed) => seed.video_id === a.video_id) - cohort.included.findIndex((seed) => seed.video_id === b.video_id))
    for (const observation of candidateObservations) observation.inclusion = decisions.find((decision) => decision.video_id === observation.approved_video_id)?.status ?? 'excluded'
    if (!selectedBand) return result(input, ['Fewer than five attributable comparables share one current audience band.'], qualificationBlockers, records, decisions, null, baselineReceipts, providerResponses, candidateObservations)
    return result(input, [], qualificationBlockers, records, decisions, selectedBand, baselineReceipts, providerResponses, candidateObservations)
  } catch (error) {
    return result(input, [error instanceof Error && error.message.startsWith('YouTube ') ? error.message : 'YouTube read-only acquisition failed.'], qualificationBlockers, records, decisions, null, baselineReceipts, providerResponses, candidateObservations)
  } finally { accessToken = '' }
}
