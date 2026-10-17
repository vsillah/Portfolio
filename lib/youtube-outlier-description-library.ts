export const YOUTUBE_DESCRIPTION_LIBRARY_VERSION = 'youtube-outlier-description-library-v1' as const

export type YouTubeDescriptionLibraryStatus = 'ready' | 'unscored'

type DescriptionPattern = {
  opening_style: 'question' | 'command' | 'claim'
  length_band: 'short' | 'medium' | 'long'
  paragraph_count: number
  proof_style: 'product_evidence' | 'data_or_case' | 'explanation_only'
  cta_style: 'question' | 'subscribe' | 'comment' | 'resource_link' | 'none'
  link_placement: 'early' | 'late' | 'none'
  uses_chapters: boolean
  hashtag_count: number
}

export type YouTubeDescriptionLibrarySource = {
  source_id: string
  source_url: string
  source_title: string
  creator: string | null
  outlier_score: number
  published_at: string
  retrieved_at: string
  audience_size: number | null
  topic_matches: string[]
  topic_match_score: number
  description_fingerprint: string
  pattern: DescriptionPattern
}

export type YouTubeDescriptionLibraryExclusion = {
  source_id: string
  source_url: string | null
  source_title: string
  reason: string
}

export type YouTubeDescriptionLibraryReceipt = {
  version: typeof YOUTUBE_DESCRIPTION_LIBRARY_VERSION
  status: YouTubeDescriptionLibraryStatus
  generated_at: string
  target_topics: string[]
  minimum_source_count: number
  minimum_outlier_score: number
  freshness_days: number
  library_entry_count: number
  sources: YouTubeDescriptionLibrarySource[]
  excluded_sources: YouTubeDescriptionLibraryExclusion[]
  recommended_structure: {
    opening_style: DescriptionPattern['opening_style'] | null
    length_band: DescriptionPattern['length_band'] | null
    proof_style: DescriptionPattern['proof_style'] | null
    cta_style: DescriptionPattern['cta_style'] | null
    link_placement: DescriptionPattern['link_placement'] | null
    uses_chapters: boolean | null
    blueprint: string[]
  }
  blockers: string[]
  originality_boundary: string
  input_fingerprint: string
}

