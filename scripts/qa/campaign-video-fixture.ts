import { buildSocialProductionAssetsPacket } from '../../lib/social-production-assets'
import { campaignVideoRenderBinding, prepareCampaignVideoEditorial } from '../../lib/campaign-video-eligibility'
import { editorialInputVersion, VIDEO_EDITORIAL_CRITERIA } from '../../lib/video-editorial-quality'
import { campaignReviewPreview, prepareCampaignReviewHandoff } from '../../lib/social-campaign-review-handoff'
import { reset as resetHistory, tables } from './linkedin-video-fixture'
export { tables, user, supabaseAdmin, verifyAdmin, isAuthError, setLoseUpdate } from './linkedin-video-fixture'
export const SCRIPT = 'A team can finish the work and still lose time waiting for a decision. I see the burden in the handoff: nobody knows who can say yes. Give that decision a named reviewer and put the evidence beside the draft. Where does your team wait for an answer?'
export function qualify(item: any, calendar: any, work: any, jobs: any[]) {
  const p = campaignReviewPreview(item, calendar, work)
  Object.assign(item, prepareCampaignReviewHandoff(item, p, p.packet_version, item.updated_at, 'synthetic-reviewer', '2026-10-07T00:00:00Z'))
  item.status = 'approved'
  item.rag_context.production_assets = buildSocialProductionAssetsPacket({ contentId: item.id, postText: String(item.post_text), ctaText: null, hashtags: [], imagePrompt: null, frameworkVisualType: null, ragContext: item.rag_context, brollAssets: [{ id: 'synthetic-asset', route: '/admin/social-content', route_description: 'Synthetic workflow', filename: 'fixture.mp4', screenshot_path: null, clip_path: null, captured_at: '2026-10-07' }], chronicleScope: { approved: true, source: 'synthetic', window_label: 'fixture' }, generatedAt: '2026-10-07' })
  item.rag_context.production_assets.video_script.script_text = SCRIPT
  item.rag_context.campaign_video_editorial = prepareCampaignVideoEditorial(item, {
    input_version: editorialInputVersion(item), avatar_id: 'synthetic-avatar', voice_id: 'synthetic-voice',
    checks: Object.fromEntries(Object.keys(VIDEO_EDITORIAL_CRITERIA).map(key => [key, true])),
    notes: 'Synthetic review: the story follows a delayed decision through a named reviewer to a practical question. No numerical or customer outcome claims.',
  }, 'synthetic-reviewer', '2026-10-07T00:00:00Z')
  item.rag_context.campaign_video_bindings = {}
  for (const job of jobs) {
    Object.assign(job, { target_type: 'campaign', target_id: calendar.campaign_id, channel: 'linkedin_video', script_text: SCRIPT, avatar_id: 'synthetic-avatar', voice_id: 'synthetic-voice' })
    item.rag_context.campaign_video_bindings[job.id] = campaignVideoRenderBinding(item, job.id)
  }
}
export function reset() {
  resetHistory()
  qualify(tables.social_content_queue[0], tables.social_content_calendar_items[0], tables.agent_work_items[0], [tables.video_generation_jobs[0]])
  tables.video_generation_jobs[0].drive_file_name = 'Current campaign narrative'
  tables.video_generation_jobs[1].drive_file_name = 'Legacy infrastructure canary'
  tables.heygen_config = [{ asset_type: 'avatar', asset_id: 'synthetic-avatar', is_default: true }, { asset_type: 'voice', asset_id: 'synthetic-voice', is_default: true }]
}
