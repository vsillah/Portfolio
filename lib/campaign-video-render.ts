import { getHeyGenDefaults } from './heygen-config'
import { supabaseAdmin } from './supabase'
import { assertCurrentCampaign } from './campaign-video-source'
import { campaignChannel, campaignVideoContext, campaignVideoRenderBinding } from './campaign-video-eligibility'
import { updateSocialQueueWithVersion, assertSocialQueueWritable, assertSocialQueuePublicationClear } from './social-queue-write'
import { reviewRecord } from './social-video-review'

export async function requireCampaignVideoRender(input: {
  socialContentId: unknown; campaignId: unknown; script: string; channel: unknown; avatarId: unknown; voiceId: unknown; templateId?: unknown
}) {
  if (typeof input.socialContentId !== 'string' || !input.socialContentId) throw new Error('Open the linked Social Content item and record its editorial review before rendering a campaign video.')
  const result = await supabaseAdmin.from('social_content_queue').select('*').eq('id', input.socialContentId).single()
  if (result.error || !result.data) throw new Error('Linked Social Content item unavailable.')
  const item = result.data
  assertSocialQueueWritable(item)
  await assertSocialQueuePublicationClear(supabaseAdmin, item.id)
  await assertCurrentCampaign(item)
  const context = campaignVideoContext(item)
  if (context.blockers.length || !context.receipt) throw new Error(context.blockers.join(' ') || 'Record a current production-quality editorial review before render.')
  const defaults = await getHeyGenDefaults()
  if (defaults.avatarId !== context.receipt.avatar_id || defaults.voiceId !== context.receipt.voice_id) throw new Error('Avatar or voice defaults changed. Record a fresh editorial and avatar review.')
  if (input.templateId || context.campaign_id !== input.campaignId || input.script !== context.script
    || campaignChannel(input.channel) !== context.channel || input.avatarId !== context.receipt.avatar_id || input.voiceId !== context.receipt.voice_id)
    throw new Error('Render inputs differ from the approved campaign script, channel, avatar, or voice. Template overrides require a separate qualified binding.')
  return item
}

export async function bindCampaignVideoRender(item: Record<string, any> & { id: string }, jobId: string) {
  const rag = reviewRecord(item.rag_context)
  const binding = campaignVideoRenderBinding(item, jobId)
  try {
    await updateSocialQueueWithVersion(supabaseAdmin, item, { rag_context: { ...rag,
      campaign_video_bindings: { ...reviewRecord(rag.campaign_video_bindings), [jobId]: binding },
    } })
  } catch {
    throw new Error(`Render job ${jobId} was created, but its campaign binding was not saved. Keep it ineligible; open Video Generation and reconcile the Social Content conflict before any retry.`)
  }
}
