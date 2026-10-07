import { videoPlayback } from '@/lib/video-media-archive'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { campaignReviewPreview, prepareCampaignReviewHandoff, prepareVideoAttachment, prepareMediaReview } from '@/lib/social-campaign-review-handoff'
import { reviewRecord as record } from '@/lib/social-video-review'
export const dynamic = 'force-dynamic'

async function readItem(id: string) {
  const result = await supabaseAdmin.from('social_content_queue').select('*, publishes:social_content_publishes(*)').eq('id', id).single()
  if (result.error || !result.data) throw new Error('Social Content item unavailable.')
  return result.data
}
async function readJob(id: unknown) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Enter the Video Generation job UUID.')
  const result = await supabaseAdmin.from('video_generation_jobs').select('id,heygen_status,video_url,thumbnail_url,updated_at,deleted_at').eq('id', id).single()
  if (result.error || !result.data) throw new Error('Video Generation job unavailable.')
  return { ...result.data, ...await videoPlayback(supabaseAdmin, result.data.video_url) }
}
async function preview(item: Awaited<ReturnType<typeof readItem>>) {
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
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const item = await readItem(params.id)
    const jobId = request.nextUrl.searchParams.get('job_id')
    if (jobId) return NextResponse.json({ job: await readJob(jobId), target_version: item.updated_at })
    return NextResponse.json({ preview: await preview(item) })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Review unavailable.' }, { status: 409 }) }
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json(), item = await readItem(params.id)
    const now = new Date().toISOString()
    let patch: Record<string, unknown> | null
    if (body.action === 'synchronize') {
      patch = prepareCampaignReviewHandoff(item, await preview(item), body.packet_version, body.expected_updated_at, auth.user.id, now)
    } else {
      if (typeof body.expected_updated_at !== 'string' || body.expected_updated_at !== item.updated_at) throw new Error('Content changed. Reload before reviewing the video.')
      if (body.action === 'attach_video') {
        const job = await readJob(body.job_id)
        if (body.job_version !== job.updated_at) throw new Error('Video job changed. Preview it again before attaching.')
        patch = prepareVideoAttachment(item, job, auth.user.id, now)
      } else if (body.action === 'approve_media') {
        const job = await readJob(record(record(item.rag_context).reviewed_video_asset).job_id)
        patch = prepareMediaReview(item, job, body.asset_version, body.privacy_confirmed, auth.user.id, now)
      } else throw new Error('Unknown review action.')
    }
    if (!patch) return NextResponse.json({ success: true, unchanged: true })
    const saved = await supabaseAdmin.from('social_content_queue').update(patch).eq('id', params.id).eq('updated_at', item.updated_at).select('id').maybeSingle()
    if (saved.error || !saved.data) throw new Error('Content changed during review. Reload before retrying; no handoff was confirmed.')
    return NextResponse.json({ success: true, unchanged: false })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Review failed.' }, { status: 409 }) }
}
