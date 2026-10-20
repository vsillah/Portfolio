import { describe, expect, it, vi } from 'vitest'
import {
  OFFICIAL_LIVE_SIGNAL_SOURCES,
  collectOfficialLiveSignalPackets,
  officialSignalPacketFromPage,
} from './social-official-live-signals'
import { approvedPublicMomentumProjectionsFromResearchPackets, buildTrendWorkRelevanceReport } from './social-trend-work-join'
import { approvedRepositoryEvidenceProjections } from './social-repository-evidence'

const observedAt = '2026-10-20T12:00:00.000Z'
const htmlFor = (source: (typeof OFFICIAL_LIVE_SIGNAL_SOURCES)[number]) =>
  `<html><body>${source.proof.map((term) => `<p>${term}</p>`).join('')}<p>${'Official release detail. '.repeat(10)}</p></body></html>`

describe('official live-signal intake', () => {
  it('creates distinct pending OpenAI Agents API and Meta Muse/Forum research inputs without generating content', async () => {
    const fetchPage = vi.fn(async (url: string) => {
      const source = OFFICIAL_LIVE_SIGNAL_SOURCES.find((item) => item.url === url)!
      return new Response(htmlFor(source), { headers: { 'content-type': 'text/html' } })
    }) as unknown as typeof fetch
    const first = await collectOfficialLiveSignalPackets({ observedAt, fetchPage })
    const retry = await collectOfficialLiveSignalPackets({ observedAt, fetchPage })
    expect(first.blockers).toEqual([])
    expect(first.packets).toEqual(retry.packets)
    expect(first.packets).toHaveLength(3)
    expect(new Set(first.packets.map((packet) => (packet.actor_metadata.official_signal as { coverage_identity: string }).coverage_identity)).size).toBe(3)
    expect(first.packets.every((packet) => packet.status === 'review_ready'
      && (packet.actor_metadata.topic_momentum_receipt as { approval_status: string }).approval_status === 'pending'
      && packet.pattern_status === 'needs_brand_translation'
      && !packet.actor_metadata.practitioner_evidence)).toBe(true)
    expect(approvedPublicMomentumProjectionsFromResearchPackets(first.packets as unknown as Record<string, unknown>[]).projections).toEqual([])

    // The reviewed form of these exact packets uses the existing research-packet
    // projection and Portfolio receipts. No draft, media, or provider is called.
    const reviewed = first.packets.map((packet, index) => ({
      ...packet, id: `official-${index}`, status: 'approved',
      actor_metadata: {
        ...packet.actor_metadata,
        operator_review: { decision: 'approved', reviewed_at: observedAt, reviewed_by: 'fixture-reviewer' },
        topic_momentum_receipt: {
          ...(packet.actor_metadata.topic_momentum_receipt as Record<string, unknown>),
          approval_status: 'approved', approved_at: observedAt, approved_by: 'fixture-reviewer',
          public_attention_score: 0.8,
        },
      },
    }))
    const projected = approvedPublicMomentumProjectionsFromResearchPackets(reviewed)
    expect(projected.blockers).toEqual([])
    expect(projected.projections).toHaveLength(3)
    const report = buildTrendWorkRelevanceReport([
      ...projected.projections,
      ...approvedRepositoryEvidenceProjections(observedAt).filter((receipt) => receipt.product_identity === 'portfolio'),
    ], observedAt)
    const candidates = report.candidates.filter((candidate) => candidate.candidate_class === 'public_momentum_repository')
    expect(candidates).toHaveLength(3)
    expect(new Set(candidates.map((candidate) => candidate.candidate_key)).size).toBe(3)
    expect(candidates.every((candidate) => candidate.product_identity === 'portfolio'
      && candidate.status === 'review_only'
      && candidate.side_effects.content_generation === false
      && candidate.side_effects.provider_call === false)).toBe(true)
  })

  it('fails closed on unknown, stale, blocked, unattributable and malformed sources', async () => {
    const source = OFFICIAL_LIVE_SIGNAL_SOURCES[0]
    expect(() => officialSignalPacketFromPage({ sourceUrl: 'https://example.com/release', html: htmlFor(source), observedAt })).toThrow('not_allowlisted')
    expect(() => officialSignalPacketFromPage({ sourceUrl: source.url, html: htmlFor(source), observedAt: '2026-12-01T00:00:00.000Z' })).toThrow('stale')
    expect(() => officialSignalPacketFromPage({ sourceUrl: source.url, html: '<html>short</html>', observedAt })).toThrow('malformed')
    expect(() => officialSignalPacketFromPage({ sourceUrl: source.url, html: '<html>' + 'unrelated '.repeat(30) + '</html>', observedAt })).toThrow('unattributable')
    const blocked = await collectOfficialLiveSignalPackets({ observedAt, fetchPage: vi.fn(async () => new Response('blocked', { status: 403, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch })
    expect(blocked.packets).toEqual([])
    expect(blocked.blockers).toHaveLength(3)
  })
})
