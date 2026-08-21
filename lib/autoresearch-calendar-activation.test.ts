import { describe, expect, it } from 'vitest'
import {
  activateAutoResearchBacklogItem,
  findAutoResearchBacklogItem,
} from './autoresearch-calendar-activation'
import type { CrossChannelAutoResearchBacklogItem } from './cross-channel-autoresearch-backlog'

type Row = Record<string, unknown> & { id: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function jsonContains(rowValue: unknown, filter: Record<string, unknown>): boolean {
  if (!isRecord(rowValue)) return false
  return Object.entries(filter).every(([key, expected]) => {
    const actual = rowValue[key]
    if (isRecord(expected)) return jsonContains(actual, expected)
    return actual === expected
  })
}

function createFakeAdmin(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    attraction_campaigns: [],
    social_content_queue: [],
    social_content_calendar_items: [],
    ...seed,
  }
  let nextId = 1
  const writes: Array<{ table: string; operation: 'insert' | 'update'; row: Record<string, unknown> }> = []

  function tableApi(table: string) {
    const rows = tables[table] ?? (tables[table] = [])
    const builder = {
      filters: [] as Array<(row: Row) => boolean>,
      select() {
        return builder
      },
      contains(column: string, value: Record<string, unknown>) {
        builder.filters.push((row) => jsonContains(row[column], value))
        return builder
      },
      eq(column: string, value: string) {
        builder.filters.push((row) => row[column] === value)
        return builder
      },
      async maybeSingle() {
        return { data: rows.find((row) => builder.filters.every((filter) => filter(row))) ?? null, error: null }
      },
      insert(row: Record<string, unknown>) {
        return {
          select() {
            return {
              async single() {
                const inserted = { id: `${table}-${nextId++}`, ...row } as Row
                rows.push(inserted)
                writes.push({ table, operation: 'insert', row: inserted })
                return { data: inserted, error: null }
              },
            }
          },
        }
      },
      update(patch: Record<string, unknown>) {
        return {
          eq(column: string, value: string) {
            const target = rows.find((row) => row[column] === value)
            if (target) Object.assign(target, patch)
            writes.push({ table, operation: 'update', row: { [column]: value, ...patch } })
            return Promise.resolve({ data: target ?? null, error: null })
          },
        }
      },
    }
    return builder
  }

  return {
    admin: { from: tableApi },
    tables,
    writes,
  }
}

function requireFixture(id: string): CrossChannelAutoResearchBacklogItem {
  const item = findAutoResearchBacklogItem(id)
  if (!item) throw new Error(`Missing fixture ${id}`)
  return item
}

