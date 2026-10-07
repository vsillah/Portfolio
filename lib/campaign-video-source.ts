import { supabaseAdmin } from './supabase'
import { campaignReviewPreview } from './social-campaign-review-handoff'
import { reviewRecord as record } from './social-video-review'
export async function preview(item: Record<string, any> & { id: string }) {
  const calendarId = record(item.rag_context).calendar_item_id
  if (!calendarId) throw new Error('This item has no linked campaign calendar review.')
  const calendar = await supabaseAdmin.from('social_content_calendar_items').select('*').eq('id', calendarId).single()
  if (calendar.error || !calendar.data) throw new Error('Linked calendar item unavailable.')
  const workId = record(record(calendar.data.metadata).platform_draft_handoff).work_item_id
  if (!workId) throw new Error('Linked campaign work item unavailable.')
  const work = await supabaseAdmin.from('agent_work_items').select('*').eq('id', workId).single()
  if (work.error || !work.data) throw new Error('Linked campaign work item unavailable.')
  return campaignReviewPreview(item, calendar.data, work.data)
}

export async function assertCurrentCampaign(item: Record<string, any> & { id: string }) {
  const current = await preview(item)
  if (record(record(item.rag_context).campaign_review_handoff).packet_version !== current.packet_version || current.state === 'conflict') throw new Error('Campaign packet or copy changed. Compare and synchronize the current approved campaign packet before video review.')
  return current
}
