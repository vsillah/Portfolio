import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const observedAt = process.env.OBSERVED_AT || new Date().toISOString()
const observedAtMs = Date.parse(observedAt)
const minimumSampleSize = 6
const minimumChannelBaselineSize = 4

const cohorts = [
  {
    slug: 'dark-castle-chess-youtube-thumbnail-cohort-2026-10-18',
    publicSlug: 'dark-castle-youtube-thumbnail-cohort',
    cohortId: 'cohort:youtube:chess-decision-learning:20261018:v1',
    topicIdentity: 'chess_decision_learning_from_mistakes',
    candidates: [
      ['ohSRdSZFnSQ', 'Same-topic chess-mistake explainer with current public metadata.'],
      ['XRNpz7fra9k', 'Same-topic decision-rule lesson with current public metadata.'],
      ['E97FVCRGCxU', 'Same-topic move-evaluation explainer with current public metadata.'],
      ['bstZmyzBZ0g', 'Same-topic beginner-mistake explainer with current public metadata.'],
      ['TGo2-JcjtOk', 'Same-topic mistake-prevention lesson with current public metadata.'],
      ['8xrELvz0dCI', 'Recent same-topic first-person chess-improvement lesson.'],
      ['KbjRYez_me0', 'Same-topic staged chess-learning explainer with current public metadata.'],
      ['Reza8udb47Y', 'Same-topic chess-tip explainer with current public metadata.'],
    ],
    candidatePair: {
      title: 'I Rebuilt the Chess Lesson Around the Decision',
      thumbnail_hook: 'REMEMBER THE WHY',
      relationship: 'complementary_teaser',
      exact_strings_are_distinct: true,
      strategy_status: 'review_only_unscored',
      support_scope: 'editorial_hypothesis_only',
      performance_claim: 'unscored',
      rationale: 'The title explains the rebuild. The thumbnail keeps one short learning tension. Public examples support the editorial pattern only; they do not establish causal performance.',
      source_example_video_ids: ['8xrELvz0dCI', 'XRNpz7fra9k'],
    },
    annotations: {
      KbjRYez_me0: [['Opening', 'Middlegame', 'Endgame'], 'complementary_teaser', 'stage_map'],
      Reza8udb47Y: [['Develop Quickly', 'No Queen Too Early', 'Avoid Double Pawns', 'Castle Before Move 10'], 'complementary_teaser', 'categorized_tip_map'],
      '8xrELvz0dCI': [['HABITS KEEPING YOU STUCK'], 'complementary_teaser', 'consequence_tension'],
      E97FVCRGCxU: [['Brilliant', 'Blunder', 'Book', 'Forced', 'Miss', 'Mistake', 'Good', 'Excellent', 'Best', 'Great'], 'near_duplicate', 'move_rating_labels'],
      XRNpz7fra9k: [['SIMPLE TRICK'], 'complementary_teaser', 'short_solution_hook'],
      ohSRdSZFnSQ: [['One-mover', 'Tunnel vision', 'Playing too fast', 'hope chess', 'overconfidence', 'overthinking'], 'complementary_teaser', 'mistake_consequence_map'],
      bstZmyzBZ0g: [['Pushing Pawns', 'Early Queen', 'Unsafe King', 'Missing threats', 'Playing Too Fast', 'No plan'], 'near_duplicate', 'mistake_label_map'],
      'TGo2-JcjtOk': [['BLUNDERS', 'BRILLIANT'], 'complementary_teaser', 'decision_contrast'],
    },
    recurringVisualTraits: ['one immediate chess idea', 'high-contrast short hook or simple category labels', 'board or chess-piece context'],
    adoptedTraits: ['one dominant product or lesson idea', 'short high-contrast tension hook', 'clear 16:9 hierarchy'],
    rejectedTraits: ['dense icon grids', 'multi-panel report layouts', 'copied creator faces or source branding', 'claims that the public style caused performance'],
  },
  {
    slug: 'ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18',
    publicSlug: 'ai-audit-youtube-thumbnail-cohort',
    cohortId: 'cohort:youtube:ai-cost-audit-roi:20261018:v1',
    topicIdentity: 'ai_tool_cost_audit_workflow_roi',
    candidates: [
      ['axNuaPmBjLg', 'Same-topic AI workflow ROI measurement example.'],
      ['qf31-dcBeE4', 'Same-topic AI cost and audit ROI example.'],
      ['wIcw0T9NhZM', 'Adjacent AI workflow economics example with current public metadata.'],
      ['mHwmgffGgQQ', 'Same-topic AI workflow ROI example with current public metadata.'],
      ['1LdvOwADmaM', 'Same-topic small-business AI ROI audit example.'],
      ['w8dvgEOh3tc', 'Exact-topic hidden AI cost and ROI example.'],
      ['fSAazWLuDyQ', 'Same-topic AI audit product example with current public metadata.'],
      ['ZJ11yOsNIiA', 'Exact-topic hidden cost of multiple AI tools example.'],
      ['oGaSfa3lJ8o', 'Same-topic AI audit workflow example with current public metadata.'],
    ],
    candidatePair: {
      title: 'The AI Cost That Never Appears on the Invoice',
      thumbnail_hook: 'WHO OWNS THE CLEANUP?',
      relationship: 'contrasting_question',
      exact_strings_are_distinct: true,
      strategy_status: 'review_only_unscored',
      support_scope: 'editorial_hypothesis_only',
      performance_claim: 'unscored',
      rationale: 'The title names the hidden cost. The thumbnail asks who absorbs the operational burden. Public examples support the editorial tension only; they do not establish causal performance.',
      source_example_video_ids: ['oGaSfa3lJ8o', 'axNuaPmBjLg'],
    },
    annotations: {
      fSAazWLuDyQ: [['I BUILT AN AI AUDIT THAT REPLACES A $50,000 CONSULTANT'], 'near_duplicate', 'audit_value_claim'],
      oGaSfa3lJ8o: [['WEEKS', 'MINUTES', 'Audit Automated'], 'complementary_teaser', 'time_reduction_contrast'],
      axNuaPmBjLg: [['WORTH IT?', 'AI ROI TEST'], 'complementary_teaser', 'roi_question'],
      wIcw0T9NhZM: [['FULL AI WORKFLOWS PRICING GUIDE'], 'near_duplicate', 'pricing_guide_label'],
      'qf31-dcBeE4': [['WHAT AI REALLY COSTS', "AN AUDIT PARTNER'S HONEST ROI"], 'near_duplicate', 'cost_roi_label'],
      w8dvgEOh3tc: [['HIDDEN COSTS', 'TIME SAVED', 'ROI?'], 'near_duplicate', 'cost_roi_labels'],
    },
    recurringVisualTraits: ['one dominant ROI or audit question', 'short high-contrast hook', 'single person or single product idea'],
    adoptedTraits: ['one dominant calculator result', 'short ownership question', 'clear 16:9 hierarchy'],
    rejectedTraits: ['generic synthetic business people', 'neon robot or circuit-board filler', 'dashboard grids and proof-chip rows', 'copied creator faces or source branding'],
  },
]

