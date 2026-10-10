import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), single: vi.fn(), update: vi.fn(), eq: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.auth, isAuthError: (v: { error?: string }) => !!v.error }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
import { PATCH, POST } from './route'
const id = '11111111-1111-4111-8111-111111111111'
const version = '2026-10-06T12:00:00.000Z'
const evidence = {
  role_context: 'Community operations lead',
  situation: 'A recurring handoff was creating avoidable delays for the team.',
  action_taken: 'The practitioner introduced a short evidence review before assignment.',
  observed_outcome: 'The team caught missing context earlier and reduced repeated follow-up.',
  limitations: 'Observed in one bounded workflow; no causal claim is made.',
  public_use_boundary: 'framework_only',
  redaction_receipt: { direct_identifiers_removed: true, indirect_identifiers_reviewed: true, sensitive_details_removed: true, review_note: 'Names and unique organizational details were generalized.' },
  framework_receipt: { selected_framework_key: 'framework', application_note: 'Apply the scene-to-lesson structure without using source language.', source_use_confirmed: true },
  revision_note: 'Added privacy-safe practitioner evidence.',
}
const packet = { id, status: 'review_ready', updated_at: version, pattern_status: 'usable_framework', source_url: 'https://example.com/source', pattern_packet: { framework: 'Scene to lesson' }, actor_metadata: { provenance: 'public', practitioner_evidence: evidence } }
const request = (body: unknown = { decision: 'approved', note: 'Safe abstract framework', updated_at: version }, packetId = id) => POST(new NextRequest('http://localhost/api/review', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: packetId }) })
const patchRequest = (body: unknown = { evidence, updated_at: version }, packetId = id) => PATCH(new NextRequest('http://localhost/api/review', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: packetId }) })
describe('research packet review', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'admin' } })
    const chain = { select: vi.fn(() => chain), eq: mocks.eq, update: mocks.update, maybeSingle: mocks.single }
    mocks.from.mockReturnValue(chain); mocks.eq.mockReturnValue(chain); mocks.update.mockReturnValue(chain)
    mocks.single.mockResolvedValueOnce({ data: packet }).mockResolvedValue({ data: { ...packet, status: 'approved' } })
  })
  it.each([401, 403])('denies auth %s before querying', async status => {
    mocks.auth.mockResolvedValue({ error: 'Denied', status })
    expect((await request()).status).toBe(status); expect(mocks.from).not.toHaveBeenCalled()
  })
  it.each([null, {}, { decision: 'archived', note: 'reason', updated_at: version }, { decision: 'approved', note: ' ', updated_at: version }, { decision: 'approved', note: 'a'.repeat(2001), updated_at: version }, { decision: 'approved', note: 'reason', updated_at: 'bad' }])('rejects invalid body %j', async body => {
    expect((await request(body)).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rejects invalid ids', async () => { expect((await request({}, 'bad')).status).toBe(400) })
  it.each(['too_close_to_source', 'not_relevant', 'needs_brand_translation'])('blocks approval of %s', async pattern_status => {
    mocks.single.mockReset().mockResolvedValue({ data: { ...packet, pattern_status } })
    expect((await request()).status).toBe(422); expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each([
    { source_url: '' },
    { source_url: 'not-a-url' },
    { source_url: 'ftp://example.com/source' },
    { pattern_packet: null },
    { pattern_packet: {} },
  ])('blocks incomplete approval evidence %j', async fields => {
    mocks.single.mockReset().mockResolvedValue({ data: { ...packet, ...fields } })
    expect((await request()).status).toBe(422); expect(mocks.update).not.toHaveBeenCalled()
  })
  it('records review identity and preserves provenance atomically', async () => {
    expect((await request()).status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ status: 'approved', actor_metadata: { provenance: 'public', practitioner_evidence: evidence, operator_review: expect.objectContaining({ reviewed_by: 'admin', decision: 'approved', note: 'Safe abstract framework', source_url: packet.source_url, packet_version: version, practitioner_evidence_version: null }) } })
    expect(mocks.eq).toHaveBeenCalledWith('updated_at', version)
    expect(mocks.eq).toHaveBeenCalledWith('status', 'review_ready')
  })
  it('allows rejecting unsafe patterns', async () => {
    mocks.single.mockReset().mockResolvedValueOnce({ data: { ...packet, pattern_status: 'too_close_to_source' } }).mockResolvedValue({ data: { ...packet, status: 'rejected' } })
    expect((await request({ decision: 'rejected', note: 'Copies source', updated_at: version })).status).toBe(200)
  })
  it('blocks approval until practitioner evidence and receipts are complete', async () => {
    mocks.single.mockReset().mockResolvedValue({ data: { ...packet, actor_metadata: { provenance: 'public' } } })
    const response = await request()
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: 'Complete practitioner evidence and privacy review before approval.', issues: expect.arrayContaining([expect.stringContaining('anonymized practitioner role')]) })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('saves evidence and framework receipts with a bounded audit history', async () => {
    mocks.single.mockReset().mockResolvedValueOnce({ data: { ...packet, actor_metadata: { provenance: 'public' } } }).mockResolvedValue({ data: packet })
    const response = await patchRequest()
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'review_ready',
      actor_metadata: expect.objectContaining({
        provenance: 'public',
        practitioner_evidence: expect.objectContaining({
          public_use_boundary: 'framework_only',
          saved_by: 'admin',
          redaction_receipt: expect.objectContaining({ reviewed_by: 'admin' }),
          framework_receipt: expect.objectContaining({ selected_framework_key: 'framework', selected_framework_value: 'Scene to lesson', recorded_by: 'admin' }),
        }),
        practitioner_evidence_history: [expect.objectContaining({ revision_note: evidence.revision_note, previous_packet_version: version })],
      }),
    })
    expect(mocks.eq).toHaveBeenCalledWith('updated_at', version)
  })
  it('returns a rejected packet to review when revised', async () => {
    mocks.single.mockReset().mockResolvedValueOnce({ data: { ...packet, status: 'rejected' } }).mockResolvedValue({ data: packet })
    expect((await patchRequest()).status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'review_ready' }))
    expect(mocks.eq).toHaveBeenCalledWith('status', 'rejected')
  })
  it('requires revision notes and protects evidence saves from concurrent changes', async () => {
    expect((await patchRequest({ evidence: { ...evidence, revision_note: '' }, updated_at: version })).status).toBe(400)
    mocks.single.mockReset().mockResolvedValueOnce({ data: packet }).mockResolvedValue({ data: null })
    expect((await patchRequest()).status).toBe(409)
  })
  it.each([{ ...packet, status: 'approved' }, { ...packet, updated_at: '2026-10-05T00:00:00Z' }])('rejects stale reviews', async data => {
    mocks.single.mockReset().mockResolvedValue({ data })
    expect((await request()).status).toBe(409); expect(mocks.update).not.toHaveBeenCalled()
  })
  it('detects a concurrent change during save', async () => {
    mocks.single.mockReset().mockResolvedValueOnce({ data: packet }).mockResolvedValue({ data: null })
    expect((await request()).status).toBe(409)
  })
  it('returns not found', async () => { mocks.single.mockReset().mockResolvedValue({ data: null }); expect((await request()).status).toBe(404) })
  it('reports save failure', async () => {
    mocks.single.mockReset().mockResolvedValueOnce({ data: packet }).mockResolvedValue({ error: { message: 'private database detail' } })
    const res = await request(); expect(res.status).toBe(500); expect(JSON.stringify(await res.json())).not.toContain('private database detail')
  })
})
