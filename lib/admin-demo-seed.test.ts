import { describe, expect, it, vi } from 'vitest'
import {
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
      'thumbnail',
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
    expect((metadata.insight as Record<string, unknown>).approved_research_patterns).toEqual([])
  })
})
