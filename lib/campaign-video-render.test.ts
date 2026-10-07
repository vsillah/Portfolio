import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('./supabase', async () => import('../scripts/qa/campaign-video-fixture'))
import { bindCampaignVideoRender, requireCampaignVideoRender } from './campaign-video-render'
import { reset, tables, SCRIPT, setLoseUpdate } from '../scripts/qa/campaign-video-fixture'
beforeEach(reset)
const input = () => ({ socialContentId: 'video-review-qa', campaignId: 'campaign-qa', script: SCRIPT, channel: 'linkedin_video', avatarId: 'synthetic-avatar', voiceId: 'synthetic-voice' })
it('admits only the exact current approved campaign render inputs', async () => {
  expect((await requireCampaignVideoRender(input())).id).toBe('video-review-qa')
  await expect(requireCampaignVideoRender({ ...input(), channel: 'youtube' })).rejects.toThrow('inputs differ')
  await expect(requireCampaignVideoRender({ ...input(), templateId: 'unreviewed-template' })).rejects.toThrow('inputs differ')
  await expect(requireCampaignVideoRender({ ...input(), script: SCRIPT + ' Another ending.' })).rejects.toThrow('inputs differ')
})
it('rejects missing receipts, changed defaults and unlinked campaign requests', async () => {
  await expect(requireCampaignVideoRender({ ...input(), socialContentId: null })).rejects.toThrow('linked Social Content')
  tables.heygen_config[0].asset_id = 'new-avatar'
  await expect(requireCampaignVideoRender(input())).rejects.toThrow('defaults changed')
  delete tables.social_content_queue[0].rag_context.campaign_video_editorial
  await expect(requireCampaignVideoRender(input())).rejects.toThrow('editorial review')
})
it('keeps a job unbound after a lost persistence update and identifies it for reconciliation', async () => {
  const item = await requireCampaignVideoRender(input())
  setLoseUpdate(true)
  await expect(bindCampaignVideoRender(item, 'new-job')).rejects.toThrow('Render job new-job was created')
  expect(tables.social_content_queue[0].rag_context.campaign_video_bindings['new-job']).toBeUndefined()
})
