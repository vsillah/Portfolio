import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { deterministicSha256Hex } from '../../lib/deterministic-sha256.mjs'

const observedAt = process.env.OBSERVED_AT || new Date().toISOString()
const observedAtMs = Date.parse(observedAt)
const minimumSampleSize = 6
const minimumChannelBaselineSize = 4
const contentVersion = '2026-10-18T00:00:00.000Z'
const userCuratedAiBusinessPreference = {
  version: 'youtube-thumbnail-user-preference/v1',
  signal_type: 'user_curated_saved_playlist',
  source_url: 'https://www.youtube.com/playlist?list=PLbfxkgOJ1hVc-9Gcleyt0iK7kW9MFpynh',
  captured_at: '2026-10-18T19:00:00.000Z',
  item_identities: [
    '1Rg9N6AC9Cs', '43MdhyYl2hY', 'h9Pk5iNDXMk', 'JSmGZ8vTEFQ', 'fIWUAodAgJw', 'IGgg397XB90', 'C2NZs1fCLfo',
    'O8-UsCW3_1Y', 'GTWWNZyIsSc', 'iXkfIS0dJqQ', 'j7CaMx2c56M', '1L0ghc5ofLo', '-M_026Esvf0', 'lDHrmDAD9y4',
  ].map((video_id) => ({ video_id, source_url: `https://www.youtube.com/watch?v=${video_id}` })),
  extracted_visual_traits: [
    'one dominant human or product anchor',
    'large high-contrast hook readable before the supporting detail',
    'visible proof prop such as a product screen, result, or revenue figure',
  ],
  extracted_copy_traits: [
    'specific how-to, full-course, pricing, or step-by-step promise',
    'plain-language outcome or tension rather than an abstract category label',
    'selective use of concrete numbers, timeframes, and result evidence',
  ],
  applied_traits: [
    'one dominant human or product focal object',
    'one-second comprehension',
    'short large teaser copy',
    'clear title-thumbnail contrast',
    'strong feed-size contrast',
    'one simplified first-party proof object',
  ],
  performance_weight: 0,
  evidence_role: 'taste_calibration_only',
  performance_status: 'unscored',
}

