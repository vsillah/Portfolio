import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, writes: [] as any[], fail: false, race: false }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from(table: string) {
  let filters: Array<(r: any) => boolean> = [], update: any, one = false
  const q: any = {
    select: () => q, eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q },
    in: (k: string, v: unknown[]) => { filters.push(r => v.includes(r[k])); return q }, order: () => q, limit: () => q,
    single: () => { one = true; return q }, update: (v: any) => { update = v; return q },
    then(resolve: any) {
      if (!db.tables[table]) throw new Error('Forbidden/unexpected table ' + table)
      if (update && db.fail) return Promise.resolve(resolve({ data: null, error: { message: 'write failed' } }))
      let rows = db.tables[table].filter(r => filters.every(f => f(r)))
      if (update && db.race) { db.race = false; rows = [] }
      if (update) for (const row of rows) { db.writes.push({ table, update }); Object.assign(row, structuredClone(update)) }
      return Promise.resolve(resolve({ data: structuredClone(one ? rows[0] : rows), error: null }))
    },
  }; return q
} } }))
import { getCampaignReviewBacklog, prepareCampaignReviewBatch, saveCampaignReviewCadence } from './campaign-review-backlog'
const now = new Date('2026-10-05T11:00:00Z')
function seed(count = 12) {
  db.writes = []; db.fail = false; db.race = false
  db.tables = { attraction_campaigns: [{ id: 'campaign', name: 'Synthetic campaign', status: 'active' }], social_content_calendar_items: [], agent_work_items: [], social_content_queue: [], social_content_research_packets: [{ id: 'evidence', status: 'approved', pattern_status: 'usable_framework', source_url: 'https://example.test/research', pattern_packet: { hook_structure: 'Question followed by a practical checklist' } }] }
  for (let i = 0; i < count; i++) {
    const c = { id: `calendar-${i}`, campaign_id: 'campaign', title: `Review ${i}`, channel: 'linkedin', campaign_phase: 'teach', social_content_id: `draft-${i}`, authorization_status: 'authorized', due_status: 'planned', scheduled_for: '2026-10-10T12:00:00Z', updated_at: 'v1', metadata: { platform_draft_handoff: { work_item_id: `work-${i}` } } }
    db.tables.social_content_calendar_items.push(c)
    db.tables.social_content_queue.push({ id: c.social_content_id, status: 'draft', post_text: 'Synthetic draft' })
    db.tables.agent_work_items.push({ id: `work-${i}`, source_type: 'social_content_calendar_authorization', updated_at: 'v1', metadata: { calendar_item_id: c.id, campaign_id: c.campaign_id, channel: c.channel, campaign_phase: c.campaign_phase, social_content_id: c.social_content_id, draft_handoff_only: true, research_packet_ids: ['evidence'], insight: { title: c.title, content_angle: 'A practical workflow review', approved_research_patterns: [{ packet_id: 'evidence' }] } } })
  }
  db.tables.social_content_queue.push({
    id: 'published-calibration-1',
    platform: 'linkedin',
    status: 'published',
    post_text: 'A nonprofit operations lead reconciled three spreadsheets every Friday before moving the rules into one reviewed queue.',
    content_pillar: 'AI and product management',
    published_at: '2026-09-25T12:00:00Z',
    updated_at: '2026-09-26T12:00:00Z',
    rag_context: {
      engagement: {
        latest_score: 81,
        recommendation_label: 'high signal',
        latest: { comments: 7, shares: 3, reactions: 28, capturedAt: '2026-09-26T12:00:00Z' },
      },
      content_calibration: {
        reference_curation: { gold_standard: true, reason: 'Operators answered with their own workflow examples.' },
        experiment_tags: {
          experiment_id: 'practitioner-depth-001',
          anecdote_depth: 'scene',
          specificity: 'high',
          evidence_type: 'observed_result',
          hook_framework: 'operational_scene',
          channel: 'linkedin',
          visual_treatment: 'deterministic_constraint_decision_result',
          hypothesis: 'Concrete operating scenes may correlate with substantive comments.',
          causal_claim_boundary: 'correlational_only',
        },
      },
    },
  })
}
describe('campaign rolling review persistence', () => {
  beforeEach(() => seed())
  it('prepares at most five existing channel packets, keeps provenance, and dedupes repeated/concurrent refill', async () => {
    const [a, b] = await Promise.all([prepareCampaignReviewBatch('campaign', { now }), prepareCampaignReviewBatch('campaign', { now })])
    expect(a.prepared_count + b.prepared_count).toBe(5)
    expect((await prepareCampaignReviewBatch('campaign', { now })).prepared_count).toBe(0)
    expect(db.writes).toHaveLength(10)
    expect(db.writes[0].update.updated_at).toMatch(/^202/)
    const meta = db.tables.agent_work_items[0].metadata
    expect(meta.channel_lanes.linkedin.status).toBe('in_review')
    expect(meta.channel_lanes.linkedin.draft_packet.shared_source).toMatchObject({ calendar_item_id: 'calendar-0', campaign_id: 'campaign', social_content_id: 'draft-0', work_item_id: 'work-0', evidence_ids: ['evidence'], channel: 'linkedin' })
    expect(meta.channel_lanes.linkedin.draft_packet.enrichment_receipt).toMatchObject({
      status: 'passed',
      checks: {
        research_frameworks: { status: 'passed' },
        voice_calibration: { status: 'passed' },
        editorial_challenger: { status: 'passed' },
      },
    })
    expect(meta.channel_lanes.linkedin.draft_packet.orchestration_evidence.voice_translation.calibration_application).toMatchObject({
      causal_claim_boundary: 'correlational_only',
      selected_references: [expect.objectContaining({
        id: 'portfolio-social-published-calibration-1',
        engagement_recommendation: expect.stringContaining('high signal'),
        experiment_tags: expect.objectContaining({
          experiment_id: 'practitioner-depth-001',
          causal_claim_boundary: 'correlational_only',
        }),
      })],
    })
    expect(meta.channel_lanes.linkedin.draft_packet.fields.reviewer_trace).toMatchObject({
      calibration_reference_ids: ['portfolio-social-published-calibration-1'],
      calibration_causal_boundary: 'correlational_only',
    })
    expect(meta.rolling_review.linkedin.content_version).toMatch(/^[a-f0-9]{64}$/)
    expect(meta.rolling_review_claims.linkedin.status).toBe('prepared')
    expect(Object.values(meta.side_effects).every(v => v === false)).toBe(true)
    expect(db.tables.social_content_queue[0].status).toBe('draft')
  })
  it('fills Sunday horizon to ten and respects revision day limit of three', async () => {
    const tuesday = await prepareCampaignReviewBatch('campaign', { now: new Date('2026-10-06T12:00:00Z'), scheduled: true })
    expect(tuesday.prepared_count).toBe(3)
    seed(); db.tables.social_content_calendar_items.forEach(c => c.scheduled_for = '2026-10-15T12:00:00Z')
    expect((await prepareCampaignReviewBatch('campaign', { now: new Date('2026-10-11T21:00:00Z'), scheduled: true })).ready).toBe(10)
  })
  it('does not execute before the review window or on Saturday', async () => {
    expect((await prepareCampaignReviewBatch('campaign', { now, scheduled: true })).prepared_count).toBe(0)
    expect((await prepareCampaignReviewBatch('campaign', { now: new Date('2026-10-10T09:00:00Z'), scheduled: true })).prepared_count).toBe(0)
    expect(db.writes).toEqual([])
  })
  it.each(['pending', 'rejected', 'archived'])('fails closed on canonical evidence status %s', async status => {
    db.tables.social_content_research_packets[0].status = status
    expect((await prepareCampaignReviewBatch('campaign', { now })).blocked).toBe(12)
    expect(db.writes).toEqual([])
  })
  it('blocks expired, missing, or unusable evidence and unauthorized lineage', async () => {
    db.tables.social_content_research_packets[0].expires_at = '2026-10-01T00:00:00Z'
    expect((await getCampaignReviewBacklog('campaign', now)).blocked).toBe(12)
    delete db.tables.social_content_research_packets[0].expires_at
    db.tables.social_content_calendar_items[0].authorization_status = 'pending'
    db.tables.agent_work_items[1].metadata.campaign_id = 'other'
    db.tables.agent_work_items[2].metadata.research_packet_ids = ['missing']
    const result = await prepareCampaignReviewBatch('campaign', { now })
    expect(result.blocked).toBe(3)
    expect(result.rows[0].href).toContain('calendar_item=calendar-0')
    expect(db.tables.agent_work_items[0].metadata.channel_lanes).toBeUndefined()
  })
  it('does not overwrite concurrent reviewer changes, reviewed drafts, or hide errors', async () => {
    seed(1); db.race = true
    expect((await prepareCampaignReviewBatch('campaign', { now })).prepared_count).toBe(0)
    db.tables.social_content_queue[0].status = 'approved'
    expect((await prepareCampaignReviewBatch('campaign', { now })).rows[0].state).toBe('reviewed')
    db.tables.social_content_queue[0].status = 'draft'; db.fail = true
    await expect(prepareCampaignReviewBatch('campaign', { now })).rejects.toThrow('write failed')
  })
  it('revalidates changed evidence, reports shortages, honors calendar dates, and keeps dry runs read-only', async () => {
    seed(1); await prepareCampaignReviewBatch('campaign', { now })
    db.tables.social_content_research_packets[0].pattern_packet = { changed: true }
    expect((await getCampaignReviewBacklog('campaign', now)).ready).toBe(0)
    db.tables.social_content_calendar_items[0].metadata.review_due_at = '2026-12-01T00:00:00Z'
    expect((await getCampaignReviewBacklog('campaign', now)).rows).toEqual([])
    seed(2); const result = await prepareCampaignReviewBatch('campaign', { now, dryRun: true })
    expect(result.gap).toBe(10); expect(db.writes).toEqual([])
    expect((await prepareCampaignReviewBatch('campaign', { now })).gap).toBe(8)
  })
  it('saves configuration only in canonical calendar metadata', async () => {
    await saveCampaignReviewCadence('campaign', { target_ready: 7, primary_limit: 2 })
    const result = await prepareCampaignReviewBatch('campaign', { now })
    expect(result.prepared_count).toBe(2); expect(result.config.target_ready).toBe(7)
    expect(db.writes[0].table).toBe('social_content_calendar_items')
  })
  it('preserves a matching existing review packet and blocks changed sources', async () => {
    seed(1); await prepareCampaignReviewBatch('campaign', { now })
    const meta = db.tables.agent_work_items[0].metadata
    const packet = structuredClone(meta.channel_lanes.linkedin.draft_packet)
    delete meta.rolling_review
    expect((await getCampaignReviewBacklog('campaign', now)).ready).toBe(1)
    expect((await prepareCampaignReviewBatch('campaign', { now })).prepared_count).toBe(0)
    expect(meta.channel_lanes.linkedin.draft_packet).toEqual(packet)
    meta.channel_lanes.linkedin.draft_packet.shared_source.campaign_id = 'different'
    expect((await getCampaignReviewBacklog('campaign', now)).blocked).toBe(1)
  })
  it('dedupes shared social drafts and honors campaign boundaries and external locks', async () => {
    seed(3)
    db.tables.social_content_calendar_items[1].social_content_id = 'draft-0'
    db.tables.agent_work_items[1].metadata.social_content_id = 'draft-0'
    db.tables.agent_work_items[2].metadata.external_execution_enabled = true
    expect((await prepareCampaignReviewBatch('campaign', { now })).prepared_count).toBe(1)
    db.tables.attraction_campaigns[0].ends_at = '2026-10-08T00:00:00Z'
    expect((await getCampaignReviewBacklog('campaign', now)).rows).toEqual([])
  })

  it('claims due items in priority order and leaves future trigger times untouched', async () => {
    seed(3)
    db.tables.social_content_calendar_items[0].metadata.review_priority = 'low'
    db.tables.social_content_calendar_items[0].metadata.review_trigger_at = now.toISOString()
    db.tables.social_content_calendar_items[1].metadata.review_priority = 'urgent'
    db.tables.social_content_calendar_items[1].metadata.review_trigger_at = now.toISOString()
    db.tables.social_content_calendar_items[2].metadata.review_priority = 'high'
    db.tables.social_content_calendar_items[2].metadata.review_trigger_at = '2026-10-06T11:00:00Z'

    const result = await prepareCampaignReviewBatch('campaign', {
      now,
      dueOnly: true,
      calendarItemIds: ['calendar-0', 'calendar-1', 'calendar-2'],
    })

    expect(result.prepared_items.map(item => item.calendar_item_id)).toEqual(['calendar-1', 'calendar-0'])
    expect(result.prepared_items.every(item => /^[a-f0-9]{64}$/.test(item.content_version))).toBe(true)
    expect(db.tables.agent_work_items[2].metadata.rolling_review).toBeUndefined()
  })

})
