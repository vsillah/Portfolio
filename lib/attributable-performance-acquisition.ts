import {
  adaptPlatformObservation,
  evaluateAttributablePerformance,
  rawResponseSha256,
  type Baseline,
  type PerformanceObservation,
  type PerformanceReceipt,
  type RawPlatformObservation,
  type SourceClassPolicy,
  ATTRIBUTABLE_PERFORMANCE_VERSION,
} from './attributable-performance-evidence'

/** Pure adapters for retained, read-only responses. No URL is fetched here. */
export type AcquisitionChannel = 'linkedin' | 'youtube' | 'youtube_shorts' | 'x' | 'facebook' | 'instagram'
type Common = Pick<RawPlatformObservation, 'baseline_id' | 'baseline_version' | 'evidence_version' | 'source_policy_version' | 'observation_grade' | 'observation_window' | 'audience' | 'cohort_id' | 'source_class' | 'source_url' | 'provenance' | 'rights' | 'rollback'> & {
  channel: AcquisitionChannel
  format: string
  account_id: string
  account_url: string
  observed_at: string
  collector_version: string
  policy: SourceClassPolicy
  /** Retained response bytes are represented by this parsed, immutable snapshot. */
  raw_response: unknown
}
export type AcquisitionFixture = Common
export type AcquisitionResult = { observation: PerformanceObservation | null; blockers: string[] }

type Extracted = Pick<RawPlatformObservation, 'platform' | 'format' | 'object_id' | 'object_url' | 'published_at' | 'metric'> & { author_id: string }
type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const metric = (name: string, value: unknown, denominatorName: string, denominator: unknown) => {
  const numerator = count(value)
  const base = count(denominator)
  return numerator === null || base === null ? null : { name, value: numerator, denominator_name: denominatorName, denominator: base }
}

function canonicalUrl(channel: AcquisitionChannel, id: string, handle: string): string {
  switch (channel) {
    case 'linkedin': return `https://www.linkedin.com/feed/update/${id}/`
    case 'youtube': return `https://www.youtube.com/watch?v=${id}`
    case 'youtube_shorts': return `https://www.youtube.com/shorts/${id}`
    case 'x': return `https://x.com/${handle}/status/${id}`
    case 'facebook': return `https://www.facebook.com/${handle}/posts/${id}`
    case 'instagram': return `https://www.instagram.com/${handle}/${id}/`
  }
}

