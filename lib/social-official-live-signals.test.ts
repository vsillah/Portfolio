import { describe, expect, it, vi } from 'vitest'
const database = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {
  from: () => ({
    select: () => ({ contains: (_column: string, filter: { official_signal: { coverage_identity: string } }) => ({
      limit: async () => ({ data: database.rows.filter((row) =>
        ((row.actor_metadata as Record<string, unknown>).official_signal as { coverage_identity: string }).coverage_identity
          === filter.official_signal.coverage_identity), error: null }),
    }) }),
    insert: async (packet: Record<string, unknown>) => { database.rows.push(packet); return { error: null } },
  }),
} }))
import {
  OFFICIAL_LIVE_SIGNAL_INDEXES,
  collectOfficialLiveSignalPackets,
  discoverOfficialLiveSignals,
  officialSignalPacketFromPage,
  persistPendingOfficialSignalPackets,
  validOfficialSignalAttribution,
} from './social-official-live-signals'
import { approvedPublicMomentumProjectionsFromResearchPackets, buildTrendWorkRelevanceReport } from './social-trend-work-join'
import { approvedRepositoryEvidenceProjections } from './social-repository-evidence'
import { publicSignalMeasurementReceiptId } from './social-public-signal-measurement'

const observedAt = '2026-10-20T12:00:00.000Z'
const openai = OFFICIAL_LIVE_SIGNAL_INDEXES[0].url
const newsroom = OFFICIAL_LIVE_SIGNAL_INDEXES[1].url
const engineering = OFFICIAL_LIVE_SIGNAL_INDEXES[2].url
const museUrl = 'https://about.fb.com/news/2026/10/introducing-muse-wonder-models/'
const forumUrl = 'https://engineering.fb.com/2026/10/15/ml-applications/how-meta-built-forum-ai-native-engineering/'
const newReleaseUrl = 'https://engineering.fb.com/2026/10/19/ml-applications/how-meta-built-new-agent-memory/'
const openaiHtml = `<html><div class="mb-12"><h3>October, 2026</h3>
  <div class="mt-5"><div class="grid"><div>Oct 16</div><div>Feature v1/agents <p>Agents API now includes the Artifact SDK and Ultrafast mode.</p></div></div></div>
  <div class="mt-5"><div class="grid"><div>Oct 19</div><div>Feature v1/agents <p>Agents API added subagents and approval controls.</p></div></div></div>
  <div class="mt-5"><div class="grid"><div>Oct 19</div><div>Feature v1/audio <p>New voices.</p></div></div></div></div></html>`
function item(title: string, url: string, pubDate: string, description: string) {
  return `<item><title>${title}</title><link>${url}</link><pubDate>${pubDate}</pubDate><description>${description}</description></item>`
}
const newsroomXml = `<rss><channel>${item('Introducing Muse Wonder and Muse Wonder Full: Frontier Models for Agents', museUrl, 'Mon, 12 Oct 2026 12:00:00 +0000', 'Muse agent model with Active Memory.')}${item('Sports update', 'https://about.fb.com/news/2026/10/sports-update/', 'Mon, 12 Oct 2026 12:00:00 +0000', 'A non-agent release.')}</channel></rss>`
const engineeringXml = `<rss><channel>${item('How Meta Built Forum With AI-Native Engineering', forumUrl, 'Thu, 15 Oct 2026 19:00:03 +0000', 'Forum engineers brought an AI agent into the development cycle.')}${item('How Meta Built Forum Agent Memory', newReleaseUrl, 'Mon, 19 Oct 2026 12:00:00 +0000', 'Meta agents learned memory.')}</channel></rss>`
const page = (title: string, date: string, proof: string) => `<html><head><title>${title} - Engineering at Meta</title><meta content="${date}" /></head><body>${proof} ${'Official release detail. '.repeat(10)}</body></html>`
const pages: Record<string, { body: string; contentType: string }> = {
  [openai]: { body: openaiHtml, contentType: 'text/html' },
  [newsroom]: { body: newsroomXml, contentType: 'application/rss+xml' },
  [engineering]: { body: engineeringXml, contentType: 'application/rss+xml' },
  [museUrl]: { body: page('Introducing Muse Wonder and Muse Wonder Full: Frontier Models for Agents', '2026-10-12', 'Muse agent Active Memory'), contentType: 'text/html' },
  [forumUrl]: { body: page('How Meta Built Forum With AI-Native Engineering', '2026-10-15', 'Forum AI agent'), contentType: 'text/html' },
  [newReleaseUrl]: { body: page('How Meta Built Forum Agent Memory', '2026-10-19', 'Forum agent'), contentType: 'text/html' },
}
function fakeFetch(url: string) {
  const found = pages[url]
  return Promise.resolve(found
    ? new Response(found.body, { headers: { 'content-type': found.contentType } })
    : new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } }))
}

