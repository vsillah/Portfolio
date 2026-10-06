import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), update: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: m.auth, isAuthError: (r: { error?: string }) => !!r.error }))
vi.mock('@/lib/agent-work-items', () => ({ getAgentWorkItem: m.get, updateAgentWorkItemMetadata: m.update }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: m.from } }))
import { POST } from './route'
let work: any, calendar: any, packets: any[]
const call = () => POST(new Request('http://localhost/link', { method: 'POST', body: JSON.stringify({ mode: 'link_approved', packet_ids: ['p1', 'p1'], decision_note: 'Use public structure only' }) }) as never, { params: { id: 'w1' } })
beforeEach(() => {
 vi.clearAllMocks()
 work = { id: 'w1', source_type: 'social_content_calendar_authorization', metadata: { draft_handoff_only: true, calendar_item_id: 'c1', campaign_id: 'campaign', social_content_id: 's1', channel: 'linkedin', campaign_phase: 'teach', external_execution_enabled: false } }
 calendar = { ...work.metadata, id: 'c1', title: 'Readiness', authorization_status: 'authorized', metadata: { platform_draft_handoff: { work_item_id: 'w1' } } }
 packets = [{ id: 'p1', status: 'approved', pattern_status: 'usable_framework', source_url: 'https://example.com/framework', pattern_packet: { hook: 'Question' } }]
 m.auth.mockResolvedValue({ user: { id: 'admin' } }); m.get.mockImplementation(async () => work)
 m.update.mockImplementation(async ({ metadata }) => { work = { ...work, metadata }; return work })
 m.from.mockImplementation(table => {
  if (table === 'social_content_research_packets') return { select: () => ({ in: async () => ({ data: packets, error: null }) }) }
  if (table === 'social_content_calendar_items') return { select: () => ({ eq: () => ({ single: async () => ({ data: calendar, error: null }) }) }) }
  throw new Error('Unexpected table')
 })
})
describe('campaign research targets', () => {
 it('links idempotently with compact provenance and all external side effects false', async () => {
  expect((await call()).status).toBe(200); const result = await (await call()).json()
  expect(result.linked_packet_ids).toEqual(['p1']); expect(result.approved_research_patterns).toHaveLength(1)
  expect(result.work_item.metadata.research_patterns_decision_note).toBe('Use public structure only')
  expect(Object.values(result.side_effects)).toEqual([false, false, false, false, false])
  expect(work.metadata.external_execution_enabled).toBe(false)
 })
 it.each(['channel', 'campaign_phase', 'campaign_id', 'social_content_id'])('rejects stale %s before writing', async field => {
  calendar[field] = 'changed'; expect((await call()).status).toBe(409); expect(m.update).not.toHaveBeenCalled()
 })
 it('rejects unrelated targets and missing campaign lineage', async () => {
  work.source_type = 'other'; expect((await call()).status).toBe(400)
  work.source_type = 'social_content_calendar_authorization'; delete work.metadata.campaign_id
  expect((await call()).status).toBe(400); expect(m.from).not.toHaveBeenCalled()
 })
 it('requires admin auth before reading', async () => {
  m.auth.mockResolvedValue({ error: 'Unauthorized', status: 401 }); expect((await call()).status).toBe(401); expect(m.get).not.toHaveBeenCalled()
 })
 it.each(['review_ready', 'rejected', 'archived'])('does not approve %s packets implicitly', async status => {
  packets[0].status = status; expect((await call()).status).toBe(400); expect(m.update).not.toHaveBeenCalled()
 })
})