function firstWords(value, limit = 20) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return { text: null, truncated: false }
  const words = normalized.split(' ')
  return { text: words.slice(0, limit).join(' '), truncated: words.length > limit }
}

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
  const suffix = match[2]?.toUpperCase()
  const multiplier = suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1
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

function compact(value, limit) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`
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
  const description = firstWords(details?.shortDescription)
  return {
    video_id: videoId,
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    title: details?.title || '',
    creator: details?.author || '',
    channel_id: details?.channelId || '',
    view_count: Number(details?.viewCount),
    subscriber_count: parseCount(owner?.subscriberCountText?.simpleText),
    published_at: microformat?.publishDate ? new Date(microformat.publishDate).toISOString() : null,
    duration_seconds: Number(details?.lengthSeconds),
    source_thumbnail_url: details?.thumbnail?.thumbnails?.at(-1)?.url || null,
    description_opening: description.text,
    description_opening_truncated: description.truncated,
  }
}

async function recentVideoIds(channelId) {
  const html = await fetchHtml(`https://www.youtube.com/channel/${channelId}/videos`)
  const initial = extractObject(html, 'var ytInitialData =')
  return [...new Set(findValues(initial, 'videoId').map(String).filter(Boolean))].slice(0, 18)
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

for (const cohort of cohorts) {
  const outputRoot = path.resolve('artifacts/research', cohort.slug)
  const publicRoot = path.resolve('public/review-assets/social-content', cohort.publicSlug)
  await mkdir(outputRoot, { recursive: true })
  await mkdir(publicRoot, { recursive: true })

  const discoveryPath = path.join(outputRoot, 'cohort-discovery.json')
  const reuseDiscovery = process.env.REUSE_DISCOVERY === '1'
  let included = []
  let excluded = []
  const discovered = reuseDiscovery
    ? []
    : await mapWithConcurrency(cohort.candidates, 4, async ([videoId, reason]) => ({ ...(await fetchVideo(videoId)), decision_reason: reason }))

  if (reuseDiscovery) {
    const captured = JSON.parse(await readFile(discoveryPath, 'utf8'))
    included = captured.included.filter((sample) => Number.isFinite(sample.channel_relative_ratio) && sample.channel_relative_ratio > 0)
    const invalidBaselines = captured.included.filter((sample) => !Number.isFinite(sample.channel_relative_ratio) || sample.channel_relative_ratio <= 0)
    excluded = [
      ...captured.excluded,
      ...invalidBaselines.map((sample) => ({ ...sample, decision: 'excluded', exclusion_reason: 'The same-channel median was zero, so channel-relative normalization is not reproducible.' })),
    ]
  }

  for (const sample of discovered) {
    const exclusionReasons = []
    if (!sample.title || !sample.creator || !sample.channel_id) exclusionReasons.push('Missing attributable title, creator, or channel identity.')
    if (!sample.subscriber_count) exclusionReasons.push('Public subscriber count is unavailable, so audience normalization cannot be reproduced.')
    if (!sample.published_at || !sample.source_thumbnail_url || !Number.isFinite(sample.view_count)) exclusionReasons.push('Publication, thumbnail, or exact view evidence is unavailable.')
    if (sample.duration_seconds < 180) exclusionReasons.push('The video is shorter than the 3-minute long-form comparison floor.')
    if (exclusionReasons.length) {
      excluded.push({ ...sample, decision: 'excluded', exclusion_reason: exclusionReasons.join(' ') })
      continue
    }

    const baselineIds = await recentVideoIds(sample.channel_id)
    const baseline = (await mapWithConcurrency(baselineIds, 4, fetchVideo))
      .filter((entry) => entry.duration_seconds >= 180 && Number.isFinite(entry.view_count) && entry.view_count >= 0)
      .slice(0, 10)
    const baselineMedian = median(baseline.map((entry) => entry.view_count))
    if (baseline.length < minimumChannelBaselineSize || !baselineMedian) {
      const reason = baseline.length < minimumChannelBaselineSize
        ? `Only ${baseline.length} attributable recent long-form videos were available; ${minimumChannelBaselineSize} are required.`
        : 'The same-channel median was zero, so channel-relative normalization is not reproducible.'
      excluded.push({ ...sample, decision: 'excluded', exclusion_reason: reason })
      continue
    }

    sample.channel_baseline = {
      sample_size: baseline.length,
      video_ids: baseline.map((entry) => entry.video_id),
      exact_view_counts: baseline.map((entry) => entry.view_count),
      median_view_count: baselineMedian,
    }
    sample.age_days = Number(Math.max(1, (observedAtMs - Date.parse(sample.published_at)) / 86_400_000).toFixed(2))
    sample.channel_relative_ratio = Number((sample.view_count / sample.channel_baseline.median_view_count).toFixed(4))
    sample.audience_view_ratio = Number((sample.view_count / sample.subscriber_count).toFixed(4))
    sample.recency_adjusted_views_per_day = Number((sample.view_count / sample.age_days).toFixed(4))

    const thumbnailResponse = await fetch(sample.source_thumbnail_url, { headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!thumbnailResponse.ok) {
      excluded.push({ ...sample, decision: 'excluded', exclusion_reason: `Thumbnail capture failed with ${thumbnailResponse.status}.` })
      continue
    }
    const thumbnailBytes = Buffer.from(await thumbnailResponse.arrayBuffer())
    sample.source_thumbnail_sha256 = `sha256:${createHash('sha256').update(thumbnailBytes).digest('hex')}`
    sample.thumbnail_path = `/review-assets/social-content/${cohort.publicSlug}/${sample.video_id}.jpg`
    await sharp(thumbnailBytes).resize({ width: 640, height: 360, fit: 'cover' }).jpeg({ quality: 90 }).toFile(path.join(publicRoot, `${sample.video_id}.jpg`))
    included.push(sample)
  }

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
    sample.outlier_qualified = sample.normalized_performance_score >= 75
    sample.observed_at = observedAt
    sample.decision = 'included'
    sample.link_status = 'verified_openable'
    sample.channel_baseline_size = sample.channel_baseline.sample_size
    const annotation = cohort.annotations[sample.video_id]
    if (!annotation) throw new Error(`Thumbnail annotation is missing for ${sample.video_id}.`)
    const [thumbnailText, relationship, hookType] = annotation
    sample.thumbnail_text = thumbnailText
    sample.thumbnail_text_transcription_status = relationship === 'unreadable' ? 'unreadable' : 'verified'
    sample.title_thumbnail_relationship = relationship
    sample.thumbnail_text_length = thumbnailText.join(' ').length
    sample.hook_type = hookType
    sample.transcription_provenance = relationship === 'unreadable' ? null : {
      source_thumbnail_url: sample.source_thumbnail_url,
      captured_thumbnail_path: sample.thumbnail_path,
      captured_thumbnail_sha256: sample.source_thumbnail_sha256,
      method: 'human transcription from the captured public source image; unreadable text is not inferred',
    }
    sample.supports_candidate_composition = false
    sample.composition_support_reason = 'Public thumbnail is comparison context only. First-party evidence controls subject, product proof, and brand treatment.'
    sample.visual_traits = {
      dominant_subject: true,
      short_hook: thumbnailText.length > 0 && thumbnailText.join(' ').length <= 54,
      high_contrast_text: thumbnailText.length > 0,
      minimal_secondary_copy: thumbnailText.length <= 3,
    }
  }

  const repeatedRelationships = new Set(['duplicate', 'near_duplicate'])
  const distinctRelationships = new Set(['complementary_teaser', 'contrasting_question'])
  const repeated = included.filter((sample) => repeatedRelationships.has(sample.title_thumbnail_relationship))
  const distinct = included.filter((sample) => distinctRelationships.has(sample.title_thumbnail_relationship))
  const minimumPairGroupSize = 3
  const repeatedMedian = median(repeated.map((sample) => sample.normalized_performance_score))
  const distinctMedian = median(distinct.map((sample) => sample.normalized_performance_score))
  const copyPairReady = repeated.length >= minimumPairGroupSize && distinct.length >= minimumPairGroupSize
  const copyPairAnalysis = {
    status: copyPairReady ? 'scored' : 'unscored',
    hypothesis: 'Distinct complementary thumbnail hooks outperform duplicated or near-duplicated title wording for topic-matched YouTube long-form videos.',
    comparison_formula: 'median normalized performance score for complementary_teaser + contrasting_question minus median normalized performance score for duplicate + near_duplicate',
    repeated_group: { relationships: [...repeatedRelationships], sample_size: repeated.length, minimum_sample_size: minimumPairGroupSize, median_normalized_performance_score: repeatedMedian, video_ids: repeated.map((sample) => sample.video_id) },
    distinct_group: { relationships: [...distinctRelationships], sample_size: distinct.length, minimum_sample_size: minimumPairGroupSize, median_normalized_performance_score: distinctMedian, video_ids: distinct.map((sample) => sample.video_id) },
    observed_difference: repeatedMedian == null || distinctMedian == null ? null : Number((distinctMedian - repeatedMedian).toFixed(2)),
    conclusion: copyPairReady ? (distinctMedian > repeatedMedian ? 'supports_distinct_pair' : 'does_not_support_distinct_pair') : 'unscored_insufficient_group_samples',
    limitation: copyPairReady ? 'Observed association only; this cohort does not establish causation.' : `Unscored: both relationship groups require at least ${minimumPairGroupSize} attributable samples.`,
  }

  const packet = {
    version: 'youtube-thumbnail-long-form-cohort/v1',
    cohort_id: cohort.cohortId,
    status: included.length >= minimumSampleSize ? 'approved' : 'blocked_insufficient_qualified_sources',
    target: {
      channel: 'youtube',
      format: 'long_form',
      aspect_ratio: '16:9',
      output_dimensions: { width: 1280, height: 720 },
      topic_identity: cohort.topicIdentity,
      qualifying_duration_seconds: { minimum: 180 },
      minimum_sample_size: minimumSampleSize,
      minimum_channel_baseline_size: minimumChannelBaselineSize,
      audience_normalization: 'view_count / public subscriber_count',
      channel_normalization: 'view_count / median exact view count for up to 10 recent long-form videos on the same channel',
    },
    observed_at: observedAt,
    fresh_until: new Date(observedAtMs + (14 * 86_400_000)).toISOString(),
    formula: {
      channel_relative_ratio: 'source exact views / same-channel recent long-form median exact views',
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
    outlier_qualification: {
      rule: 'normalized_performance_score >= 75',
      threshold: 75,
      qualified_sample_size: included.filter((sample) => sample.outlier_qualified).length,
      qualified_video_ids: included.filter((sample) => sample.outlier_qualified).map((sample) => sample.video_id),
      role: 'Performance context only. Public visual composition is not first-party brand authority.',
    },
    copy_pair_analysis: copyPairAnalysis,
    candidate_copy_pair: cohort.candidatePair,
    included: included.sort((left, right) => right.normalized_performance_score - left.normalized_performance_score),
    excluded,
    recurring_visual_traits: cohort.recurringVisualTraits,
    adopted_traits: cohort.adoptedTraits,
    rejected_traits: cohort.rejectedTraits,
    composition_decision: 'Use public examples only to bound the editorial pattern. Build the candidate from one first-party product idea, the exact distinct hook, AmaduTown treatment, and a 1280×720 16:9 canvas.',
    public_outlier_boundary: 'Public thumbnails supply topic, copy-pair, recency, and normalized-performance context only. They do not authorize source likenesses, layouts, brand colors, or causal performance claims.',
    annotation_boundary: 'Thumbnail text was transcribed from captured pixels. Unreadable text remains unreadable.',
  }
  await writeFile(path.join(outputRoot, 'cohort.json'), `${JSON.stringify(packet, null, 2)}\n`)

  const cards = await Promise.all(packet.included.map(async (sample, index) => {
    const image = await sharp(path.join(publicRoot, `${sample.video_id}.jpg`)).resize({ width: 320, height: 180, fit: 'cover' }).toBuffer()
    const label = Buffer.from(`<svg width="320" height="108"><rect width="320" height="108" fill="#07182b"/><text x="12" y="22" fill="#f8c515" font-size="13" font-family="Arial" font-weight="700">${index + 1}. ${escapeXml(compact(sample.creator, 34))}</text><text x="12" y="47" fill="#ffffff" font-size="12" font-family="Arial">${escapeXml(compact(sample.title, 44))}</text><text x="12" y="72" fill="#cbd5e1" font-size="11" font-family="Arial">${sample.view_count.toLocaleString()} views · ${sample.subscriber_count.toLocaleString()} subs</text><text x="12" y="94" fill="#cbd5e1" font-size="11" font-family="Arial">score ${sample.normalized_performance_score} · channel ${sample.channel_relative_ratio}×</text></svg>`)
    return sharp({ create: { width: 320, height: 288, channels: 4, background: '#07182b' } }).composite([{ input: image, left: 0, top: 0 }, { input: label, left: 0, top: 180 }]).png().toBuffer()
  }))
  const columns = 3
  const rows = Math.ceil(cards.length / columns)
  await sharp({ create: { width: 1000, height: Math.max(328, (rows * 308) + 20), channels: 4, background: '#020d1c' } })
    .composite(cards.map((input, index) => ({ input, left: 20 + ((index % columns) * 326), top: 20 + (Math.floor(index / columns) * 308) })))
    .png()
    .toFile(path.join(outputRoot, 'cohort-contact-sheet.png'))

  console.log(JSON.stringify({ cohort_id: cohort.cohortId, qualified: included.length, excluded: excluded.length, output: path.join(outputRoot, 'cohort.json') }))
}