const TOPIC_STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'because', 'before', 'being', 'between',
  'content', 'could', 'from', 'have', 'into', 'more', 'most', 'other', 'practical',
  'product', 'should', 'system', 'team', 'that', 'their', 'there', 'these', 'they',
  'this', 'those', 'through', 'trust', 'using', 'video', 'what', 'when', 'where',
  'which', 'while', 'with', 'work', 'would', 'your', 'youtube',
])

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim()] : [])
    : []
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'feature' || key === 'si') url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return value
  }
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>
    return `{${Object.keys(data).sort().map((key) => `${JSON.stringify(key)}:${stableValue(data[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fingerprint(value: unknown) {
  const source = stableValue(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function topicTokens(...values: unknown[]): string[] {
  const tokens: string[] = []
  for (const value of values) {
    if (Array.isArray(value)) {
      tokens.push(...topicTokens(...value))
      continue
    }
    tokens.push(...text(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !TOPIC_STOP_WORDS.has(token)))
  }
  return [...new Set(tokens)]
}

function audienceBand(size: number) {
  if (size < 10_000) return 'micro'
  if (size < 100_000) return 'emerging'
  if (size < 1_000_000) return 'established'
  return 'large'
}

function descriptionPattern(description: string): DescriptionPattern {
  const paragraphs = description.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const words = description.split(/\s+/).filter(Boolean)
  const firstLine = description.split(/\n/).map((line) => line.trim()).find(Boolean) ?? ''
  const lastParagraph = paragraphs.at(-1) ?? ''
  const urls = [...description.matchAll(/https?:\/\/\S+/gi)].map((match) => match.index ?? 0)
  const firstUrl = urls[0] ?? -1
  const openingStyle: DescriptionPattern['opening_style'] = firstLine.endsWith('?')
    ? 'question'
    : /^(?:build|calculate|compare|discover|download|learn|look|make|see|start|stop|try|watch)\b/i.test(firstLine)
      ? 'command'
      : 'claim'
  const ctaStyle: DescriptionPattern['cta_style'] = /subscribe|follow the channel/i.test(lastParagraph)
    ? 'subscribe'
    : /comment|tell me|share your/i.test(lastParagraph)
      ? 'comment'
      : lastParagraph.endsWith('?')
        ? 'question'
        : /https?:\/\//i.test(lastParagraph)
          ? 'resource_link'
          : 'none'

  return {
    opening_style: openingStyle,
    length_band: words.length < 80 ? 'short' : words.length < 220 ? 'medium' : 'long',
    paragraph_count: paragraphs.length,
    proof_style: /screenshot|screen recording|walkthrough|demo|product|calculator|dashboard/i.test(description)
      ? 'product_evidence'
      : /data|study|research|case study|result|measured/i.test(description)
        ? 'data_or_case'
        : 'explanation_only',
    cta_style: ctaStyle,
    link_placement: firstUrl < 0 ? 'none' : firstUrl < description.length / 2 ? 'early' : 'late',
    uses_chapters: /^\s*\d{1,2}:\d{2}\s+/m.test(description),
    hashtag_count: (description.match(/#[A-Za-z0-9_]+/g) ?? []).length,
  }
}

function mode<T extends string>(values: T[]): T | null {
  if (!values.length) return null
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0]
}

function descriptionBlueprint(pattern: YouTubeDescriptionLibraryReceipt['recommended_structure']) {
  const steps = [
    pattern.opening_style === 'question'
      ? 'Open with one audience-facing question tied to the topic.'
      : pattern.opening_style === 'command'
        ? 'Open with a direct action or promise tied to the topic.'
        : 'Open with a concrete claim tied to the topic.',
    pattern.proof_style === 'product_evidence'
      ? 'Connect the claim to an inspectable first-party product example or screenshot.'
      : pattern.proof_style === 'data_or_case'
        ? 'Support the claim with attributable data or a bounded case example.'
        : 'Explain the practical lesson in plain language.',
    'State what the viewer will learn and why it matters now.',
  ]
  if (pattern.uses_chapters) steps.push('Add chapters only when the final video timing is known.')
  if (pattern.link_placement !== 'none') steps.push(`Place the primary approved resource link ${pattern.link_placement} in the description.`)
  steps.push(pattern.cta_style === 'subscribe'
    ? 'Close with a natural channel subscription invitation.'
    : pattern.cta_style === 'comment'
      ? 'Close with a specific comment invitation.'
      : pattern.cta_style === 'question'
        ? 'Close with one specific audience question.'
        : pattern.cta_style === 'resource_link'
          ? 'Close with one approved resource link and its purpose.'
          : 'Close with one concrete next action.')
  return steps
}

function packetTopics(packet: Record<string, unknown>) {
  const metadata = record(packet.actor_metadata)
  const pattern = record(packet.pattern_packet)
  return topicTokens(
    stringArray(packet.topics),
    stringArray(metadata.topics),
    stringArray(metadata.topic_ids),
    stringArray(metadata.entity_identities),
    stringArray(pattern.topics),
    stringArray(pattern.topic_ids),
    packet.title,
    pattern.promise_value,
    pattern.hook_structure,
  )
}

export function buildYouTubeOutlierDescriptionLibrary(input: {
  researchPackets: unknown[]
  targetTopics: string[]
  generatedAt: string
  targetAudienceSize?: number | null
  minimumSourceCount?: number
  minimumOutlierScore?: number
  freshnessDays?: number
  maximumSources?: number
}): YouTubeDescriptionLibraryReceipt {
  const minimumSourceCount = Math.max(2, input.minimumSourceCount ?? 3)
  const minimumOutlierScore = Math.max(0, Math.min(100, input.minimumOutlierScore ?? 65))
  const freshnessDays = Math.max(1, input.freshnessDays ?? 180)
  const maximumSources = Math.max(minimumSourceCount, input.maximumSources ?? 5)
  const generatedAt = Date.parse(input.generatedAt)
  const targetTopics = topicTokens(input.targetTopics)
  const targetAudienceBand = typeof input.targetAudienceSize === 'number' && input.targetAudienceSize >= 0
    ? audienceBand(input.targetAudienceSize)
    : null
  const sources = new Map<string, YouTubeDescriptionLibrarySource>()
  const excludedSources: YouTubeDescriptionLibraryExclusion[] = []

  if (Number.isFinite(generatedAt) && targetTopics.length) {
    for (const rawPacket of input.researchPackets) {
      const packet = record(rawPacket)
      const platform = text(packet.platform)
      const status = text(packet.pattern_status)
      const sourceUrl = canonicalUrl(text(packet.source_url))
      const description = text(packet.caption) || text(record(packet.pattern_packet).description)
      const metrics = record(packet.metrics)
      const outlierScore = number(packet.outlier_score) ?? number(record(packet.actor_metadata).score_breakdown && record(record(packet.actor_metadata).score_breakdown).outlier_score)
      const publishedAt = text(metrics.published_at) || text(packet.published_at)
      const retrievedAt = text(packet.retrieved_at)
      const evidenceTime = Date.parse(publishedAt || retrievedAt)
      const audienceSize = number(metrics.follower_count) ?? number(metrics.subscriber_count)
      const topics = packetTopics(packet)
      const matches = targetTopics.filter((topic) => topics.includes(topic))
      const reason = (platform !== 'youtube' && platform !== 'youtube_shorts')
        ? null
        : status !== 'usable_framework'
          ? 'Pattern has not been approved as a usable framework.'
          : !validHttpUrl(sourceUrl)
            ? 'Source URL is missing or is not attributable.'
            : !description
              ? 'No customer-facing YouTube description was captured.'
              : outlierScore === null
                ? 'Outlier score is missing.'
                : outlierScore < minimumOutlierScore
                  ? `Outlier score ${outlierScore} is below the ${minimumOutlierScore} threshold.`
                  : !Number.isFinite(evidenceTime)
                    ? 'Publication or retrieval date is missing.'
                    : generatedAt - evidenceTime < 0
                      ? 'Evidence date is later than the evaluation time.'
                      : generatedAt - evidenceTime > freshnessDays * 86_400_000
                        ? `Evidence is older than the ${freshnessDays}-day freshness window.`
                        : !matches.length
                          ? 'No stable topic identity matches the current comparison.'
                          : targetAudienceBand && (audienceSize === null || audienceBand(audienceSize) !== targetAudienceBand)
                            ? `Audience size is missing or outside the ${targetAudienceBand} comparison band.`
                            : null

      if (reason) {
        excludedSources.push({
          source_id: text(packet.id) || fingerprint(sourceUrl || text(packet.title)),
          source_url: validHttpUrl(sourceUrl) ? sourceUrl : null,
          source_title: text(packet.title) || 'Untitled YouTube source',
          reason,
        })
        continue
      }
      if (platform !== 'youtube' && platform !== 'youtube_shorts') continue
      if (outlierScore === null) continue

      const matchScore = Number(((matches.length / targetTopics.length) * 0.65 + (outlierScore / 100) * 0.35).toFixed(4))
      const source: YouTubeDescriptionLibrarySource = {
        source_id: text(packet.id) || fingerprint(sourceUrl),
        source_url: sourceUrl,
        source_title: text(packet.title) || 'Untitled YouTube source',
        creator: text(packet.creator_name) || text(packet.creator_handle) || null,
        outlier_score: outlierScore,
        published_at: publishedAt || retrievedAt,
        retrieved_at: retrievedAt || publishedAt,
        audience_size: audienceSize,
        topic_matches: matches,
        topic_match_score: matchScore,
        description_fingerprint: fingerprint(description),
        pattern: descriptionPattern(description),
      }
      const existing = sources.get(sourceUrl)
      if (!existing || source.topic_match_score > existing.topic_match_score) sources.set(sourceUrl, source)
    }
  }

  const ranked = [...sources.values()]
    .sort((left, right) => right.topic_match_score - left.topic_match_score || right.outlier_score - left.outlier_score || left.source_url.localeCompare(right.source_url))
    .slice(0, maximumSources)
  const status: YouTubeDescriptionLibraryStatus = ranked.length >= minimumSourceCount ? 'ready' : 'unscored'
  const recommendedStructure: YouTubeDescriptionLibraryReceipt['recommended_structure'] = {
    opening_style: status === 'ready' ? mode(ranked.map((source) => source.pattern.opening_style)) : null,
    length_band: status === 'ready' ? mode(ranked.map((source) => source.pattern.length_band)) : null,
    proof_style: status === 'ready' ? mode(ranked.map((source) => source.pattern.proof_style)) : null,
    cta_style: status === 'ready' ? mode(ranked.map((source) => source.pattern.cta_style)) : null,
    link_placement: status === 'ready' ? mode(ranked.map((source) => source.pattern.link_placement)) : null,
    uses_chapters: status === 'ready' ? ranked.filter((source) => source.pattern.uses_chapters).length > ranked.length / 2 : null,
    blueprint: [],
  }
  recommendedStructure.blueprint = status === 'ready' ? descriptionBlueprint(recommendedStructure) : []
  const blockers = [
    ...(targetTopics.length ? [] : ['No stable target topics were available for description matching.']),
    ...(Number.isFinite(generatedAt) ? [] : ['The description-library evaluation time is invalid.']),
    ...(ranked.length >= minimumSourceCount ? [] : [`Only ${ranked.length} fresh, attributable same-topic outlier description(s) qualified; ${minimumSourceCount} are required.`]),
  ]
  const result = {
    version: YOUTUBE_DESCRIPTION_LIBRARY_VERSION,
    status,
    generated_at: input.generatedAt,
    target_topics: targetTopics,
    minimum_source_count: minimumSourceCount,
    minimum_outlier_score: minimumOutlierScore,
    freshness_days: freshnessDays,
    library_entry_count: ranked.length,
    sources: ranked,
    excluded_sources: excludedSources.sort((left, right) => left.source_title.localeCompare(right.source_title)),
    recommended_structure: recommendedStructure,
    blockers,
    originality_boundary: 'Reuse aggregate description structure only. Do not copy source wording, title language, creator identity, links, claims, or calls to action.',
  }
  return { ...result, input_fingerprint: fingerprint(result) }
}
