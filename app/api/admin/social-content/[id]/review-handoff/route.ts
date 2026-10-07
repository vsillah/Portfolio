import { hasSocialCopyReleaseEvidence } from '@/lib/social-copy-revision'
import { preview, assertCurrentCampaign } from '@/lib/campaign-video-source'
import { campaignVideoContext, campaignVideoEligibility, prepareCampaignVideoEditorial } from '@/lib/campaign-video-eligibility'
import { getHeyGenDefaults } from '@/lib/heygen-config'
import { nextSocialReleaseVersion } from '@/lib/social-release-safety'
import { videoPlayback } from '@/lib/video-media-archive'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { prepareCampaignReviewHandoff, prepareVideoAttachment, prepareMediaReview } from '@/lib/social-campaign-review-handoff'
import { reviewRecord as record } from '@/lib/social-video-review'
export const dynamic = 'force-dynamic'

async function readItem(id: string) {
  const result = await supabaseAdmin.from('social_content_queue').select('*, publishes:social_content_publishes(*)').eq('id', id).single()
  if (result.error || !result.data) throw new Error('Social Content item unavailable.')
  return result.data
}
async function readJob(id: unknown) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Enter the Video Generation job UUID.')
  const result = await supabaseAdmin.from('video_generation_jobs').select('id,heygen_status,video_url,thumbnail_url,updated_at,deleted_at,script_text,channel,target_type,target_id,avatar_id,voice_id').eq('id', id).single()
  if (result.error || !result.data) throw new Error('Video Generation job unavailable.')
  return { ...result.data, ...await videoPlayback(supabaseAdmin, result.data.video_url) }
}
async function assertCurrentAvatar(job: Record<string, unknown>) {
  const defaults = await getHeyGenDefaults()
  if (!defaults.avatarId || !defaults.voiceId || job.avatar_id !== defaults.avatarId || job.voice_id !== defaults.voiceId) throw new Error('Avatar or voice defaults changed. Record a fresh editorial and avatar review.')
}
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const item = await readItem(params.id)
    const jobId = request.nextUrl.searchParams.get('job_id')
    if (jobId || request.nextUrl.searchParams.has('candidates') || request.nextUrl.searchParams.has('editorial')) {
      let sourceError: string | null = null
      try { await assertCurrentCampaign(item) } catch (e) { sourceError = e instanceof Error ? e.message : 'Campaign review unavailable.' }
      const defaults = await getHeyGenDefaults()
      const qualify = (job: Record<string, unknown>) => {
        const eligibility = campaignVideoEligibility(item, job)
        if (!defaults.avatarId || !defaults.voiceId || job.avatar_id !== defaults.avatarId || job.voice_id !== defaults.voiceId) { eligibility.eligible = false; eligibility.label = 'Ineligible · history only'; eligibility.blockers.push('Avatar or voice defaults changed or are unavailable. Record a fresh editorial and avatar review.') }
        if (sourceError) { eligibility.eligible = false; eligibility.label = 'Ineligible · history only'; eligibility.blockers.unshift(sourceError) }
        return { ...job, eligibility }
      }
      if (jobId) return NextResponse.json({ job: qualify(await readJob(jobId)), target_version: item.updated_at })
      if (request.nextUrl.searchParams.has('editorial')) {
        const context = campaignVideoContext(item)
        if (sourceError) context.blockers.unshift(sourceError)
        return NextResponse.json({ editorial: context, defaults })
      }
      const result = await supabaseAdmin.from('video_generation_jobs').select('id,drive_file_name,created_at,heygen_status,video_url,thumbnail_url,updated_at,deleted_at,script_text,channel,target_type,target_id,avatar_id,voice_id').eq('heygen_status', 'completed').is('deleted_at', null).order('created_at', { ascending: false }).limit(50)
      if (result.error) throw new Error('Video library unavailable.')
      return NextResponse.json({ jobs: await Promise.all((result.data || []).map(async (job: Record<string, unknown>) => qualify({ ...job, ...await videoPlayback(supabaseAdmin, job.video_url) }))) })
    }
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
      if (hasSocialCopyReleaseEvidence(item)) throw new Error('Resolve release or schedule evidence before editing video review.')
      await assertCurrentCampaign(item)
      if (body.action === 'save_video_script') {
        const context = campaignVideoContext(item)
        if (body.input_version !== context.input_version) throw new Error('Script or assets changed. Reload before editing.')
        if (typeof body.script !== 'string' || !body.script.trim() || body.script.trim().length > 5000) throw new Error('Save a spoken script between 1 and 5000 characters.')
        const rag = record(item.rag_context), assets = record(rag.production_assets)
        if (!assets.version) throw new Error('Prepare the production asset packet first.')
        patch = { updated_at: nextSocialReleaseVersion(item.updated_at, Date.parse(now)), rag_context: { ...rag,
          production_assets: { ...assets, video_script: { ...record(assets.video_script), script_text: body.script.trim() } },
          campaign_video_editorial: { ...record(rag.campaign_video_editorial), status: 'pending', invalidation_reason: 'script_changed' },
          media_review: { status: 'pending', invalidation_reason: 'script_changed' }, platform_submission_gate: { status: 'pending', invalidation_reason: 'script_changed' },
        } }
      } else if (body.action === 'approve_editorial') {
        const defaults = await getHeyGenDefaults()
        if (body.avatar_id !== defaults.avatarId || body.voice_id !== defaults.voiceId) throw new Error('Avatar or voice defaults changed. Reload editorial review.')
        const receipt = prepareCampaignVideoEditorial(item, { ...body, avatar_id: defaults.avatarId, voice_id: defaults.voiceId }, auth.user.id, now)
        patch = { updated_at: nextSocialReleaseVersion(item.updated_at, Date.parse(now)), rag_context: { ...record(item.rag_context), campaign_video_editorial: receipt, media_review: { status: 'pending', invalidation_reason: 'editorial_review_changed' } } }
      } else if (body.action === 'attach_video') {
        const job = await readJob(body.job_id)
        await assertCurrentAvatar(job)
        if (body.job_version !== job.updated_at) throw new Error('Video job changed. Preview it again before attaching.')
        patch = prepareVideoAttachment(item, job, auth.user.id, now)
      } else if (body.action === 'approve_media') {
        const job = await readJob(record(record(item.rag_context).reviewed_video_asset).job_id)
        await assertCurrentAvatar(job)
        patch = prepareMediaReview(item, job, body.asset_version, body.privacy_confirmed, auth.user.id, now)
      } else throw new Error('Unknown review action.')
    }
    if (!patch) return NextResponse.json({ success: true, unchanged: true })
    const saved = await supabaseAdmin.from('social_content_queue').update(patch).eq('id', params.id).eq('updated_at', item.updated_at).select('id').maybeSingle()
    if (saved.error || !saved.data) throw new Error('Content changed during review. Reload before retrying; no handoff was confirmed.')
    return NextResponse.json({ success: true, unchanged: false })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Review failed.' }, { status: 409 }) }
}
