import { createHash } from 'crypto'
import { sanitizeApprovedSourceSummary } from '@/lib/social-topic-source-receipts'
import { stableTopicIdentity } from '@/lib/social-trend-work-join'

// Discovery starts only at these publisher-controlled indexes. Article URLs
// discovered in RSS still pass the strict host/path and detail-page checks.
export const OFFICIAL_LIVE_SIGNAL_INDEXES = [
  { url: 'https://developers.openai.com/api/docs/changelog', publisher: 'OpenAI', format: 'openai_changelog' },
  { url: 'https://about.fb.com/feed/', publisher: 'Meta', format: 'meta_newsroom_rss' },
  { url: 'https://engineering.fb.com/feed/', publisher: 'Meta', format: 'meta_engineering_rss' },
] as const

type Index = (typeof OFFICIAL_LIVE_SIGNAL_INDEXES)[number]
export type OfficialSignalDiscovery = {
  source_url: string
  index_url: string
  publisher: 'OpenAI' | 'Meta'
  kind: 'agents_api' | 'muse_agent' | 'forum_agentic_engineering'
  title: string
  published_at: string
  coverage_identity: string
  topic_identities: string[]
  entity_identities: string[]
  capability_labels: string[]
  proof_terms: string[]
}
export type OfficialSignalPacket = {
  source_url: string
  platform: 'other'
  creator_name: string
  title: string
  status: 'review_ready'
  pattern_status: 'needs_brand_translation'
  pattern_packet: Record<string, unknown>
  actor_metadata: Record<string, unknown>
  privacy_notes: string
  retrieved_at: string
}

function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function decode(value: string) {
  return value.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#0*39;|&#8217;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
}
function pageText(html: string) {
  return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
}
function xmlTag(item: string, name: string) {
  return decode(item.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '')
}
function dateOnly(value: string) { return new Date(value).toISOString().slice(0, 10) }
function fresh(publishedAt: string, observedAt: string) {
  const published = Date.parse(publishedAt)
  const observed = Date.parse(observedAt)
  return Number.isFinite(published) && Number.isFinite(observed)
    && observed >= published && observed - published <= 30 * 86400000
}
function sourceKind(url: string): OfficialSignalDiscovery['kind'] | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null
    if (parsed.hostname === 'developers.openai.com' && parsed.pathname === '/api/docs/changelog') return 'agents_api'
    if (parsed.hostname === 'about.fb.com' && /^\/news\/20\d{2}\/\d{2}\/[a-z0-9-]+\/$/.test(parsed.pathname)) return 'muse_agent'
    if (parsed.hostname === 'engineering.fb.com' && /^\/20\d{2}\/\d{2}\/\d{2}\/ml-applications\/[a-z0-9-]+\/$/.test(parsed.pathname)) return 'forum_agentic_engineering'
  } catch { /* malformed URLs fail closed */ }
  return null
}

