import { createHash } from 'crypto'
import { sanitizeApprovedSourceSummary } from '@/lib/social-topic-source-receipts'
import { stableTopicIdentity } from '@/lib/social-trend-work-join'

// Deliberately finite: a new publisher or claim requires a code review.
export const OFFICIAL_LIVE_SIGNAL_SOURCES = [
  {
    key: 'openai-agents-api-2026-10-16', publisher: 'OpenAI',
    url: 'https://developers.openai.com/api/docs/changelog', published_at: '2026-10-16T00:00:00.000Z',
    title: 'Agents API: hosted artifact skills and Ultrafast mode',
    proof: ['Oct 16', 'v1/agents', 'Artifact SDK', 'Ultrafast mode'],
    summary: 'OpenAI reported hosted artifact skills and Ultrafast mode for its Agents API on October 16, 2026.',
    topics: ['agentic_operating_systems', 'multi_agent_orchestration'], entities: ['openai', 'agents_api'],
  },
  {
    key: 'meta-muse-wonder-2026-10-12', publisher: 'Meta',
    url: 'https://about.fb.com/news/2026/10/introducing-muse-wonder-models/', published_at: '2026-10-12T00:00:00.000Z',
    title: 'Introducing Muse Wonder and Muse Wonder Full',
    proof: ['Introducing Muse Wonder', 'October 12, 2026', 'Active Memory', 'Active Focus'],
    summary: 'Meta introduced Muse Wonder with Active Memory and Active Focus for agentic tasks in October 2026.',
    topics: ['agentic_operating_systems', 'agent_memory'], entities: ['meta', 'muse_wonder'],
  },
  {
    key: 'meta-forum-2026-09-29', publisher: 'Meta',
    url: 'https://about.fb.com/news/2026/09/find-community-forum-dedicated-app-facebook-groups/', published_at: '2026-09-29T00:00:00.000Z',
    title: 'Find Your Community With Forum',
    proof: ['Find Your Community With Forum', 'September 29, 2026', 'Ask', 'real experience'],
    summary: 'Meta described Forum Ask as highlighting existing group conversations grounded in real experience.',
    topics: ['agentic_operating_systems', 'governed_agent_operations'], entities: ['meta', 'forum'],
  },
] as const

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
function pageText(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#0*39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ')
}

export function officialSignalPacketFromPage(input: { sourceUrl: string; html: string; observedAt: string }): OfficialSignalPacket {
  const source = OFFICIAL_LIVE_SIGNAL_SOURCES.find((item) => item.url === input.sourceUrl)
  if (!source) throw new Error('official_signal_source_not_allowlisted')
  const observed = Date.parse(input.observedAt)
  const published = Date.parse(source.published_at)
  if (!Number.isFinite(observed) || observed < published || observed - published > 30 * 86400000) {
    throw new Error(`official_signal_stale_or_invalid:${source.key}`)
  }
  if (input.html.length < 100 || input.html.length > 3_000_000) throw new Error(`official_signal_malformed:${source.key}`)
  const visible = pageText(input.html)
  if (source.proof.some((term) => !visible.toLowerCase().includes(term.toLowerCase()))) {
    throw new Error(`official_signal_unattributable:${source.key}`)
  }
  const coverageIdentity = stableTopicIdentity(source.key)
  const expiresAt = new Date(published + 30 * 86400000).toISOString()
  const summary = sanitizeApprovedSourceSummary(source.summary)
  return {
    source_url: source.url, platform: 'other', creator_name: source.publisher, title: source.title,
    status: 'review_ready', pattern_status: 'needs_brand_translation',
    pattern_packet: { source_claim_summary: summary, source_fingerprint: hash(source.url + '|' + source.proof.join('|')) },
    actor_metadata: {
      official_signal: { coverage_identity: coverageIdentity, publisher: source.publisher, source_url: source.url,
        published_at: source.published_at, observed_at: input.observedAt, expires_at: expiresAt,
        topic_identities: [...source.topics], entity_identities: [...source.entities],
        sentiment: 'positive', materiality: 'material', evidence_state: 'attributable_single_source',
        evidence_status: 'pending_review', source_fingerprint: hash(visible), raw_content_included: false },
      topic_momentum_receipt: {
        approval_status: 'pending', raw_content_included: false, privacy_classification: 'public_safe',
        momentum_kind: 'public_news', approved_summary: summary,
        product_identity: 'portfolio', product_label: 'Portfolio', publisher: source.publisher,
        topic_identities: [...source.topics], entity_identities: [...source.entities], coverage_identity: coverageIdentity,
        sentiment: 'positive', context_summary: summary, relevance_score: 0.9, public_attention_score: null,
        materiality: 'material', evidence_state: 'attributable_single_source',
        published_at: source.published_at, observed_at: input.observedAt, expires_at: expiresAt,
      },
    },
    privacy_notes: 'Official public release source only. Review attribution, materiality, attention and Portfolio relevance before approval. No practitioner anecdote or raw page content is included.',
    retrieved_at: input.observedAt,
  }
}

export async function collectOfficialLiveSignalPackets(input: {
  observedAt?: string
  fetchPage?: typeof fetch
} = {}) {
  const observedAt = input.observedAt ?? new Date().toISOString()
  const fetchPage = input.fetchPage ?? fetch
  const packets: OfficialSignalPacket[] = []
  const blockers: string[] = []
  for (const source of OFFICIAL_LIVE_SIGNAL_SOURCES) {
    try {
      // Manual redirects keep the allowlist from becoming an open URL fetcher.
      const response = await fetchPage(source.url, { redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'text/html' }, cache: 'no-store' })
      if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) {
        throw new Error('official_signal_source_blocked')
      }
      packets.push(officialSignalPacketFromPage({ sourceUrl: source.url, html: await response.text(), observedAt }))
    } catch (error) {
      blockers.push(`${source.key}:${error instanceof Error ? error.message : 'official_signal_source_blocked'}`)
    }
  }
  return { packets, blockers, read_only: true as const, review_only: true as const }
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
