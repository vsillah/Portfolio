import { describe, expect, it, vi } from 'vitest'
import {
  isDemoSeedKey,
  runDemoSeed,
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
})