describe('official live-signal discovery and review boundary', () => {
  it('discovers three dated releases plus new OpenAI and Meta entries without article URL configuration', async () => {
    const fetchPage = vi.fn(fakeFetch) as unknown as typeof fetch
    const first = await collectOfficialLiveSignalPackets({ observedAt, fetchPage })
    const retry = await collectOfficialLiveSignalPackets({ observedAt, fetchPage })
    expect(first.blockers).toEqual([])
    expect(first.packets).toEqual(retry.packets)
    expect(first.packets).toHaveLength(5)
    expect(first.packets.map((packet) => packet.source_url)).toContain(newReleaseUrl)
    expect(first.excluded).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'nonqualifying_topic' })]))
    expect(new Set(first.packets.map((packet) => (packet.actor_metadata.official_signal as { coverage_identity: string }).coverage_identity)).size).toBe(5)
    expect(first.packets.every((packet) => packet.status === 'review_ready'
      && (packet.actor_metadata.topic_momentum_receipt as { approval_status: string }).approval_status === 'pending'
      && !packet.actor_metadata.practitioner_evidence
      && validOfficialSignalAttribution(packet))).toBe(true)
    expect(approvedPublicMomentumProjectionsFromResearchPackets(first.packets as unknown as Record<string, unknown>[]).projections).toEqual([])
    database.rows = []
    expect(await persistPendingOfficialSignalPackets(first.packets)).toBe(5)
    expect(await persistPendingOfficialSignalPackets(retry.packets)).toBe(0)
    expect(database.rows).toHaveLength(5)

    const reviewedWithoutMeasurement = first.packets.map((packet, index) => ({ ...packet, id: `official-${index}`, status: 'approved',
      actor_metadata: { ...packet.actor_metadata,
        operator_review: { decision: 'approved', reviewed_at: observedAt, reviewed_by: 'fixture-reviewer' },
        topic_momentum_receipt: { ...(packet.actor_metadata.topic_momentum_receipt as Record<string, unknown>),
          approval_status: 'approved', approved_at: observedAt, approved_by: 'fixture-reviewer',
          relevance_score: 0.9, public_attention_score: 0.8 },
      },
    }))
    expect(approvedPublicMomentumProjectionsFromResearchPackets(reviewedWithoutMeasurement).projections).toEqual([])
    const reviewed = reviewedWithoutMeasurement.map((packet, index) => {
      const sourceReceipts = [packet.source_url, `https://example.org/observed/${index}`, `https://example.net/observed/${index}`]
        .map((source_url, sourceIndex) => ({ receipt_id: `public-source:fixture-${index}-${sourceIndex}-receipt`, source_url,
          observed_at: observedAt, public_attention_score: 0.8, relevance_score: 0.9 }))
      const contents = { version: 'public_signal_measurement_v1' as const,
        coverage_identity: ((packet.actor_metadata as Record<string, unknown>).official_signal as { coverage_identity: string }).coverage_identity,
        observed_at: observedAt, fresh_until: '2026-10-25T12:00:00.000Z', sample_size: 3,
        formula: 'mean_normalized_public_observations_v1' as const,
        public_attention_score: 0.8, public_attention_threshold: 0.65 as const,
        relevance_score: 0.9, relevance_threshold: 0.65 as const, source_receipts: sourceReceipts }
      const measurement = { ...contents, receipt_id: publicSignalMeasurementReceiptId(contents) }
      return { ...packet, actor_metadata: { ...packet.actor_metadata,
        official_signal: { ...((packet.actor_metadata as Record<string, unknown>).official_signal as Record<string, unknown>), evidence_status: 'approved' },
        public_signal_measurement_receipt: measurement,
        topic_momentum_receipt: { ...(packet.actor_metadata.topic_momentum_receipt as Record<string, unknown>),
          measurement_receipt_id: measurement.receipt_id, measurement_source_receipt_ids: sourceReceipts.map((source) => source.receipt_id) },
      } }
    })
    const projected = approvedPublicMomentumProjectionsFromResearchPackets(reviewed)
    expect(projected.projections).toHaveLength(5)
    const report = buildTrendWorkRelevanceReport([
      ...projected.projections,
      ...approvedRepositoryEvidenceProjections(observedAt).filter((receipt) => receipt.product_identity === 'portfolio'),
    ], observedAt)
    const candidates = report.candidates.filter((candidate) => candidate.candidate_class === 'public_momentum_repository')
    expect(candidates).toHaveLength(5)
    expect(new Set(candidates.map((candidate) => candidate.candidate_key)).size).toBe(5)
    expect(candidates.every((candidate) => candidate.product_identity === 'portfolio'
      && candidate.status === 'review_only' && candidate.side_effects.content_generation === false)).toBe(true)
  })

  it('fails closed on unknown indexes, blocked details, malformed feeds, stale and unattributable evidence', async () => {
    expect(() => discoverOfficialLiveSignals({ indexUrl: 'https://example.com/feed/', body: newsroomXml, observedAt })).toThrow('not_allowlisted')
    expect(() => discoverOfficialLiveSignals({ indexUrl: newsroom, body: '<rss>short</rss>', observedAt })).toThrow('malformed')
    const stale = discoverOfficialLiveSignals({ indexUrl: engineering, body: engineeringXml, observedAt: '2026-12-01T00:00:00.000Z' })
    expect(stale.discovered).toEqual([])
    expect(stale.excluded.every((entry) => entry.reason.includes('stale'))).toBe(true)
    const discovery = discoverOfficialLiveSignals({ indexUrl: engineering, body: engineeringXml, observedAt }).discovered[0]
    expect(() => officialSignalPacketFromPage({ discovery, html: page('Unrelated article', '2026-10-15', 'No agents here'), observedAt })).toThrow('unattributable')
    const blocked = await collectOfficialLiveSignalPackets({ observedAt, fetchPage: vi.fn(async (url: string) => {
      if (url === forumUrl) return new Response('blocked', { status: 403, headers: { 'content-type': 'text/html' } })
      return fakeFetch(url)
    }) as unknown as typeof fetch })
    expect(blocked.packets.some((packet) => packet.source_url === forumUrl)).toBe(false)
    expect(blocked.blockers).toEqual(expect.arrayContaining([expect.stringContaining('official_signal_source_blocked')]))
  })
})
