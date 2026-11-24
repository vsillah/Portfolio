import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import packet from '@/agentified/campaign/portfolio-campaign-packet.json'
import { agentifiedCalendarDrafts, agentifiedCalendarRows } from './agentified-calendar-drafts'

describe('Agentified calendar Draft binding', () => {
  const drafts = agentifiedCalendarDrafts()

  it('binds every approved Social Content identity once, in whisper-to-shout order', () => {
    expect(drafts).toHaveLength(10)
    expect(new Set(drafts.map((draft) => draft.id)).size).toBe(10)
    expect(drafts.map((draft) => draft.asset_id)).toEqual(packet.calendar_items.map((item) => item.asset_id))
    expect(drafts.map((draft) => draft.campaign_phase)).toEqual(packet.calendar_items.map((item) => item.campaign_phase))
    expect(drafts.map((draft) => draft.scheduled_for)).toEqual(packet.calendar_items.map((item) => item.scheduled_for))
    expect(drafts.every((draft) => draft.template_key === 'whisper_to_shout')).toBe(true)
  })

  it('preserves channel, CTA, exact copy and raster receipts', () => {
    for (const [index, draft] of drafts.entries()) {
      expect(draft.channel).toBe(packet.calendar_items[index].channel)
      expect(draft.cta_url).toBe('https://amadutown.com/agentified')
      expect(draft.copy).toContain(draft.asset_id)
      expect(draft.copy_sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(draft.packet_sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(draft.media.every((asset) => asset.sha256.match(/^[a-f0-9]{64}$/))).toBe(true)
    }
    expect(drafts.flatMap((draft) => draft.media).length).toBeGreaterThan(20)
    expect(drafts.some((draft) => draft.channel === 'x')).toBe(false)
    expect(drafts.some((draft) => draft.asset_id.startsWith('AW-EMAIL'))).toBe(false)
  })

  it('fails closed on every external action', () => {
    for (const draft of drafts) {
      expect(draft.authorization_status).toBe('draft')
      expect(draft.autonomy_eligible).toBe(false)
      expect(draft.external_execution_enabled).toBe(false)
      expect(draft.gate).toMatch(/Provider.*upload.*schedule.*publish.*send/)
    }
  })

  it('carries exact source and media evidence into the canonical calendar rows', () => {
    const rows = agentifiedCalendarRows()
    expect(rows).toHaveLength(10)
    for (const [index, row] of rows.entries()) {
      expect(row.id).toBe(drafts[index].id)
      expect(row.metadata.approved_source_copy).toBe(drafts[index].copy)
      expect(row.metadata.copy_sha256).toBe(drafts[index].copy_sha256)
      expect(row.metadata.preview_media).toEqual(drafts[index].media)
      expect(row.metadata.external_execution_enabled).toBe(false)
      expect(row.authorization_status).toBe('draft')
    }
  })
})