function extract(input: AcquisitionFixture): { value: Extracted | null; blockers: string[] } {
  const raw = record(input.raw_response)
  if (!raw) return { value: null, blockers: ['Raw response is not an object.'] }
  let id: string | null = null
  let author: string | null = null
  let published: string | null = null
  let objectUrl: string | null = null
  let format: string | null = null
  let measured: ReturnType<typeof metric> = null
  let platform: Extracted['platform']
  switch (input.channel) {
    case 'linkedin': {
      platform = 'linkedin'
      const analytics = record(raw.analytics)
      id = str(raw.urn); author = str(raw.authorUrn); published = str(raw.publishedAt); objectUrl = str(raw.permalink)
      format = str(raw.mediaType)
      measured = metric('engagements', analytics?.engagements, 'impressions', analytics?.impressions)
      break
    }
    case 'youtube':
    case 'youtube_shorts': {
      platform = 'youtube'
      const snippet = record(raw.snippet)
      const analytics = record(raw.analytics)
      id = str(raw.id); author = str(snippet?.channelId); published = str(snippet?.publishedAt); objectUrl = str(raw.canonicalUrl)
      format = input.channel === 'youtube_shorts' ? 'shorts' : str(raw.videoFormat)
      if (input.channel === 'youtube_shorts' && raw.videoFormat !== 'shorts') format = null
      if (input.channel === 'youtube' && format === 'shorts') format = null
      measured = metric('views', analytics?.views, 'impressions', analytics?.impressions)
      break
    }
    case 'x': {
      platform = 'x'
      const metrics = record(raw.public_metrics)
      id = str(raw.id); author = str(raw.author_id); published = str(raw.created_at); objectUrl = str(raw.url)
      format = str(raw.post_format)
      measured = metric('engagements', metrics?.engagement_count, 'impressions', metrics?.impression_count)
      break
    }
    case 'facebook': {
      platform = 'facebook'
      const insights = record(raw.insights)
      id = str(raw.id); author = str(raw.from_id); published = str(raw.created_time); objectUrl = str(raw.permalink_url)
      format = str(raw.post_format)
      measured = metric('engagements', insights?.engagements, 'impressions', insights?.impressions)
      break
    }
    case 'instagram': {
      platform = 'instagram'
      const insights = record(raw.insights)
      id = str(raw.id); author = str(raw.owner_id); published = str(raw.timestamp); objectUrl = str(raw.permalink)
      format = str(raw.media_format)
      measured = metric('engagements', insights?.engagements, 'impressions', insights?.impressions)
      break
    }
  }
  const blockers: string[] = []
  if (!id || !author || !published || !objectUrl || !format) blockers.push('Platform object, author, publication, URL, or format is missing.')
  if (!measured) blockers.push('Channel-native metric or denominator is missing or invalid.')
  if (author !== input.account_id) blockers.push('Response author differs from the declared account.')
  if (format !== input.format) blockers.push('Response format differs from the declared format.')
  if (id && objectUrl) {
    // Canonical URLs are explicit in the retained response. This adapter never
    // repairs a wrong host, alternate route, tracking query, or object ID.
    const canonical = input.channel === 'instagram'
      ? `https://www.instagram.com/${format === 'reel' ? 'reel' : 'p'}/${id}/`
      : canonicalUrl(input.channel, id, input.channel === 'x' ? String(raw.author_handle ?? '') : input.account_id)
    if (objectUrl !== canonical) blockers.push('Response URL is not the exact canonical channel object.')
  }
  if (blockers.length) return { value: null, blockers }
  return { value: { platform, format: format!, object_id: id!, object_url: objectUrl!, published_at: published!, metric: measured!, author_id: author! }, blockers }
}

export function acquireAttributableObservation(input: AcquisitionFixture): AcquisitionResult {
  const extracted = extract(input)
  if (!extracted.value) return { observation: null, blockers: extracted.blockers }
  const { channel: _channel, raw_response, ...binding } = input
  const { author_id: _authorId, ...platformFields } = extracted.value
  const raw: RawPlatformObservation = {
    ...binding,
    ...platformFields,
    raw_response,
    raw_response_sha256: rawResponseSha256(raw_response),
    scoring_version: ATTRIBUTABLE_PERFORMANCE_VERSION,
  }
  const adapted = adaptPlatformObservation(raw)
  return { observation: adapted.observation, blockers: [...extracted.blockers, ...adapted.blockers] }
}

/** Invalid observations remain explicit Unscored receipts; no persistence occurs. */
export function shadowReplayAcquisition(input: {
  candidate: AcquisitionFixture
  comparables: AcquisitionFixture[]
  baselines: Baseline[]
  evaluated_at: string
}): { receipt: PerformanceReceipt | null; status: 'Scored' | 'Unscored'; blockers: string[]; observations: AcquisitionResult[] } {
  const observations = [input.candidate, ...input.comparables].map(acquireAttributableObservation)
  const blockers = observations.flatMap((result, index) => result.blockers.map((reason) => `${index === 0 ? 'Candidate' : `Comparable ${index}`}: ${reason}`))
  if (!observations[0].observation) return { receipt: null, status: 'Unscored', blockers, observations }
  const receipt = evaluateAttributablePerformance({
    candidate: observations[0].observation,
    comparables: observations.slice(1).flatMap((result) => result.observation ? [result.observation] : []),
    baselines: input.baselines,
    evaluated_at: input.evaluated_at,
  })
  return { receipt, status: blockers.length ? 'Unscored' : receipt.status, blockers: [...blockers, ...receipt.blockers], observations }
}
