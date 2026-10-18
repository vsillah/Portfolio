import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const observedAt = process.env.OBSERVED_AT || new Date().toISOString()
const minimumSampleSize = 6
const cohortId = 'cohort:youtube_shorts:ai-governance-decision:20261018:v1'
const outputRoot = path.resolve('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18')
const publicRoot = path.resolve('public/review-assets/social-content/jev-thumbnail-cohort')

const candidates = [
  { id: 'gTHQpAkgjy4', decision: 'include', reason: 'AI-governance decision tension; 54-second Short with attributable channel and metrics.' },
  { id: '_ODSVV3SIEI', decision: 'include', reason: 'AI-governance framework explainer; 39-second Short with attributable channel and metrics.' },
  { id: 'sA6UA2fMNHg', decision: 'include', reason: 'AI-governance importance explainer; 45-second Short with attributable channel and metrics.' },
  { id: 'SQEMkQu0b6o', decision: 'include', reason: 'AI-governance consequence framing; 21-second Short close to the Jev runtime.' },
  { id: 'ZAdGsLGaGSU', decision: 'include', reason: 'Presenter-led AI-governance choice framing; 51-second Short with attributable metrics.' },
  { id: 'DVEOS9t_DHM', decision: 'include', reason: 'Concrete governance-risk hook; 32-second Short with attributable metrics.' },
  { id: 'ojpZ-TJv918', decision: 'include', reason: 'Direct AI-governance promise; 29-second Short with attributable metrics.' },
  { id: 'usE8BPWET3M', decision: 'include', reason: 'Short-form AI-governance hook; 18-second Short close to the Jev runtime.' },
  { id: 'Wcf3Caq4AiE', decision: 'exclude', reason: '107 seconds exceeds the primary 15–60 second comparison band.' },
  { id: '_ls2rOTyGtU', decision: 'exclude', reason: '63 seconds exceeds the primary 15–60 second comparison band.' },
  { id: 'LWs4FNziL4Y', decision: 'exclude', reason: '64 seconds exceeds the primary 15–60 second comparison band.' },
  { id: '5xpD26tHkao', decision: 'exclude', reason: '10 seconds is below the primary 15–60 second comparison band.' },
  { id: '0wXsV5azxT8', decision: 'exclude', reason: 'Public subscriber count was unavailable, so audience normalization could not be reproduced.' },
  { id: 'WuQTCnhdrqE', decision: 'exclude', reason: 'Observed less than 24 hours after publication; distribution was too immature for comparison.' },
]

function extractObject(source, marker) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null
  const start = source.indexOf('{', markerIndex)
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}' && --depth === 0) return JSON.parse(source.slice(start, index + 1))
  }
  return null
}

function findValues(value, key, found = []) {
  if (!value || typeof value !== 'object') return found
  if (Object.hasOwn(value, key)) found.push(value[key])
  for (const child of Object.values(value)) findValues(child, key, found)
  return found
}

function parseCount(value) {
  const normalized = String(value || '').replace(/ subscribers?$/i, '').replaceAll(',', '').trim()
  const match = normalized.match(/^([\d.]+)([KMB])?$/i)
  if (!match) return null
  const multiplier = match[2]?.toUpperCase() === 'K' ? 1_000 : match[2]?.toUpperCase() === 'M' ? 1_000_000 : match[2]?.toUpperCase() === 'B' ? 1_000_000_000 : 1
  return Math.round(Number(match[1]) * multiplier)
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  if (!sorted.length) return null
  const midpoint = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2
}

function percentile(value, values) {
  const lower = values.filter((candidate) => candidate < value).length
  const equal = values.filter((candidate) => candidate === value).length
  return Number((((lower + (equal * 0.5)) / values.length) * 100).toFixed(2))
}

function compactText(value, limit = 54) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; AmaduTownEvidenceReview/1.0)' } })
  if (!response.ok) throw new Error(`Public fetch failed (${response.status}) for ${url}`)
  return response.text()
}

async function fetchVideo(videoId) {
  const html = await fetchHtml(`https://www.youtube.com/watch?v=${videoId}`)
  const player = extractObject(html, 'ytInitialPlayerResponse =')
  const initial = extractObject(html, 'var ytInitialData =')
  const details = player?.videoDetails
  const microformat = player?.microformat?.playerMicroformatRenderer
  const owner = findValues(initial, 'videoOwnerRenderer')[0]
  const thumbnail = details?.thumbnail?.thumbnails?.at(-1)?.url
  return {
    video_id: videoId,
    youtube_url: `https://www.youtube.com/shorts/${videoId}`,
    watch_url: `https://www.youtube.com/watch?v=${videoId}`,
    title: details?.title || '',
    creator: details?.author || '',
    channel_id: details?.channelId || '',
    view_count: Number(details?.viewCount),
    subscriber_count: parseCount(owner?.subscriberCountText?.simpleText),
    published_at: microformat?.publishDate ? new Date(microformat.publishDate).toISOString() : null,
    duration_seconds: Number(details?.lengthSeconds),
    source_thumbnail_url: thumbnail || null,
  }
}

