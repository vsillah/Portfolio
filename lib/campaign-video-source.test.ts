import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('./supabase', async () => import('../scripts/qa/campaign-video-fixture'))

import { assertCurrentCampaign, preview } from './campaign-video-source'
import { requireCampaignVideoRender } from './campaign-video-render'
import { SCRIPT, reset, supabaseAdmin, tables } from '../scripts/qa/campaign-video-fixture'

const originalFrom = supabaseAdmin.from
const item = () => tables.social_content_queue[0]
const renderInput = () => ({
  socialContentId: 'video-review-qa',
  campaignId: 'campaign-qa',
  script: SCRIPT,
  channel: 'linkedin_video',
  avatarId: 'synthetic-avatar',
  voiceId: 'synthetic-voice',
})

function failedRead(message: string) {
  const query: {
    select: () => typeof query
    eq: () => typeof query
    single: () => typeof query
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>
  } = {
    select: () => query,
    eq: () => query,
    single: () => query,
    then: (resolve) => Promise.resolve(resolve({ data: null, error: { message } })),
  }
  return query
}

beforeEach(() => {
  supabaseAdmin.from = originalFrom
  reset()
})

it('accepts only the live synchronized campaign packet', async () => {
  const current = await assertCurrentCampaign(item())
  expect(current).toMatchObject({
    state: 'synchronized',
    source_work_item_id: 'work-qa',
    packet_version: item().rag_context.campaign_review_handoff.packet_version,
  })
  expect(current.packet.approval_status).toBe('approved')
})

it('fails closed before a work-item read when the calendar link is missing or unreadable', async () => {
  item().rag_context = null
  await expect(preview(item())).rejects.toThrow(/^This item has no linked campaign calendar review\.$/)

  reset()
  let workReads = 0
  supabaseAdmin.from = ((table: string) => {
    if (table === 'agent_work_items') workReads += 1
    if (table === 'social_content_calendar_items') return failedRead('relation secret_calendar is missing')
    return originalFrom(table)
  }) as typeof supabaseAdmin.from
  item().rag_context.calendar_item_id = 'missing-calendar'
  await expect(preview(item())).rejects.toThrow(/^Linked calendar item unavailable\.$/)
  expect(workReads).toBe(0)

  supabaseAdmin.from = originalFrom
  await expect(preview(item())).rejects.toThrow(/^Linked calendar item unavailable\.$/)
})

it('fails closed when the linked work item id or row is missing', async () => {
  let workReads = 0
  supabaseAdmin.from = ((table: string) => {
    if (table === 'agent_work_items') workReads += 1
    return originalFrom(table)
  }) as typeof supabaseAdmin.from
  delete tables.social_content_calendar_items[0].metadata.platform_draft_handoff.work_item_id
  await expect(preview(item())).rejects.toThrow(/^Linked campaign work item unavailable\.$/)
  expect(workReads).toBe(0)

  supabaseAdmin.from = ((table: string) => {
    if (table === 'agent_work_items') return failedRead('relation secret_work is missing')
    return originalFrom(table)
  }) as typeof supabaseAdmin.from
  tables.social_content_calendar_items[0].metadata.platform_draft_handoff.work_item_id = 'missing-work'
  await expect(preview(item())).rejects.toThrow(/^Linked campaign work item unavailable\.$/)
})

it('blocks review and render when the live packet drifts or human copy conflicts', async () => {
  const approvedVersion = item().rag_context.campaign_review_handoff.packet_version
  tables.agent_work_items[0].metadata.channel_lanes.linkedin.draft_packet.fields.post_text += ' Updated packet.'
  const drifted = await preview(item())
  expect(drifted.state).toBe('ready')
  expect(drifted.packet_version).not.toBe(approvedVersion)
  await expect(assertCurrentCampaign(item())).rejects.toThrow(
    /^Campaign packet or copy changed\. Compare and synchronize the current approved campaign packet before video review\.$/,
  )
  await expect(requireCampaignVideoRender(renderInput())).rejects.toThrow(
    /^Campaign packet or copy changed\. Compare and synchronize the current approved campaign packet before video review\.$/,
  )

  reset()
  item().post_text = 'A human edit that must stay.'
  expect((await preview(item())).state).toBe('conflict')
  await expect(assertCurrentCampaign(item())).rejects.toThrow(/Campaign packet or copy changed/)
})

it('rejects an unapproved linked packet before version comparison', async () => {
  tables.agent_work_items[0].metadata.channel_lanes.linkedin.draft_packet.approval_status = 'in_review'
  await expect(preview(item())).rejects.toThrow(
    /^Approve the linked LinkedIn campaign packet with passing enrichment before handoff\.$/,
  )
  await expect(requireCampaignVideoRender(renderInput())).rejects.toThrow(
    /^Approve the linked LinkedIn campaign packet with passing enrichment before handoff\.$/,
  )
})
