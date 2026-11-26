import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: db }))
import { decideEvidenceRepairHumanQa, getEvidenceRepairReview } from './evidence-repair-human-qa'

const ids = {
  packet: '10000000-0000-4000-8000-000000000001',
  original: '10000000-0000-4000-8000-000000000002',
  calendar: '10000000-0000-4000-8000-000000000003',
  social: '10000000-0000-4000-8000-000000000004',
  reviewer: '10000000-0000-4000-8000-000000000005',
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const version = '2026-11-25T12:00:00.000Z'
const originalVersion = '2026-11-24T12:00:00.000Z'

function fixture() {
  const candidate = { original_packet_id: ids.original, original_packet_version: originalVersion,
    original_source_url: 'https://example.test/original',
    calendar_item_id: ids.calendar, social_content_id: ids.social,
    candidate_status: 'human_qa_pending', linkage_status: 'unlinked', preparation_rerun_status: 'not_run',
    external_actions_allowed: false, approved_social_copy_unchanged: true,
    approved_social_copy_sha256: hash('Synthetic approved copy') }
  const freshness = { status: 'passed', provenance_status: 'verified_primary_source',
    privacy_clearance: { status: 'cleared' }, rights_clearance: { status: 'cleared_for_bounded_claim_support' },
    source_url: 'https://example.test/replacement', source_sha256: 'a'.repeat(64),
    observed_at: '2026-11-25T11:00:00.000Z', expires_at: '2027-11-25T12:00:00.000Z', evidence_version: version }
  return {
    packet: { id: ids.packet, title: 'Synthetic replacement', status: 'review_ready',
      source_url: freshness.source_url, updated_at: version, pattern_packet: { source_use_boundary: 'Bounded claim support', supported_claims: ['Claim one'] },
      actor_metadata: { evidence_repair_candidate: candidate, source_freshness_receipt: freshness } },
    original: { id: ids.original, updated_at: originalVersion, status: 'approved', source_url: 'https://example.test/original' },
    calendar: { id: ids.calendar, social_content_id: ids.social, authorization_status: 'authorized',
      metadata: { external_execution_enabled: false, publish_enabled: false } },
    social: { id: ids.social, post_text: 'Synthetic approved copy', updated_at: '2026-11-25T11:00:00.000Z' }, receipt: null as Record<string, unknown> | null,
  }
}

function wire(rows: ReturnType<typeof fixture>) {
  db.from.mockImplementation((table: string) => {
    const data = table === 'evidence_repair_human_qa_receipts' ? rows.receipt
      : table === 'social_content_calendar_items' ? rows.calendar
      : table === 'social_content_queue' ? rows.social
      : table === 'social_content_research_packets' ? null : undefined
    const query = { select: () => query, eq: (key: string, value: string) => {
      if (table === 'social_content_research_packets') selected = value === ids.packet ? rows.packet : rows.original
      return query
    }, maybeSingle: async () => ({ data: table === 'social_content_research_packets' ? selected : data, error: null }) }
    let selected: unknown = null
    return query
  })
}

describe('evidence repair canonical decision service', () => {
  beforeEach(() => { db.from.mockReset(); db.rpc.mockReset() })

  it('binds exact packet, original, calendar and copy and calls only the transactional decision RPC', async () => {
    const rows = fixture(); wire(rows)
    const review = await getEvidenceRepairReview(ids.packet, new Date('2026-11-25T13:00:00Z'))
    db.rpc.mockResolvedValue({ data: { id: 'receipt-1', decision: 'approve', external_execution_enabled: false }, error: null })
    const result = await decideEvidenceRepairHumanQa({ packetId: ids.packet, packetVersion: version,
      bindingHash: review.binding.bindingHash, decision: 'approve', reason: 'Bounded claim and source verified',
      reviewerId: ids.reviewer, surface: 'portfolio' })
    expect(result.id).toBe('receipt-1')
    expect(db.rpc).toHaveBeenCalledOnce()
    expect(db.rpc).toHaveBeenCalledWith('record_evidence_repair_human_qa_decision',
      expect.objectContaining({ p_packet_id: ids.packet, p_candidate: rows.packet.actor_metadata.evidence_repair_candidate,
        p_freshness: rows.packet.actor_metadata.source_freshness_receipt,
        p_pattern: rows.packet.pattern_packet, p_claim_boundary_sha256: review.binding.claimBoundarySha256,
        p_content_version: rows.social.updated_at, p_slack_identity: null }))
    expect(db.from.mock.calls.map(([table]) => table)).not.toContain('social_content_approvals')
  })

  it('preserves PostgreSQL microseconds through a Slack decision and exact replay', async () => {
    const rows = fixture()
    rows.packet.updated_at = '2026-11-25T12:00:00.778694+00:00'
    rows.packet.actor_metadata.source_freshness_receipt.evidence_version = rows.packet.updated_at
    rows.original.updated_at = '2026-11-24T12:00:00.123456+00:00'
    rows.packet.actor_metadata.evidence_repair_candidate.original_packet_version = rows.original.updated_at
    rows.social.updated_at = '2026-11-25T11:00:00.987654+00:00'
    wire(rows)
    const review = await getEvidenceRepairReview(ids.packet, new Date('2026-11-25T13:00:00Z'))
    expect(review.binding.packetVersion).toBe('2026-11-25T12:00:00.778694Z')
    expect(review.binding.contentVersion).toBe('2026-11-25T11:00:00.987654Z')
    const slackIdentity = { team_id: 'T1', channel_id: 'C1', message_ts: '1.1', user_id: 'U1' }
    const input = { packetId: ids.packet, packetVersion: review.binding.packetVersion,
      bindingHash: review.binding.bindingHash, decision: 'approve' as const, reason: 'Bounded claim verified',
      reviewerId: ids.reviewer, surface: 'slack' as const, slackIdentity }
    db.rpc.mockImplementation(async (_name, args) => {
      expect(args.p_packet_version).toBe(review.binding.packetVersion)
      expect(args.p_content_version).toBe(review.binding.contentVersion)
      expect(args.p_candidate).toEqual(rows.packet.actor_metadata.evidence_repair_candidate)
      expect(args.p_freshness).toEqual(rows.packet.actor_metadata.source_freshness_receipt)
      expect(args.p_pattern).toEqual(rows.packet.pattern_packet)
      expect(args.p_slack_identity).toEqual(slackIdentity)
      return { data: { id: 'receipt-1', decision: 'approve', external_execution_enabled: false }, error: null }
    })
    const first = await decideEvidenceRepairHumanQa(input)
    expect(first.external_execution_enabled).toBe(false)
    expect(db.rpc).toHaveBeenCalledOnce()
    rows.receipt = { id: 'receipt-1', case_id: review.binding.caseId, packet_id: ids.packet,
      packet_version: rows.packet.updated_at, original_packet_id: ids.original,
      original_packet_version: rows.original.updated_at, calendar_item_id: ids.calendar,
      social_content_id: ids.social, source_sha256: review.binding.sourceSha256,
      source_expires_at: rows.packet.actor_metadata.source_freshness_receipt.expires_at,
      approved_copy_sha256: review.binding.approvedCopySha256, claim_boundary_sha256: review.binding.claimBoundarySha256,
      content_version: rows.social.updated_at, freshness_snapshot: rows.packet.actor_metadata.source_freshness_receipt,
      candidate_snapshot: rows.packet.actor_metadata.evidence_repair_candidate,
      idempotency_key: `evidence-repair-human-qa:${ids.packet}:${review.binding.packetVersion}:approve:${ids.reviewer}`,
      reason: input.reason, reviewer_id: ids.reviewer, surface: 'slack', slack_identity: slackIdentity,
      external_execution_enabled: false }
    expect(await decideEvidenceRepairHumanQa(input)).toMatchObject({ id: 'receipt-1', replayed: true,
      external_execution_enabled: false })
    expect(db.rpc).toHaveBeenCalledOnce()
    await expect(decideEvidenceRepairHumanQa({ ...input, reason: 'Changed decision' }))
      .rejects.toThrow(/already has a different Human QA decision/i)
    expect(db.rpc).toHaveBeenCalledOnce()
  })

  it('rejects a changed microsecond timestamp and stale packet binding before persistence', async () => {
    const rows = fixture(); wire(rows)
    rows.packet.updated_at = '2026-11-25T12:00:00.778694+00:00'
    rows.packet.actor_metadata.source_freshness_receipt.evidence_version = rows.packet.updated_at
    const review = await getEvidenceRepairReview(ids.packet, new Date('2026-11-25T13:00:00Z'))
    const input = { packetId: ids.packet, packetVersion: review.binding.packetVersion,
      bindingHash: review.binding.bindingHash, decision: 'approve' as const, reason: 'Bounded claim verified',
      reviewerId: ids.reviewer, surface: 'portfolio' as const }
    await expect(decideEvidenceRepairHumanQa({ ...input, packetVersion: '2026-11-25T12:00:00.778695Z' }))
      .rejects.toThrow(/evidence changed/i)
    rows.packet.updated_at = '2026-11-25T12:00:00.778695+00:00'
    rows.packet.actor_metadata.source_freshness_receipt.evidence_version = rows.packet.updated_at
    await expect(decideEvidenceRepairHumanQa(input)).rejects.toThrow(/evidence changed/i)
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['expired source', (r: ReturnType<typeof fixture>) => { r.packet.actor_metadata.source_freshness_receipt.expires_at = '2020-01-01T00:00:00Z' }],
    ['missing observation', (r: ReturnType<typeof fixture>) => { r.packet.actor_metadata.source_freshness_receipt.observed_at = '' }],
    ['original drift', (r: ReturnType<typeof fixture>) => { r.original.updated_at = '2026-11-25T12:00:00Z' }],
    ['original microsecond drift', (r: ReturnType<typeof fixture>) => { r.original.updated_at = '2026-11-24T12:00:00.000001Z' }],
    ['evidence microsecond drift', (r: ReturnType<typeof fixture>) => { r.packet.actor_metadata.source_freshness_receipt.evidence_version = '2026-11-25T12:00:00.000001Z' }],
    ['original source drift', (r: ReturnType<typeof fixture>) => { r.original.source_url = 'https://example.test/changed' }],
    ['copy drift', (r: ReturnType<typeof fixture>) => { r.social.post_text = 'Changed copy' }],
    ['missing claim boundary', (r: ReturnType<typeof fixture>) => { r.packet.pattern_packet.supported_claims = [] }],
    ['authorization drift', (r: ReturnType<typeof fixture>) => { r.calendar.authorization_status = 'pending' }],
    ['external lock open', (r: ReturnType<typeof fixture>) => { r.calendar.metadata.publish_enabled = true }],
  ])('fails closed on %s before any decision RPC', async (_name, mutate) => {
    const rows = fixture(); mutate(rows); wire(rows)
    await expect(getEvidenceRepairReview(ids.packet, new Date('2026-11-25T13:00:00Z'))).rejects.toThrow()
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('rejects a stale binding without persistence', async () => {
    const rows = fixture(); wire(rows)
    await expect(decideEvidenceRepairHumanQa({ packetId: ids.packet, packetVersion: version,
      bindingHash: 'b'.repeat(64), decision: 'reject', reason: 'Wrong source',
      reviewerId: ids.reviewer, surface: 'portfolio' })).rejects.toThrow(/evidence changed/i)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it.each(['content version', 'content microsecond', 'claim boundary'])('rejects %s drift after a reviewer opens the packet', async changed => {
    const rows = fixture(); wire(rows)
    const initial = await getEvidenceRepairReview(ids.packet, new Date('2026-11-25T13:00:00Z'))
    if (changed === 'content version') rows.social.updated_at = '2026-11-25T12:30:00.000Z'
    else if (changed === 'content microsecond') rows.social.updated_at = '2026-11-25T11:00:00.000001Z'
    else rows.packet.pattern_packet.source_use_boundary = 'Changed claim boundary'
    await expect(decideEvidenceRepairHumanQa({ packetId: ids.packet, packetVersion: version,
      bindingHash: initial.binding.bindingHash, decision: 'approve', reason: 'Earlier source reviewed',
      reviewerId: ids.reviewer, surface: 'portfolio' })).rejects.toThrow(/evidence changed/i)
    expect(db.rpc).not.toHaveBeenCalled()
  })
})