export function discoverOfficialLiveSignals(input: { indexUrl: string; body: string; observedAt: string }) {
  const index = OFFICIAL_LIVE_SIGNAL_INDEXES.find((item) => item.url === input.indexUrl)
  if (!index) throw new Error('official_signal_index_not_allowlisted')
  if (input.body.length < 100 || input.body.length > 5_000_000) throw new Error('official_signal_index_malformed')
  const discovered: OfficialSignalDiscovery[] = []
  const excluded: Array<{ source_url: string; reason: string }> = []
  if (index.format === 'openai_changelog') {
    const monthSections = input.body.split(/<div class="mb-12"><h3[^>]*>/)
    for (const monthSection of monthSections.slice(1, 5)) {
      const month = pageText(monthSection.slice(0, 150)).match(/([A-Z][a-z]+), (20\d{2})/)
      if (!month) continue
      const entries = monthSection.split(/<div class="mt-5"><div class="grid[^>]*>/).slice(1, 30)
      for (const entry of entries) {
        const label = pageText(entry.slice(0, 450)).match(/\b([A-Z][a-z]{2}) (\d{1,2})\b/)
        if (!label || !/v1\/agents/.test(entry)) continue
        const publishedAt = new Date(`${month[1]} ${label[2]}, ${month[2]} 00:00:00 GMT`).toISOString()
        const text = pageText(entry)
        const capabilities = [
          ['Artifact SDK', /artifact sdk|document skills/i],
          ['Ultrafast mode', /ultrafast mode/i],
          ['computer use', /computer use/i],
          ['subagents', /subagents?|multi.agent/i],
          ['agent memory', /agent memory|active memory/i],
          ['approval controls', /approval|permission/i],
        ].filter(([, pattern]) => (pattern as RegExp).test(text)).map(([name]) => name as string)
        if (capabilities.length === 0) {
          excluded.push({ source_url: index.url, reason: 'agents_api_entry_without_qualifying_capability' })
          continue
        }
        if (!fresh(publishedAt, input.observedAt)) {
          excluded.push({ source_url: index.url, reason: 'official_signal_stale' })
          continue
        }
        const identity = stableTopicIdentity(`openai_agents_api_${dateOnly(publishedAt)}_${capabilities.join('_')}`)
        discovered.push({ source_url: index.url, index_url: index.url, publisher: 'OpenAI', kind: 'agents_api',
          title: `Agents API update: ${capabilities.join(' and ')}`, published_at: publishedAt,
          coverage_identity: identity, topic_identities: ['agentic_operating_systems',
            ...(capabilities.includes('subagents') ? ['multi_agent_orchestration'] : []),
            ...(capabilities.includes('agent memory') ? ['agent_memory'] : [])],
          entity_identities: ['openai', 'agents_api'], capability_labels: capabilities,
          proof_terms: ['v1/agents', ...capabilities],
        })
      }
    }
  } else {
    const items = input.body.match(/<item>[\s\S]*?<\/item>/gi)?.slice(0, 25) ?? []
    if (items.length === 0) throw new Error('official_signal_feed_malformed')
    for (const item of items) {
      const title = xmlTag(item, 'title')
      const url = xmlTag(item, 'link')
      const published = xmlTag(item, 'pubDate')
      const description = pageText(xmlTag(item, 'description'))
      const kind = sourceKind(url)
      if (kind !== (index.format === 'meta_newsroom_rss' ? 'muse_agent' : 'forum_agentic_engineering')) {
        excluded.push({ source_url: url, reason: 'source_path_not_allowlisted' }); continue
      }
      const relevant = kind === 'muse_agent'
        ? /\bmuse\b/i.test(title) && /agent|model/i.test(title + ' ' + description)
        : /\bforum\b/i.test(title) && /ai.native|agentic|agent/i.test(title + ' ' + description)
      if (!relevant) { excluded.push({ source_url: url, reason: 'nonqualifying_topic' }); continue }
      if (!Number.isFinite(Date.parse(published)) || !fresh(published, input.observedAt)) {
        excluded.push({ source_url: url, reason: 'official_signal_stale_or_invalid_date' }); continue
      }
      const parsed = new URL(url)
      const pathDate = kind === 'muse_agent' ? parsed.pathname.match(/^\/news\/(20\d{2})\/(\d{2})\//)
        : parsed.pathname.match(/^\/(20\d{2})\/(\d{2})\/(\d{2})\//)
      if (!pathDate || pathDate[1] !== dateOnly(published).slice(0, 4) || pathDate[2] !== dateOnly(published).slice(5, 7)) {
        excluded.push({ source_url: url, reason: 'publication_path_mismatch' }); continue
      }
      const slug = parsed.pathname.split('/').filter(Boolean).at(-1) ?? ''
      const labels = kind === 'muse_agent' ? ['Muse agent model'] : ['Forum AI-native engineering']
      discovered.push({ source_url: url, index_url: index.url, publisher: 'Meta', kind, title,
        published_at: new Date(published).toISOString(),
        coverage_identity: stableTopicIdentity(`meta_${kind}_${dateOnly(published)}_${slug}`),
        topic_identities: ['agentic_operating_systems', kind === 'muse_agent' ? 'agent_memory' : 'multi_agent_orchestration'],
        entity_identities: ['meta', kind === 'muse_agent' ? 'muse' : 'forum'],
        capability_labels: labels, proof_terms: kind === 'muse_agent' ? ['Muse', 'agent'] : ['Forum', 'agent'],
      })
    }
  }
  return { discovered: [...new Map(discovered.map((entry) => [entry.coverage_identity, entry])).values()], excluded }
}

export function officialSignalPacketFromPage(input: { discovery: OfficialSignalDiscovery; html: string; observedAt: string }): OfficialSignalPacket {
  const entry = input.discovery
  if (sourceKind(entry.source_url) !== entry.kind || !fresh(entry.published_at, input.observedAt)) throw new Error('official_signal_source_invalid_or_stale')
  if (input.html.length < 100 || input.html.length > 3_000_000) throw new Error('official_signal_detail_malformed')
  const visible = pageText(input.html)
  if (entry.proof_terms.some((term) => !visible.toLowerCase().includes(term.toLowerCase()))) throw new Error('official_signal_detail_unattributable')
  if (entry.kind === 'agents_api') {
    const current = discoverOfficialLiveSignals({ indexUrl: entry.index_url, body: input.html, observedAt: input.observedAt })
    if (!current.discovered.some((candidate) => candidate.coverage_identity === entry.coverage_identity)) {
      throw new Error('official_signal_changelog_entry_changed')
    }
  } else {
    const title = decode(input.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    const date = dateOnly(entry.published_at)
    const monthDate = new Date(entry.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    if (!title.toLowerCase().includes(entry.title.toLowerCase())
      || !(input.html.includes(date) || visible.includes(monthDate))) throw new Error('official_signal_detail_date_or_title_mismatch')
  }
  const expiresAt = new Date(Date.parse(entry.published_at) + 30 * 86400000).toISOString()
  const summary = sanitizeApprovedSourceSummary(`${entry.publisher} published ${entry.title} on ${dateOnly(entry.published_at)}. Review the official release for ${entry.capability_labels.join(' and ')}.`)
  return {
    source_url: entry.source_url, platform: 'other', creator_name: entry.publisher, title: entry.title,
    status: 'review_ready', pattern_status: 'needs_brand_translation',
    pattern_packet: { source_claim_summary: summary, source_fingerprint: hash(entry.source_url + '|' + entry.coverage_identity) },
    actor_metadata: {
      official_signal: { coverage_identity: entry.coverage_identity, publisher: entry.publisher,
        source_url: entry.source_url, index_url: entry.index_url, kind: entry.kind,
        published_at: entry.published_at, observed_at: input.observedAt, expires_at: expiresAt,
        topic_identities: entry.topic_identities, entity_identities: entry.entity_identities,
        sentiment: 'positive', materiality: 'material', evidence_state: 'attributable_single_source',
        evidence_status: 'pending_review', source_fingerprint: hash(entry.source_url + '|' + entry.coverage_identity + '|' + entry.title),
        raw_content_included: false },
      topic_momentum_receipt: {
        approval_status: 'pending', raw_content_included: false, privacy_classification: 'public_safe',
        momentum_kind: 'public_news', approved_summary: summary, product_identity: 'portfolio', product_label: 'Portfolio',
        publisher: entry.publisher, topic_identities: entry.topic_identities, entity_identities: entry.entity_identities,
        coverage_identity: entry.coverage_identity, sentiment: 'positive', context_summary: summary,
        relevance_score: null, public_attention_score: null, materiality: 'material',
        evidence_state: 'attributable_single_source', published_at: entry.published_at,
        observed_at: input.observedAt, expires_at: expiresAt,
      },
    },
    privacy_notes: 'Official public release only. Review attribution, materiality, attention and Portfolio relevance before approval. No practitioner anecdote or raw page content is included.',
    retrieved_at: input.observedAt,
  }
}

export function validOfficialSignalAttribution(packet: { source_url: string; title: string; actor_metadata: Record<string, unknown> }) {
  const official = packet.actor_metadata.official_signal as Record<string, unknown> | undefined
  const receipt = packet.actor_metadata.topic_momentum_receipt as Record<string, unknown> | undefined
  if (!official || !receipt || official.source_url !== packet.source_url || official.raw_content_included !== false
    || official.evidence_status !== 'pending_review' || receipt.approval_status !== 'pending'
    || receipt.product_identity !== 'portfolio' || receipt.raw_content_included !== false) return false
  const kind = sourceKind(packet.source_url)
  const index = OFFICIAL_LIVE_SIGNAL_INDEXES.find((candidate) => candidate.url === official.index_url)
  if (!kind || kind !== official.kind || !index || index.publisher !== official.publisher
    || !fresh(String(official.published_at), String(official.observed_at))
    || !Number.isFinite(Date.parse(String(official.expires_at)))
    || !/^[a-f0-9]{64}$/.test(String(official.source_fingerprint))) return false
  if (kind === 'agents_api' && index.format !== 'openai_changelog') return false
  if (kind === 'muse_agent' && index.format !== 'meta_newsroom_rss') return false
  if (kind === 'forum_agentic_engineering' && index.format !== 'meta_engineering_rss') return false
  const identity = kind === 'agents_api'
    ? stableTopicIdentity(`openai_agents_api_${dateOnly(String(official.published_at))}_${(packet.title.replace(/^Agents API update: /, '').split(' and ')).join('_')}`)
    : stableTopicIdentity(`meta_${kind}_${dateOnly(String(official.published_at))}_${new URL(packet.source_url).pathname.split('/').filter(Boolean).at(-1)}`)
  return official.coverage_identity === identity && receipt.coverage_identity === identity
    && JSON.stringify(official.topic_identities) === JSON.stringify(receipt.topic_identities)
    && JSON.stringify(official.entity_identities) === JSON.stringify(receipt.entity_identities)
}

export async function collectOfficialLiveSignalPackets(input: { observedAt?: string; fetchPage?: typeof fetch } = {}) {
  const observedAt = input.observedAt ?? new Date().toISOString()
  const fetchPage = input.fetchPage ?? fetch
  const packets: OfficialSignalPacket[] = []
  const blockers: string[] = []
  const excluded: Array<{ source_url: string; reason: string }> = []
  const discovered = new Map<string, OfficialSignalDiscovery>()
  const indexBodies = new Map<string, string>()
  async function read(url: string, contentType: string) {
    const response = await fetchPage(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), cache: 'no-store',
      headers: { Accept: contentType } })
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes(contentType)) throw new Error('official_signal_source_blocked')
    return response.text()
  }
  for (const index of OFFICIAL_LIVE_SIGNAL_INDEXES) {
    try {
      const body = await read(index.url, index.format === 'openai_changelog' ? 'text/html' : 'xml')
      indexBodies.set(index.url, body)
      const result = discoverOfficialLiveSignals({ indexUrl: index.url, body, observedAt })
      for (const entry of result.discovered) discovered.set(entry.coverage_identity, entry)
      excluded.push(...result.excluded)
    } catch (error) { blockers.push(`${index.url}:${error instanceof Error ? error.message : 'official_signal_source_blocked'}`) }
  }
  for (const entry of discovered.values()) {
    try {
      const html = entry.source_url === entry.index_url ? indexBodies.get(entry.index_url) ?? '' : await read(entry.source_url, 'text/html')
      packets.push(officialSignalPacketFromPage({ discovery: entry, html, observedAt }))
    } catch (error) { blockers.push(`${entry.coverage_identity}:${error instanceof Error ? error.message : 'official_signal_detail_blocked'}`) }
  }
  return { packets, blockers, excluded: excluded.map((entry) => ({ ...entry, observed_at: observedAt })),
    read_only: true as const, review_only: true as const }
}

export async function persistPendingOfficialSignalPackets(packets: OfficialSignalPacket[]) {
  if (packets.length === 0) return 0
  const { supabaseAdmin } = await import('@/lib/supabase')
  let inserted = 0
  for (const packet of packets) {
    const identity = (packet.actor_metadata.official_signal as { coverage_identity: string }).coverage_identity
    const { data: existing, error: readError } = await supabaseAdmin.from('social_content_research_packets')
      .select('id').contains('actor_metadata', { official_signal: { coverage_identity: identity } }).limit(1)
    if (readError) throw new Error(`official_signal_packet_read_failed:${readError.message}`)
    if (existing?.length) continue
    const { error } = await supabaseAdmin.from('social_content_research_packets').insert(packet)
    if (error) {
      if (error.code === '23505') continue
      throw new Error(`official_signal_packet_insert_failed:${error.message}`)
    }
    inserted += 1
  }
  return inserted
}
