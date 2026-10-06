import { describe, it, expect } from 'vitest'
import { isCampaignResearchTarget, researchPacketBlocker } from './campaign-research-targets'
describe('research target and packet eligibility', () => {
 it('requires campaign and calendar provenance plus the draft-only marker', () => {
  const t = { source_type: 'social_content_calendar_authorization', metadata: { campaign_id: 'c', calendar_item_id: 'i', draft_handoff_only: true } }
  expect(isCampaignResearchTarget(t)).toBe(true)
  expect(isCampaignResearchTarget({ ...t, source_type: 'other' })).toBe(false)
  expect(isCampaignResearchTarget({ ...t, metadata: { ...t.metadata, draft_handoff_only: false } })).toBe(false)
 })
 it.each(['javascript:alert(1)', '', 'invalid'])('blocks invalid public source %s', source_url => {
  expect(researchPacketBlocker({ status: 'approved', pattern_status: 'usable_framework', source_url, pattern_packet: { hook: 'a' } })).toBeTruthy()
 })
 it('requires a nonempty framework', () => {
  expect(researchPacketBlocker({ status: 'review_ready', pattern_status: 'usable_framework', source_url: 'https://example.com', pattern_packet: {} })).toBeTruthy()
 })
})