async function recentShortIds(channelId) {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/shorts`)
  const initial = extractObject(html, 'var ytInitialData =')
  return [...new Set(findValues(initial, 'shortsLockupViewModel')
    .map((entry) => String(entry?.entityId || '').replace('shorts-shelf-item-', ''))
    .filter(Boolean))].slice(0, 12)
}

async function mapWithConcurrency(values, limit, mapper) {
  const output = new Array(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      output[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return output
}

await mkdir(outputRoot, { recursive: true })
await mkdir(publicRoot, { recursive: true })

const observedAtMs = Date.parse(observedAt)
const snapshots = await mapWithConcurrency(candidates, 5, async (candidate) => ({ ...candidate, ...(await fetchVideo(candidate.id)) }))
const included = snapshots.filter((candidate) => candidate.decision === 'include')

for (const sample of included) {
  const baselineIds = await recentShortIds(sample.channel_id)
  const baseline = (await mapWithConcurrency(baselineIds, 5, fetchVideo))
    .filter((entry) => entry.duration_seconds >= 15 && entry.duration_seconds <= 60 && entry.view_count >= 0)
    .slice(0, 10)
  if (baseline.length < 5) throw new Error(`${sample.creator} has only ${baseline.length} attributable recent Shorts in the normalized duration band.`)
  sample.channel_baseline = {
    sample_size: baseline.length,
    video_ids: baseline.map((entry) => entry.video_id),
    exact_view_counts: baseline.map((entry) => entry.view_count),
    median_view_count: median(baseline.map((entry) => entry.view_count)),
  }
  sample.age_days = Number(Math.max(1, (observedAtMs - Date.parse(sample.published_at)) / 86_400_000).toFixed(2))
  sample.channel_relative_ratio = Number((sample.view_count / sample.channel_baseline.median_view_count).toFixed(4))
  sample.audience_view_ratio = Number((sample.view_count / sample.subscriber_count).toFixed(4))
  sample.recency_adjusted_views_per_day = Number((sample.view_count / sample.age_days).toFixed(4))
  const thumbnailResponse = await fetch(sample.source_thumbnail_url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!thumbnailResponse.ok) throw new Error(`Thumbnail fetch failed (${thumbnailResponse.status}) for ${sample.video_id}`)
  const thumbnailBytes = Buffer.from(await thumbnailResponse.arrayBuffer())
  sample.source_thumbnail_sha256 = `sha256:${createHash('sha256').update(thumbnailBytes).digest('hex')}`
  sample.thumbnail_path = `/review-assets/social-content/jev-thumbnail-cohort/${sample.video_id}.jpg`
  await sharp(thumbnailBytes).resize({ width: 540, height: 960, fit: 'cover' }).jpeg({ quality: 90 }).toFile(path.join(publicRoot, `${sample.video_id}.jpg`))
}

if (included.length < minimumSampleSize) throw new Error(`Cohort has ${included.length} qualified samples; ${minimumSampleSize} are required.`)
if (included.some((sample) => !sample.subscriber_count || !sample.source_thumbnail_url || !sample.published_at)) throw new Error('A qualifying sample is missing public audience, thumbnail, or publication evidence.')

const channelRelativeValues = included.map((sample) => sample.channel_relative_ratio)
const audienceRatioValues = included.map((sample) => sample.audience_view_ratio)
const recencyRateValues = included.map((sample) => sample.recency_adjusted_views_per_day)
for (const sample of included) {
  sample.performance_components = {
    channel_relative_percentile: percentile(sample.channel_relative_ratio, channelRelativeValues),
    audience_view_percentile: percentile(sample.audience_view_ratio, audienceRatioValues),
    recency_rate_percentile: percentile(sample.recency_adjusted_views_per_day, recencyRateValues),
  }
  sample.normalized_performance_score = Number((
    (sample.performance_components.channel_relative_percentile * 0.5)
    + (sample.performance_components.audience_view_percentile * 0.3)
    + (sample.performance_components.recency_rate_percentile * 0.2)
  ).toFixed(2))
  sample.inclusion_reason = sample.reason
  sample.observed_at = observedAt
}

const exclusions = snapshots.filter((candidate) => candidate.decision === 'exclude').map((candidate) => ({
  video_id: candidate.video_id,
  youtube_url: candidate.youtube_url,
  title: candidate.title,
  creator: candidate.creator,
  duration_seconds: candidate.duration_seconds,
  view_count: candidate.view_count,
  subscriber_count: candidate.subscriber_count,
  published_at: candidate.published_at,
  source_thumbnail_url: candidate.source_thumbnail_url,
  observed_at: observedAt,
  exclusion_reason: candidate.reason,
}))

const packet = {
  version: 'youtube-thumbnail-cohort/v1',
  cohort_id: cohortId,
  status: 'approved',
  target: {
    channel: 'youtube',
    format: 'shorts',
    artifact_duration_seconds: 22,
    qualifying_duration_seconds: { minimum: 15, maximum: 60 },
    topic_identity: 'ai_governance_human_decision_ownership',
    recency_window_days: 730,
    minimum_sample_size: minimumSampleSize,
    audience_normalization: 'view_count / public subscriber_count',
    channel_normalization: 'view_count / median exact view count for up to 10 recent 15–60 second Shorts on the same channel',
  },
  observed_at: observedAt,
  observed_from: included.map((sample) => sample.published_at).sort()[0],
  observed_to: observedAt,
  fresh_until: new Date(observedAtMs + (14 * 86_400_000)).toISOString(),
  formula: {
    channel_relative_ratio: 'source exact views / same-channel recent-Short median exact views',
    audience_view_ratio: 'source exact views / public channel subscriber count',
    recency_adjusted_views_per_day: 'source exact views / max(age in days at observation, 1)',
    normalized_performance_score: '(channel-relative percentile × 0.50) + (audience-view percentile × 0.30) + (recency-rate percentile × 0.20)',
  },
  selection_gate: {
    ready: included.length >= minimumSampleSize,
    qualified_sample_size: included.length,
    minimum_sample_size: minimumSampleSize,
    decision: included.length >= minimumSampleSize ? 'qualifying_cohort_ready' : 'fail_closed',
  },
  included: included.sort((left, right) => right.normalized_performance_score - left.normalized_performance_score),
  excluded: exclusions,
  long_form_reference_policy: 'Long-form videos may inform non-scoring composition notes only. They are excluded from the Shorts performance calculation.',
  recurring_visual_traits: [],
  adopted_traits: [],
  rejected_traits: [],
  composition_decision: '',
}

await writeFile(path.join(outputRoot, 'cohort.json'), `${JSON.stringify(packet, null, 2)}\n`)

const cards = await Promise.all(packet.included.map(async (sample, index) => {
  const image = await sharp(path.join(publicRoot, `${sample.video_id}.jpg`)).resize({ width: 270, height: 480, fit: 'cover' }).toBuffer()
  const label = Buffer.from(`<svg width="270" height="110"><rect width="270" height="110" fill="#07182b"/><text x="12" y="25" fill="#f8c515" font-size="14" font-family="Arial" font-weight="700">${index + 1}. ${escapeXml(compactText(sample.creator, 28))}</text><text x="12" y="50" fill="#ffffff" font-size="13" font-family="Arial">${escapeXml(compactText(sample.title, 34))}</text><text x="12" y="76" fill="#cbd5e1" font-size="12" font-family="Arial">${sample.view_count.toLocaleString()} views · ${sample.subscriber_count.toLocaleString()} subs</text><text x="12" y="97" fill="#cbd5e1" font-size="12" font-family="Arial">score ${sample.normalized_performance_score} · channel ${sample.channel_relative_ratio}×</text></svg>`)
  return sharp({ create: { width: 270, height: 590, channels: 4, background: '#07182b' } }).composite([{ input: image, top: 0, left: 0 }, { input: label, top: 480, left: 0 }]).png().toBuffer()
}))
const contactSheet = sharp({ create: { width: 1140, height: 1240, channels: 4, background: '#020d1c' } })
await contactSheet.composite(cards.map((input, index) => ({ input, left: 30 + ((index % 4) * 280), top: 30 + (Math.floor(index / 4) * 605) }))).png().toFile(path.join(outputRoot, 'cohort-contact-sheet.png'))

console.log(JSON.stringify({ cohort_id: cohortId, sample_size: included.length, output: path.join(outputRoot, 'cohort.json'), contact_sheet: path.join(outputRoot, 'cohort-contact-sheet.png') }, null, 2))
