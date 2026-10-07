// Isolated in-memory adapter for real route tests. Never imported by application code.
export const user = { id: 'synthetic-admin', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' }
export const tables: Record<string, any[]> = {}
export let loseUpdate = false
export const setLoseUpdate = (value: boolean) => { loseUpdate = value }
export function reset() {
  loseUpdate = false
  const id = 'video-review-qa', calendarId = 'calendar-qa', workId = 'work-qa', campaignId = 'campaign-qa'
  tables.social_content_queue = [{ id, status: 'draft', updated_at: '2026-10-06T00:00:00.000Z', created_at: '2026-10-06T00:00:00.000Z', post_text: 'The original draft waits here for review.', topic_extracted: 'A clearer approval path', cta_text: null, cta_url: null, hashtags: [], platform: 'instagram', target_platforms: ['instagram'], content_format: 'text', publishes: [], rag_context: { source: 'social_content_calendar_authorization', calendar_item_id: calendarId, campaign_id: campaignId } }]
  tables.social_content_calendar_items = [{ id: calendarId, social_content_id: id, campaign_id: campaignId, channel: 'instagram_reels', authorization_status: 'authorized', metadata: { platform_draft_handoff: { work_item_id: workId } } }]
  tables.agent_work_items = [{ id: workId, source_type: 'social_content_calendar_authorization', metadata: { draft_handoff_only: true, social_content_id: id, calendar_item_id: calendarId, campaign_id: campaignId, channel_lanes: { linkedin: { status: 'approved', draft_packet: { channel: 'linkedin', approval_status: 'approved', decided_at: '2026-10-06', shared_source: { social_content_id: id, work_item_id: workId, calendar_item_id: calendarId, campaign_id: campaignId }, fields: { post_text: 'A team can finish the work and still lose time waiting for a decision.\n\nMake the handoff visible. Name the reviewer. Keep the evidence beside the draft.', cta: 'Where does your workflow wait?', hashtags: ['#Workflow', '#ProductManagement'], claim_boundaries: ['Synthetic example; no customer outcomes claimed.'] }, enrichment_receipt: { status: 'passed', voice: 'synthetic receipt', editorial: 'synthetic receipt' }, source_research_patterns: [{ id: 'synthetic-evidence' }] } } } } }]
  tables.video_generation_jobs = [1, 2].map(n => ({ id: `${n}${'1'.repeat(7)}-1111-4111-8111-111111111111`, heygen_status: 'completed', updated_at: `2026-10-06T0${n}:00:00Z`, video_url: `https://media.example.invalid/review-${n}.mp4`, thumbnail_url: null, deleted_at: null }))
}
export const verifyAdmin = async () => ({ user })
export const isAuthError = () => false
export const supabaseAdmin = { from(table: string) {
  let filters: Array<(row: any) => boolean> = [], patch: any, one = false
  const q: any = { select: () => q, eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return q }, single: () => { one = true; return q }, maybeSingle: () => { one = true; return q }, update: (value: any) => { patch = value; return q }, then(resolve: any) {
    if (!tables[table]) throw new Error(`Unexpected fixture table ${table}`)
    const rows = patch && loseUpdate ? [] : tables[table].filter(row => filters.every(f => f(row)))
    if (patch) rows.forEach(row => Object.assign(row, structuredClone(patch)))
    return Promise.resolve(resolve({ data: structuredClone(one ? rows[0] ?? null : rows), error: null }))
  } }; return q
} }
reset()