describe('autoresearch calendar activation', () => {
  it('creates internal social-content and calendar records with no external side effects', async () => {
    const { admin, tables, writes } = createFakeAdmin({
      attraction_campaigns: [{ id: 'campaign-1', slug: 'agentified-trust-scale-2026-07' }],
    })

    const result = await activateAutoResearchBacklogItem({
      admin,
      item: requireFixture('autoresearch-agentified-agt-x-01'),
      actorUserId: 'admin-user',
      channels: ['x'],
      now: new Date('2026-08-21T12:00:00.000Z'),
    })

    expect(result.summary).toMatchObject({
      requested: 1,
      insertedCalendarItems: 1,
      insertedSocialContentRows: 1,
      reusedCalendarItems: 0,
      reusedSocialContentRows: 0,
      blocked: 0,
    })
    expect(result.callable_external_actions).toEqual([])
    expect(result.side_effects).toMatchObject({
      provider_call: false,
      slack_send: false,
      publish: false,
      schedule: false,
      upload: false,
      provider_generation: false,
      external_schedule: false,
      external_post: false,
      social_content_draft_created: true,
      calendar_rows_created: true,
    })
    expect(tables.social_content_queue).toHaveLength(1)
    expect(tables.social_content_queue[0]).toMatchObject({
      platform: 'x',
      status: 'draft',
      scheduled_for: null,
      target_platforms: ['x'],
      rag_context: expect.objectContaining({
        source: 'autoresearch_calendar_activation',
        external_execution_enabled: false,
        autoresearch_activation: expect.objectContaining({
          backlog_item_id: 'autoresearch-agentified-agt-x-01',
          channel: 'x',
        }),
      }),
    })
    expect(tables.social_content_calendar_items[0]).toMatchObject({
      campaign_id: 'campaign-1',
      channel: 'x',
      authorization_status: 'pending',
      autonomy_eligible: false,
      social_content_id: tables.social_content_queue[0].id,
      metadata: expect.objectContaining({
        external_execution_enabled: false,
        gate_ledger: expect.objectContaining({
          final_submission: expect.objectContaining({ state: 'pending' }),
          provider_execution: expect.objectContaining({ state: 'pending' }),
        }),
      }),
    })
    expect(writes.map((write) => `${write.operation}:${write.table}`)).toEqual([
      'insert:social_content_queue',
      'insert:social_content_calendar_items',
    ])
  })

  it('reuses existing Agentified calendar and social rows instead of duplicating them', async () => {
    const { admin, tables } = createFakeAdmin({
      attraction_campaigns: [{ id: 'campaign-1', slug: 'agentified-trust-scale-2026-07' }],
      social_content_calendar_items: [{
        id: 'calendar-existing',
        channel: 'linkedin',
        social_content_id: 'social-existing',
        metadata: {
          agentified_asset_id: 'AGT-LI-01',
          external_execution_enabled: false,
        },
      }],
      social_content_queue: [{
        id: 'social-existing',
        rag_context: {
          agentified_asset_id: 'AGT-LI-01',
          external_execution_enabled: false,
        },
      }],
    })

    const result = await activateAutoResearchBacklogItem({
      admin,
      item: requireFixture('autoresearch-agentified-agt-li-01'),
      actorUserId: 'admin-user',
      channels: ['linkedin'],
      now: new Date('2026-08-21T12:00:00.000Z'),
    })

    expect(result.records[0]).toMatchObject({
      state: 'existing',
      calendarItemId: 'calendar-existing',
      socialContentId: 'social-existing',
      providerBlocked: false,
    })
    expect(result.summary).toMatchObject({
      insertedCalendarItems: 0,
      insertedSocialContentRows: 0,
      reusedCalendarItems: 1,
      reusedSocialContentRows: 1,
    })
    expect(tables.social_content_calendar_items).toHaveLength(1)
    expect(tables.social_content_queue).toHaveLength(1)
  })

  it('keeps TikTok as a future manual calendar candidate without creating a provider draft', async () => {
    const { admin, tables } = createFakeAdmin({
      attraction_campaigns: [{ id: 'campaign-1', slug: 'agentified-trust-scale-2026-07' }],
    })

    const result = await activateAutoResearchBacklogItem({
      admin,
      item: requireFixture('autoresearch-agentified-agt-tiktok-manual-01'),
      actorUserId: 'admin-user',
      channels: ['tiktok'],
      now: new Date('2026-08-21T12:00:00.000Z'),
    })

    expect(result.records[0]).toMatchObject({
      channel: 'tiktok',
      state: 'inserted',
      socialContentId: null,
      providerBlocked: true,
      manualOnly: true,
    })
    expect(result.records[0].reason).toMatch(/developer app\/provider approval/i)
    expect(result.summary).toMatchObject({
      insertedCalendarItems: 1,
      insertedSocialContentRows: 0,
      blocked: 1,
    })
    expect(tables.social_content_queue).toHaveLength(0)
    expect(tables.social_content_calendar_items[0]).toMatchObject({
      channel: 'tiktok',
      authorization_status: 'pending',
      social_content_id: null,
      metadata: expect.objectContaining({
        provider_blocked: true,
        manual_only: true,
        external_execution_enabled: false,
      }),
    })
  })

  it('does not write durable rows when source basis is blocked', async () => {
    const item = structuredClone(requireFixture('autoresearch-agentified-agt-x-01'))
    item.gates = item.gates.map((gate) => (
      gate.key === 'source_basis'
        ? { ...gate, state: 'blocked' as const }
        : gate
    ))
    const { admin, tables, writes } = createFakeAdmin()

    const result = await activateAutoResearchBacklogItem({
      admin,
      item,
      actorUserId: 'admin-user',
      channels: ['x'],
      now: new Date('2026-08-21T12:00:00.000Z'),
    })

    expect(result.records[0]).toMatchObject({
      state: 'blocked',
      calendarItemId: null,
      socialContentId: null,
    })
    expect(result.summary.blocked).toBe(1)
    expect(tables.social_content_queue).toHaveLength(0)
    expect(tables.social_content_calendar_items).toHaveLength(0)
    expect(writes).toHaveLength(0)
  })
})
