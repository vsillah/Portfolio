import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getReview: vi.fn(), post: vi.fn(), from: vi.fn(),
}))
vi.mock('@/lib/evidence-repair-human-qa', () => ({
  getEvidenceRepairReview: mocks.getReview,
  evidenceRepairReviewPath: (id: string) => `/admin/agents/content-intelligence?section=research&packet=${id}`,
}))
vi.mock('@/lib/slack-agent-environment', () => ({
  getSlackAgentSource: () => ({ sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.test', hosted: true }),
  getSlackAgentDeliveryConfig: () => ({ sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.test',
    hosted: true, channel: 'C123', token: 'synthetic-token' }),
}))
vi.mock('@/lib/agent-slack-delivery', () => ({ postToSlack: mocks.post }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { evidenceRepairSlackCard, requestEvidenceRepairSlackReview, verifyEvidenceRepairSlackRequest } from './evidence-repair-slack'

const packet = '10000000-0000-4000-8000-000000000001'
const requestId = '10000000-0000-4000-8000-000000000006'
const binding = {
  caseId: `calendar:10000000-0000-4000-8000-000000000003:repair-packet:${packet}`,
  packetId: packet, packetVersion: '2026-11-25T12:00:00.000Z',
  originalPacketId: '10000000-0000-4000-8000-000000000002',
  originalPacketVersion: '2026-11-24T12:00:00.000Z',
  calendarItemId: '10000000-0000-4000-8000-000000000003',
  socialContentId: '10000000-0000-4000-8000-000000000004',
  sourceSha256: 'a'.repeat(64), sourceExpiresAt: '2027-11-25T12:00:00.000Z',
  approvedCopySha256: 'b'.repeat(64), evidenceVersion: '2026-11-25T12:00:00.000Z', bindingHash: 'c'.repeat(64),
  claimBoundarySha256: 'd'.repeat(64), contentVersion: '2026-11-25T11:00:00.000Z',
}
const review = { binding, title: 'Synthetic <replacement>', sourceUrl: 'https://example.test/source?a=1&b=2',
  sourceUseBoundary: 'Use <bounded> claim support', supportedClaims: ['Claim <one>'], removedClaims: ['Unsupported'] }

function query(result: unknown) {
  const q = { select: () => q, eq: () => q, insert: () => q, update: () => q,
    maybeSingle: async () => ({ data: result, error: null }) }
  return q
}

describe('evidence repair Slack request and receipt gate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getReview.mockResolvedValue(review)
    vi.stubEnv('EVIDENCE_REPAIR_SLACK_REVIEW_ENABLED', 'true')
    vi.stubEnv('EVIDENCE_REPAIR_SLACK_REVIEWER_MAP', JSON.stringify({ U123: '10000000-0000-4000-8000-000000000005' }))
    vi.stubEnv('SLACK_AGENT_OPS_ALLOWED_USER_IDS', 'U123')
    vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', 'T123')
    vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'true')
    vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT', 'staging')
    vi.stubEnv('SLACK_SIGNING_SECRET', 'synthetic-signing-secret')
  })

  it('renders bounded evidence, exact bindings, review-only effects and safe Slack text', () => {
    const card = evidenceRepairSlackCard({ requestId, ...review, expiresAt: '2026-11-26T12:00:00Z' })
    const serialized = JSON.stringify(card.blocks)
    expect(serialized).toContain('evidence_repair_approve')
    expect(serialized).toContain('evidence_repair_revise')
    expect(serialized).toContain('evidence_repair_reject')
    expect(serialized).toContain(binding.bindingHash)
    expect(serialized).toContain('does not link evidence')
    expect(serialized).toContain('&lt;replacement&gt;')
    expect(serialized).toContain('&amp;b=2')
    expect(card.url).toContain(`packet=${packet}`)
  })

  it('keeps the synthetic preview read-only even while delivery is disabled', async () => {
    vi.stubEnv('EVIDENCE_REPAIR_SLACK_REVIEW_ENABLED', 'false')
    const result = await requestEvidenceRepairSlackReview(packet, true)
    expect(result.status).toBe('dry_run')
    expect(result.external_execution_enabled).toBe(false)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('refuses a stale Portfolio binding before any Slack claim or network call', async () => {
    await expect(requestEvidenceRepairSlackReview(packet, false,
      { packetVersion: binding.packetVersion, bindingHash: 'f'.repeat(64) })).rejects.toThrow(/binding changed/i)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it.each([
    ['dedicated flag', () => vi.stubEnv('EVIDENCE_REPAIR_SLACK_REVIEW_ENABLED', 'false')],
    ['action receipts', () => vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'false')],
    ['wrong environment', () => vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT', 'production')],
    ['reviewer map', () => vi.stubEnv('EVIDENCE_REPAIR_SLACK_REVIEWER_MAP', '{}')],
  ])('does not claim or deliver when %s is unavailable', async (_name, change) => {
    change()
    await expect(requestEvidenceRepairSlackReview(packet)).rejects.toThrow()
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('claims once, stores the message identity and suppresses duplicate delivery', async () => {
    const prior = query(null), claim = query({ id: requestId }), receipt = query({ id: requestId })
    mocks.from.mockReturnValueOnce(prior).mockReturnValueOnce(claim).mockReturnValueOnce(receipt)
    mocks.post.mockResolvedValue({ sent: true, channel: 'C123', ts: '1716400000.000' })
    const sent = await requestEvidenceRepairSlackReview(packet)
    expect(sent.status).toBe('sent')
    expect(sent.external_execution_enabled).toBe(false)
    expect(mocks.post).toHaveBeenCalledOnce()
    mocks.from.mockReturnValueOnce(query({ id: requestId, outcome: { delivery: 'sent' } }))
    const repeated = await requestEvidenceRepairSlackReview(packet)
    expect(repeated.status).toBe('already_requested')
    expect(mocks.post).toHaveBeenCalledOnce()
  })

  it('leaves an uncertain delivery claimed without retrying the Slack network call', async () => {
    mocks.from.mockReturnValueOnce(query(null)).mockReturnValueOnce(query({ id: requestId }))
      .mockReturnValueOnce(query(null))
    mocks.post.mockResolvedValue({ sent: false, uncertain: true, reason: 'synthetic timeout' })
    expect((await requestEvidenceRepairSlackReview(packet)).status).toBe('uncertain')
    mocks.from.mockReturnValueOnce(query({ id: requestId, outcome: { delivery: 'uncertain' } }))
    expect((await requestEvidenceRepairSlackReview(packet)).status).toBe('already_requested')
    expect(mocks.post).toHaveBeenCalledOnce()
  })

  it('rejects source, message and version drift before a decision is accepted', async () => {
    mocks.from.mockReturnValue(query({ id: requestId, kind: 'evidence_repair_human_qa_request', status: 'completed',
      metadata: { binding, team_id: 'T123', channel_id: 'C123', expires_at: '2027-01-01T00:00:00Z',
        source_environment: 'staging', source_origin: 'https://staging.example.test' },
      outcome: { delivery: 'sent', channel_id: 'C123', message_ts: '1716400000.000' } }))
    const base = { requestId, bindingHash: binding.bindingHash, packetId: packet, packetVersion: binding.packetVersion,
      teamId: 'T123', channelId: 'C123', messageTs: '1716400000.000', userId: 'U123', expiresAt: '2027-01-01T00:00:00Z' }
    expect(await verifyEvidenceRepairSlackRequest(base)).toBe(true)
    expect(await verifyEvidenceRepairSlackRequest({ ...base, messageTs: 'wrong' })).toBe(false)
    expect(await verifyEvidenceRepairSlackRequest({ ...base, packetVersion: '2026-11-26T12:00:00Z' })).toBe(false)
    expect(await verifyEvidenceRepairSlackRequest({ ...base, teamId: 'T999' })).toBe(false)
    expect(await verifyEvidenceRepairSlackRequest({ ...base, userId: 'U999' })).toBe(false)
  })
})