const cohorts = [
  {
    slug: 'jev-youtube-thumbnail-cohort-2026-10-19',
    publicSlug: 'jev-youtube-long-form-thumbnail-cohort',
    cohortId: 'cohort:youtube:ai-governance-human-decision:20261019:v1',
    contentId: '939b01e3-d1af-42c8-805e-0379f09efd60',
    contentVersion: 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2',
    decisionReceiptId: 'decision:thumbnail:jev:20261019:v1',
    outputVersion: 'decision:jev:20261019:v1',
    productProofReceiptId: 'sha256:7e123f1c11a156e86b36e0d2306ad1f42d97d3c63dac335588e804f6bc74f8e9',
    compositionSignature: 'jev-curious-human|decision-boundary-card|short-question|hero-v1',
    selectedComposition: 'expressive-human-decision-boundary',
    preferenceSignals: [userCuratedAiBusinessPreference],
    topicIdentity: 'ai_governance_human_decision_ownership',
    candidates: [
      ['zRMAvMSSSII', 'Same-topic agentic AI governance and human-oversight argument with current public metadata.'],
      ['Q020C-Jw0o8', 'Same-topic AI governance explainer from a channel with an attributable long-form baseline.'],
      ['BIPlhF0sXUc', 'Exact-topic AI-agent risk ownership and accountability discussion.'],
      ['d-22oCIWSBQ', 'Exact-topic human oversight in AI decision-making explainer.'],
      ['AyNe8KZYNGU', 'Same-topic rules-before-results governance explainer.'],
      ['PUnCxppwDSs', 'Exact-topic human-in-the-loop decision-owner explainer.'],
      ['WGDQoaoqR1U', 'Same-topic accountable AI governance explainer with a product-process visual.'],
      ['DI0wC2d5m0w', 'Exact-topic high-stakes human oversight and accountability webinar.'],
      ['mVD72s4hmIw', 'Same-topic AI adoption-to-governance explainer retained to test dense field-guide rejection.'],
    ],
    candidatePair: {
      title: 'AI Scored It. Who Makes the Call?',
      thumbnail_hook: 'WHEN SHOULD AI STOP?',
      relationship: 'contrasting_question',
      exact_strings_are_distinct: true,
      strategy_status: 'review_only_unscored',
      support_scope: 'editorial_hypothesis_only',
      performance_claim: 'unscored',
      rationale: 'The title names the scored event and decision owner. The thumbnail asks where model authority ends. Live examples support presenter-led decision tension and short governance hooks as bounded editorial patterns; they do not establish causal performance.',
      source_example_video_ids: ['zRMAvMSSSII', 'Q020C-Jw0o8'],
    },
    annotations: {
      zRMAvMSSSII: [["Human In The Loop Isn't Enough"], 'near_duplicate', 'human_oversight_limit'],
      'Q020C-Jw0o8': [['Understanding AI Governance: Risks, Definitions and Regulations'], 'complementary_teaser', 'governance_scope'],
      BIPlhF0sXUc: [['WHEN AI AGENTS MAKE DECISIONS: WHO OWNS THE RISKS, CONTROLS & ACCOUNTABILITY?'], 'near_duplicate', 'decision_ownership_question'],
      'd-22oCIWSBQ': [['THE IMPORTANCE OF HUMAN OVERSIGHT IN AI DECISION-MAKING'], 'near_duplicate', 'human_oversight_label'],
      AyNe8KZYNGU: [['RULES BEFORE RESULTS'], 'complementary_teaser', 'rules_before_results'],
      PUnCxppwDSs: [['Who Should Be the Human in the Loop?', 'Choosing the right human for each intervention point'], 'near_duplicate', 'decision_owner_question'],
      WGDQoaoqR1U: [[], 'no_thumbnail_text', 'human_policy_robot_process'],
      DI0wC2d5m0w: [['Human Oversight in AI', 'Designing Accountability for High-Stakes Decisions'], 'near_duplicate', 'high_stakes_accountability'],
      mVD72s4hmIw: [['From AI Adoption to AI Governance'], 'near_duplicate', 'dense_governance_field_guide'],
    },
    recurringVisualTraits: [
      'one expressive human or one concrete decision-boundary object',
      'large high-contrast governance tension readable before supporting detail',
      'a visible relationship between the person and the decision system',
    ],
    adoptedTraits: [
      'one dominant campaign-specific human hero',
      'one-second topic comprehension',
      'short large teaser copy distinct from the title',
      'face-safe text placement with strong contrast',
      'one simplified first-party Jev proof object subordinate to the hero',
    ],
    rejectedTraits: [
      'dashboard or field-guide density',
      'text-first lecture cards',
      'generic robot, circuit-board, or synthetic office imagery',
      'multi-head webinar grids and crude split screens',
      'dark flat treatments with weak expression or no campaign-specific hero',
      'copied source likenesses, layouts, wording, or brand colors',
    ],
  },
  {
    slug: 'dark-castle-chess-youtube-thumbnail-cohort-2026-10-18',
    publicSlug: 'dark-castle-youtube-thumbnail-cohort',
    cohortId: 'cohort:youtube:chess-decision-learning:20261018:v1',
    contentId: 'c12378f2-36de-4bf7-8c5d-0ce754e727eb',
    decisionReceiptId: 'decision:thumbnail:dark-castle:20261018:v5',
    outputVersion: 'decision:dark-castle:20261018:v4',
    productProofReceiptId: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78',
    compositionSignature: 'shared-chess-studio|gesture-arc-to-board|display-hook-depth|cohesive-v6',
    selectedComposition: 'integrated-chess-decision-scene',
    preferenceSignals: [userCuratedAiBusinessPreference],
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
    adoptedTraits: ['one dominant product proof object', 'one-second comprehension', 'short large teaser copy', 'clear title-thumbnail contrast', 'strong feed-size contrast'],
    rejectedTraits: ['dense icon grids', 'multi-panel report layouts', 'copied creator faces or source branding', 'claims that the public style caused performance'],
  },
  {
    slug: 'ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18',
    publicSlug: 'ai-audit-youtube-thumbnail-cohort',
    cohortId: 'cohort:youtube:ai-cost-audit-roi:20261018:v1',
    contentId: '3dad4cca-72b7-4705-8fb6-273bf7500ce6',
    decisionReceiptId: 'decision:thumbnail:ai-audit:20261018:v5',
    outputVersion: 'decision:ai-audit:20261018:v4',
    productProofReceiptId: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97',
    compositionSignature: 'shared-audit-office|gesture-curve-to-score|display-question-depth|cohesive-v6',
    selectedComposition: 'integrated-audit-cleanup-scene',
    preferenceSignals: [userCuratedAiBusinessPreference],
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
    adoptedTraits: ['one dominant human-plus-product focal idea', 'one-second comprehension', 'short large teaser copy', 'clear title-thumbnail contrast', 'strong feed-size contrast', 'one simplified first-party proof object'],
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

for (const cohort of cohorts.filter((candidate) => !process.env.COHORT_SLUG || candidate.slug === process.env.COHORT_SLUG)) {
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

  const comparisons = [
    ...packet.included.map((sample) => ({
      video_id: sample.video_id,
      source_url: sample.youtube_url,
      decision: 'included',
      decision_reason: sample.decision_reason,
      view_count: sample.view_count,
      subscriber_count: sample.subscriber_count,
      published_at: sample.published_at,
      observed_at: sample.observed_at,
      channel_baseline_size: sample.channel_baseline_size,
      normalized_performance_score: sample.normalized_performance_score,
      outlier_qualified: sample.outlier_qualified,
    })),
    ...packet.excluded.map((sample) => ({
      video_id: sample.video_id,
      source_url: sample.youtube_url,
      decision: 'excluded',
      decision_reason: sample.exclusion_reason,
      view_count: Number.isFinite(sample.view_count) ? sample.view_count : null,
      subscriber_count: Number.isFinite(sample.subscriber_count) ? sample.subscriber_count : null,
      published_at: sample.published_at || null,
      observed_at: observedAt,
      channel_baseline_size: sample.channel_baseline?.sample_size ?? null,
      normalized_performance_score: null,
      outlier_qualified: false,
    })),
  ]
  const decisionInput = {
    content_version: cohort.contentVersion ?? contentVersion,
    candidate_identity: {
      content_id: cohort.contentId,
      title: cohort.candidatePair.title,
      thumbnail_hook: cohort.candidatePair.thumbnail_hook,
      product_proof_receipt_id: cohort.productProofReceiptId,
      composition_signature: cohort.compositionSignature,
    },
    live_evidence: {
      cohort_id: packet.cohort_id,
      observed_at: packet.observed_at,
      fresh_until: packet.fresh_until,
      minimum_sample_size: packet.selection_gate.minimum_sample_size,
      normalization_formula: Object.values(packet.formula),
      outlier_threshold: packet.outlier_qualification.threshold,
      comparisons,
    },
    candidate_copy_pair: packet.candidate_copy_pair,
    adopted_traits: packet.adopted_traits,
    rejected_traits: packet.rejected_traits,
    user_preference_signals: cohort.preferenceSignals,
  }
  const decisionReceipt = {
    version: 'youtube-thumbnail-decision-receipt/v1',
    receipt_id: cohort.decisionReceiptId,
    route: 'social-content-outlier-decision/v1',
    content_version: cohort.contentVersion ?? contentVersion,
    input_version: `sha256:${deterministicSha256Hex(JSON.stringify(decisionInput))}`,
    output_version: cohort.outputVersion,
    ...decisionInput,
    selection: {
      status: packet.selection_gate.ready && packet.outlier_qualification.qualified_sample_size > 0 ? 'ready' : 'unscored',
      selected_composition: cohort.selectedComposition,
      title_thumbnail_relationship: cohort.candidatePair.relationship,
      product_proof_binding: cohort.productProofReceiptId,
      rationale: 'Live topic evidence controls qualification and threshold status. The saved playlist contributes taste calibration only, with zero performance weight. First-party product proof controls the selected composition.',
    },
  }
  await writeFile(path.join(outputRoot, 'thumbnail-decision-receipt.json'), `${JSON.stringify(decisionReceipt, null, 2)}\n`)

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
