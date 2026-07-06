import { describe, expect, it, vi } from 'vitest'
import {
  ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
  ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_SLUG,
  ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX,
  isDemoSeedKey,
  runDemoSeed,
  SOCIAL_CHANNEL_REVIEW_FIXTURE_IDEMPOTENCY_KEY,
  SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY,
  SOCIAL_CONTENT_CALENDAR_FIXTURE_KEY,
  SOCIAL_CONTENT_CALENDAR_FIXTURE_SLUG,
} from './admin-demo-seed'

describe('admin demo seed', () => {
  it('creates a safe Social Content calendar fixture', async () => {
    const inserts: Record<string, unknown[]> = {}

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'attraction_campaigns') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
            insert: vi.fn((row: Record<string, unknown>) => {
              inserts[table] = [row]
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: 'campaign-fixture-1',
                      name: row.name,
                      slug: row.slug,
                      starts_at: row.starts_at,
                      ends_at: row.ends_at,
                    },
                    error: null,
                  })),
                })),
              }
            }),
          }
        }

        if (table === 'social_content_calendar_items') {
          return {
            delete: vi.fn(() => ({
              contains: vi.fn(async () => ({ data: [], error: null })),
            })),
            insert: vi.fn(async (rows: unknown[]) => {
              inserts[table] = rows
              return { error: null }
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    }

    const result = await runDemoSeed('social_content_calendar_fixture', supabase as never)

    expect(result).toMatchObject({
      ok: true,
      key: 'social_content_calendar_fixture',
    })
    expect(isDemoSeedKey('social_content_calendar_fixture')).toBe(true)
    expect(inserts.attraction_campaigns[0]).toMatchObject({
      slug: SOCIAL_CONTENT_CALENDAR_FIXTURE_SLUG,
      status: 'draft',
      campaign_type: 'free_challenge',
    })

    const rows = inserts.social_content_calendar_items as Array<Record<string, unknown>>
    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.campaign_phase)).toEqual(['tease', 'teach', 'proof', 'offer'])
    expect(rows.map((row) => row.channel)).toEqual([
      'linkedin',
      'youtube_shorts',
      'instagram_reels',
      'tiktok',
    ])
    expect(rows.some((row) => row.authorization_status === 'rejected')).toBe(true)
    rows.forEach((row) => {
      expect(row).toMatchObject({
        campaign_id: 'campaign-fixture-1',
        autonomy_eligible: false,
      })
      expect(row.metadata).toMatchObject({
        demo_seed_key: SOCIAL_CONTENT_CALENDAR_FIXTURE_KEY,
        external_execution_enabled: false,
        provider_generation_enabled: false,
        publish_enabled: false,
      })
    })
  })

  it('creates a safe Social Channel review fixture', async () => {
    const inserts: Record<string, unknown[]> = {}
    const deletes: Array<{ table: string; matcher: string }> = []

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'agent_work_items') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(async (_column: string, matcher: string) => {
                deletes.push({ table, matcher })
                return { data: [], error: null }
              }),
            })),
            insert: vi.fn((row: Record<string, unknown>) => {
              inserts[table] = [row]
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: 'work-social-review-1' },
                    error: null,
                  })),
                })),
              }
            }),
          }
        }

        if (table === 'social_content_research_packets') {
          return {
            delete: vi.fn(() => ({
              contains: vi.fn(async (_column: string, matcher: Record<string, unknown>) => {
                deletes.push({ table, matcher: String(matcher.demo_seed_key) })
                return { data: [], error: null }
              }),
            })),
            insert: vi.fn((row: Record<string, unknown>) => {
              inserts[table] = [row]
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: 'packet-social-review-1' },
                    error: null,
                  })),
                })),
              }
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    }

    const result = await runDemoSeed('social_channel_review_fixture', supabase as never)

    expect(result).toMatchObject({
      ok: true,
      key: 'social_channel_review_fixture',
    })
    expect(isDemoSeedKey('social_channel_review_fixture')).toBe(true)
    expect(deletes).toEqual(expect.arrayContaining([
      { table: 'agent_work_items', matcher: SOCIAL_CHANNEL_REVIEW_FIXTURE_IDEMPOTENCY_KEY },
      { table: 'social_content_research_packets', matcher: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY },
    ]))

    expect(inserts.social_content_research_packets[0]).toMatchObject({
      platform: 'youtube',
      pattern_status: 'needs_brand_translation',
      status: 'review_ready',
      actor_metadata: {
        demo_seed_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY,
        external_execution_enabled: false,
      },
      privacy_notes: expect.stringContaining('No private meetings'),
    })

    const workItem = inserts.agent_work_items[0] as Record<string, unknown>
    expect(workItem).toMatchObject({
      source_type: 'social_topic_trigger',
      idempotency_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_IDEMPOTENCY_KEY,
      owner_agent_key: 'chief-of-staff',
      owner_runtime: 'manual',
      metadata: expect.objectContaining({
        demo_seed_key: SOCIAL_CHANNEL_REVIEW_FIXTURE_KEY,
        suggested_research_packet_ids: ['packet-social-review-1'],
        side_effects: {
          provider_generation: false,
          upload: false,
          publish: false,
          schedule: false,
          external_post: false,
        },
      }),
    })
    const metadata = workItem.metadata as Record<string, unknown>
    const channelLanes = metadata.channel_lanes as Record<string, Record<string, unknown>>
    expect(channelLanes.linkedin.status).toBe('selected')
    expect(channelLanes.youtube_shorts.status).toBe('not_started')
    expect(channelLanes.instagram_reels.status).toBe('not_started')
    expect(channelLanes.tiktok.status).toBe('not_started')
    expect((metadata.insight as Record<string, unknown>).approved_research_patterns).toEqual([])
  })

  it('creates a review-ready Accelerated Workshop whisper-to-shout campaign fixture', async () => {
    const inserts: Record<string, unknown[]> = {}
    const deletes: Array<{ table: string; matcher: string }> = []

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'attraction_campaigns') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async (_column: string, matcher: string) => {
                deletes.push({ table, matcher })
                return { data: [], error: null }
              }),
            })),
            insert: vi.fn((row: Record<string, unknown>) => {
              inserts[table] = [row]
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: 'campaign-accelerated-1',
                      name: row.name,
                      slug: row.slug,
                      starts_at: row.starts_at,
                      ends_at: row.ends_at,
                    },
                    error: null,
                  })),
                })),
              }
            }),
          }
        }

        if (table === 'social_content_research_packets') {
          return {
            delete: vi.fn(() => ({
              contains: vi.fn(async (_column: string, matcher: Record<string, unknown>) => {
                deletes.push({ table, matcher: String(matcher.demo_seed_key) })
                return { data: [], error: null }
              }),
            })),
            insert: vi.fn((row: Record<string, unknown>) => {
              inserts[table] = [row]
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: 'packet-accelerated-1' },
                    error: null,
                  })),
                })),
              }
            }),
          }
        }

        if (table === 'agent_work_items') {
          return {
            delete: vi.fn(() => ({
              like: vi.fn(async (_column: string, matcher: string) => {
                deletes.push({ table, matcher })
                return { data: [], error: null }
              }),
            })),
            insert: vi.fn((payload: unknown[] | Record<string, unknown>) => {
              const rows = Array.isArray(payload) ? payload : [payload]
              inserts[table] = [...(inserts[table] ?? []), ...rows]
              if (!Array.isArray(payload)) {
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: { id: 'work-accelerated-goal' },
                      error: null,
                    })),
                  })),
                }
              }
              return {
                select: vi.fn(async () => ({
                  data: rows.map((row, index) => ({
                    id: `work-accelerated-${index + 1}`,
                    metadata: (row as Record<string, unknown>).metadata,
                  })),
                  error: null,
                })),
              }
            }),
          }
        }

        if (table === 'social_content_calendar_items') {
          return {
            delete: vi.fn(() => ({
              contains: vi.fn(async (_column: string, matcher: Record<string, unknown>) => {
                deletes.push({ table, matcher: String(matcher.demo_seed_key) })
                return { data: [], error: null }
              }),
              eq: vi.fn(async (_column: string, matcher: string) => {
                deletes.push({ table, matcher })
                return { data: [], error: null }
              }),
            })),
            insert: vi.fn(async (rows: unknown[]) => {
              inserts[table] = rows
              return { error: null }
            }),
          }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    }

    const result = await runDemoSeed('accelerated_workshop_campaign_fixture', supabase as never)

    expect(result).toMatchObject({
      ok: true,
      key: 'accelerated_workshop_campaign_fixture',
    })
    expect(isDemoSeedKey('accelerated_workshop_campaign_fixture')).toBe(true)
    expect(deletes).toEqual(expect.arrayContaining([
      { table: 'agent_work_items', matcher: `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:%` },
      { table: 'social_content_research_packets', matcher: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY },
    ]))

    expect(inserts.attraction_campaigns[0]).toMatchObject({
      name: 'Accelerated Workshop Whisper-to-Shout Campaign',
      slug: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_SLUG,
      status: 'draft',
    })

    expect(inserts.social_content_research_packets[0]).toMatchObject({
      source_url: 'https://amadutown.com/ebook/accelerated',
      pattern_status: 'usable_framework',
      status: 'review_ready',
      actor_metadata: {
        demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
        external_execution_enabled: false,
      },
      privacy_notes: expect.stringContaining('No provider calls'),
    })

    const allWorkItems = inserts.agent_work_items as Array<Record<string, unknown>>
    expect(allWorkItems).toHaveLength(5)
    expect(allWorkItems[0]).toMatchObject({
      title: 'Launch Accelerated Workshop proof campaign',
      source_type: 'campaign_goal',
      idempotency_key: `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:goal`,
      metadata: {
        social_campaign_goal: true,
        campaign_template_key: 'whisper_to_shout',
        campaign_window_days: 14,
      },
    })
    const workItems = allWorkItems.slice(1)
    expect(workItems.map((item) => item.idempotency_key)).toEqual([
      `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:tease`,
      `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:teach`,
      `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:proof`,
      `${ACCELERATED_WORKSHOP_CAMPAIGN_IDEMPOTENCY_PREFIX}:offer`,
    ])
    workItems.forEach((item) => {
      const metadata = item.metadata as Record<string, unknown>
      const lanes = metadata.channel_lanes as Record<string, Record<string, unknown>>
      const insight = metadata.insight as Record<string, unknown>
      expect(metadata).toMatchObject({
        demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
        campaign_template_key: 'whisper_to_shout',
        campaign_window_days: 14,
        side_effects: {
          provider_generation: false,
          upload: false,
          publish: false,
          schedule: false,
          external_post: false,
        },
      })
      expect(item.parent_work_item_id).toBe('work-accelerated-goal')
      expect(item.dependency_ids).toEqual(['work-accelerated-goal'])
      expect((insight.approved_research_patterns as unknown[])).toHaveLength(1)
      expect(lanes.linkedin.status).toBe('in_review')
      expect(lanes.youtube_shorts.status).toBe('in_review')
      expect(lanes.thumbnail.status).toBe('in_review')
      expect(lanes.instagram_reels.status).toBe('in_review')
      expect(lanes.tiktok.status).toBe('in_review')
      expect((lanes.linkedin.draft_packet as Record<string, unknown>).side_effects).toMatchObject({
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      })
      expect((lanes.thumbnail.draft_packet as Record<string, unknown>).fields).toMatchObject({
        approval_state: 'in_review',
      })
      expect((lanes.tiktok.draft_packet as Record<string, unknown>).fields).toMatchObject({
        audio_rights: expect.stringContaining('platform-safe audio'),
      })
    })

    const calendarRows = inserts.social_content_calendar_items as Array<Record<string, unknown>>
    expect(calendarRows).toHaveLength(8)
    const primaryRows = calendarRows.filter((row) => {
      const metadata = row.metadata as Record<string, unknown>
      return metadata.calendar_item_role === 'primary_phase_item'
    })
    const youtubeRows = calendarRows.filter((row) => row.channel === 'youtube_shorts')
    expect(primaryRows).toHaveLength(4)
    expect(youtubeRows).toHaveLength(4)
    expect(primaryRows.map((row) => row.campaign_phase)).toEqual(['tease', 'teach', 'proof', 'offer'])
    expect(primaryRows.every((row) => row.channel === 'linkedin')).toBe(true)
    expect(primaryRows.map((row) => row.agent_work_item_id)).toEqual([
      'work-accelerated-1',
      'work-accelerated-2',
      'work-accelerated-3',
      'work-accelerated-4',
    ])
    calendarRows.forEach((row) => {
      expect(row).toMatchObject({
        campaign_id: 'campaign-accelerated-1',
        authorization_status: 'pending',
        autonomy_eligible: false,
      })
      expect(row.metadata).toMatchObject({
        demo_seed_key: ACCELERATED_WORKSHOP_CAMPAIGN_FIXTURE_KEY,
        campaign_template_key: 'whisper_to_shout',
        external_execution_enabled: false,
        provider_generation_enabled: false,
        upload_enabled: false,
        publish_enabled: false,
        schedule_enabled: false,
      })
    })
    primaryRows.forEach((row) => {
      expect(row.metadata).toMatchObject({
        calendar_item_role: 'primary_phase_item',
        channel_draft_targets: ['linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'],
      })
    })
    youtubeRows.forEach((row) => {
      expect(row.metadata).toMatchObject({
        calendar_item_role: 'companion_channel_item',
        primary_channel: 'linkedin',
        channel_draft_targets: ['youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'],
      })
    })
  })
})
