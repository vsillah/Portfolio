import { describe, expect, it } from 'vitest'
import { ACCELERATED_ACTIVATION_ITEMS, acceleratedCopyHash, evaluateAcceleratedActivation } from './accelerated-campaign-activation'

const id = 'd0046271-92ba-4c7f-a009-197b44562f48'
const expected = ACCELERATED_ACTIVATION_ITEMS[id]
const manifest = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'
const jit = '039488c2ef7fa22f6872617f70060893c49d03ee0936170379a44a2e1f9a18b8'
const item = {
  id, status: 'draft', platform: 'x', target_platforms: ['x'], scheduled_for: null,
  post_text: '\nThe AI produced the brief, roadmap, feature list, and three versions of the message.\n\nThe team still had not named the decision.\n\nMore output can hide an unclear choice.\n\nWhat decision is your team producing around instead of making?\n\nhttps://amadutown.com/accelerated\n',
  cta_text: 'Explore Accelerated', cta_url: 'https://amadutown.com/accelerated', hashtags: [],
  updated_at: '2026-11-16T20:46:14.533851+00:00',
  rag_context: { source: 'social_content_calendar_authorization', campaign_id: 'b160eab6-1a5a-478d-954a-ca59a3a10e34', calendar_item_id: expected.calendarId,
    channel: 'x', scheduled_for: '2026-11-19T17:00:00+00:00', external_execution_enabled: false, publish_gate: 'platform_review_gated' },
}
const calendar = {
  id: expected.calendarId, social_content_id: id, campaign_id: 'b160eab6-1a5a-478d-954a-ca59a3a10e34', channel: 'x',
  scheduled_for: '2026-11-19T17:00:00+00:00', authorization_status: 'authorized', due_status: 'planned',
  metadata: { content_packet_status: 'human_review_ready', primary_cta_url: 'https://amadutown.com/accelerated',
    visual_asset_binding: { kind: 'text_only', primary_asset: null, source_manifest_sha256: manifest }, visual_source_manifest_sha256: manifest,
    visual_human_qa_approved_at: '2026-11-16T20:00:00Z', jit_refresh_status: 'passed_internal_review', jit_refresh_packet_sha256: jit, jit_refreshed_at: '2026-11-16T20:00:00Z',
    review_checks: { source: 'pass_with_jit_refresh', privacy: 'pass', originality: 'pass' },
    external_execution_enabled: false, provider_generation_enabled: false, upload_enabled: false, schedule_enabled: false,
    publish_enabled: false, outreach_send_enabled: false, publish_preparation: { status: 'ready', social_content_id: id, content_version: item.updated_at, prepared_at: '2026-11-16T20:00:00Z' } },
}
const config = { platform: 'x', is_active: true, settings: { connected_account: '@amadutown', profile_handle: 'amadutown', campaign_zero_fee_verified: true, campaign_zero_fee_cap_usd: 0 }, credentials: { access_token: 'test-token', scope: 'tweet.write users.read' } }
const base = { id, item, calendar, config, publishes: [], now: new Date('2026-11-17T00:00:00Z') }

describe('four-record Accelerated activation', () => {
  it('binds the existing X copy, channel, calendar time, and zero-fee account', async () => {
    expect(acceleratedCopyHash(item)).toBe(expected.copyHash)
    const result = await evaluateAcceleratedActivation(base)
    expect(result).toMatchObject({ ready: true, blockers: [], copyHash: expected.copyHash, scheduledFor: expected.scheduledFor })
  })

  it('fails closed on changed copy, another account, duplicate receipt, and unverified fee path', async () => {
    const changed = await evaluateAcceleratedActivation({ ...base, item: { ...item, post_text: `${item.post_text} changed` } })
    expect(changed.blockers).toContain('Approved copy or CTA hash changed.')
    const account = await evaluateAcceleratedActivation({ ...base, config: { ...config, settings: { ...config.settings, connected_account: '@other' } } })
    expect(account.blockers).toContain('Configured AmaduTown account or channel integration is unavailable.')
    const duplicate = await evaluateAcceleratedActivation({ ...base, publishes: [{ status: 'pending', platform: 'x' }] })
    expect(duplicate.blockers).toContain('A schedule or publish receipt already exists.')
    const fee = await evaluateAcceleratedActivation({ ...base, config: { ...config, settings: { connected_account: '@amadutown', profile_handle: 'amadutown' } } })
    expect(fee.blockers).toContain('A verified $0, no-spend execution path is unavailable.')
  })

  it('rejects the wrong record and changed time', async () => {
    expect((await evaluateAcceleratedActivation({ ...base, id: 'other' })).ready).toBe(false)
    const changed = await evaluateAcceleratedActivation({ ...base, calendar: { ...calendar, scheduled_for: '2026-11-19T18:00:00Z' } })
    expect(changed.blockers).toContain('The approved calendar time changed.')
  })
})
