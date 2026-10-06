// Synthetic, in-memory QA adapter. Never imported by the application.
export const campaignId = 'campaign-review-qa'
export const user = { id: 'synthetic-admin', email: 'qa@example.invalid', aud: 'authenticated', role: 'authenticated' }
export const tables: Record<string, any[]> = {}
export function reset() {
  const now = new Date(), due = new Date(now.getTime() + 5 * 86400000).toISOString()
  Object.assign(tables, { attraction_campaigns: [{ id: campaignId, name: 'Community Workflow Lab', slug: 'community-workflow-lab', status: 'active', campaign_type: 'free_challenge', description: 'Synthetic campaign for internal review QA.', starts_at: now.toISOString(), ends_at: new Date(now.getTime() + 14 * 86400000).toISOString(), completion_window_days: 14, campaign_eligible_bundles: [], campaign_criteria_templates: [] }], social_content_calendar_items: [], agent_work_items: [], social_content_queue: [], social_content_research_packets: [{ id: 'evidence-qa', status: 'approved', pattern_status: 'usable_framework', source_url: 'https://example.invalid/research', title: 'Synthetic framework', pattern_packet: { hook_structure: 'A practical question followed by a workflow checklist.' } }] })
  for (let i = 0; i < 12; i++) {
    const c = { id: `calendar-qa-${i}`, campaign_id: campaignId, title: ['A clearer first workflow', 'Who reviews the handoff?', 'A useful evidence checklist', 'Keep decisions visible'][i % 4] + ` ${i + 1}`, planned_angle: 'Where does a human decision make this workflow more useful?', channel: 'linkedin', campaign_phase: 'teach', social_content_id: `draft-qa-${i}`, authorization_status: i === 10 ? 'pending' : 'authorized', due_status: 'planned', scheduled_for: due, created_at: now.toISOString(), updated_at: 'v1', metadata: { platform_draft_handoff: { work_item_id: `work-qa-${i}` } } }
    tables.social_content_calendar_items.push(c)
    tables.social_content_queue.push({ id: c.social_content_id, status: 'draft', post_text: 'Synthetic review copy', platform: 'linkedin' })
    tables.agent_work_items.push({ id: `work-qa-${i}`, title: c.title, status: 'queued', source_type: 'social_content_calendar_authorization', updated_at: 'v1', metadata: { calendar_item_id: c.id, campaign_id: c.campaign_id, channel: c.channel, campaign_phase: c.campaign_phase, social_content_id: c.social_content_id, draft_handoff_only: true, external_execution_enabled: false, research_packet_ids: i === 11 ? [] : ['evidence-qa'], insight: { title: c.title, content_angle: c.planned_angle, approved_research_patterns: i === 11 ? [] : [{ packet_id: 'evidence-qa' }] } } })
  }
}
export const verifyAdmin = async () => ({ user })
export const isAuthError = () => false
export const supabaseAdmin = { from(table: string) {
  let filters: Array<(r: any) => boolean> = [], update: any, one = false, max = 1000
  const q: any = { select: () => q, eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q }, in: (k: string, v: any[]) => { filters.push(r => v.includes(r[k])); return q }, order: () => q, limit: (n: number) => { max = n; return q }, single: () => { one = true; return q }, update: (v: any) => { update = v; return q }, then(resolve: any) {
    if (!tables[table]) throw new Error('Unexpected QA table: ' + table)
    const rows = tables[table].filter(r => filters.every(f => f(r))).slice(0, max)
    if (update) rows.forEach(r => Object.assign(r, structuredClone(update)))
    return Promise.resolve(resolve({ data: structuredClone(one ? rows[0] : rows), error: null }))
  } }; return q
} }
reset()
