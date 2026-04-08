import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HeyGenConfigRow, SyncResult } from './heygen-config'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listAvatars: vi.fn(),
  listVoices: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('./heygen', () => ({
  listAvatars: mocks.listAvatars,
  listVoices: mocks.listVoices,
}))

import { getHeyGenConfigByType, recordHeyGenSyncResult, syncFromHeyGen } from './heygen-config'

function makeConfigRow(index: number): HeyGenConfigRow {
  return {
    id: `row-${index}`,
    asset_type: 'avatar',
    asset_id: `asset-${index}`,
    asset_name: `Asset ${index}`,
    is_default: false,
    is_favorite: false,
    metadata: {},
    synced_at: '2026-04-01T00:00:00.000Z',
  }
}

describe('heygen-config', () => {
  beforeEach(() => {
    mocks.from.mockReset()
    mocks.listAvatars.mockReset()
    mocks.listVoices.mockReset()
  })

  it('paginates past 1000 rows when loading config by type', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => makeConfigRow(i))
    const page2 = Array.from({ length: 2 }, (_, i) => makeConfigRow(i + 1000))

    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 })

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    }

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'heygen_config') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return query
    })

    const rows = await getHeyGenConfigByType('avatar')

    expect(rows).toHaveLength(1002)
    expect(rows[0].id).toBe('row-0')
    expect(rows[1001].id).toBe('row-1001')
    expect(range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('deduplicates IDs before batched upserts and surfaces batch errors', async () => {
    const avatars = Array.from({ length: 202 }, (_, i) => ({
      id: `avatar-${i}`,
      name: `Avatar ${i}`,
      type: 'avatar' as const,
    }))
    avatars.push({
      id: 'avatar-10',
      name: 'Avatar 10 updated',
      type: 'avatar' as const,
    })

    mocks.listAvatars.mockResolvedValue({
      avatars,
      error: null,
    })
    mocks.listVoices.mockResolvedValue({
      voices: [
        { id: 'voice-1', name: 'Voice 1', language: 'en', gender: 'male' },
        { id: 'voice-2', name: 'Voice 2', language: 'en', gender: 'female' },
      ],
      error: null,
    })

    let upsertCall = 0
    const upsert = vi.fn().mockImplementation(async () => {
      upsertCall += 1
      if (upsertCall === 2) {
        return { error: { message: 'temporary write failure' } }
      }
      return { error: null }
    })

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'heygen_config') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return { upsert }
    })

    const result = await syncFromHeyGen()

    expect(result.avatarsSynced).toBe(200)
    expect(result.voicesSynced).toBe(2)
    expect(result.error).toContain('Avatar upsert: temporary write failure')
    expect(upsert).toHaveBeenCalledTimes(3)

    const firstAvatarBatch = upsert.mock.calls[0][0] as Array<{ asset_id: string; asset_name: string }>
    const secondAvatarBatch = upsert.mock.calls[1][0] as Array<{ asset_id: string; asset_name: string }>
    const dedupedAvatarRows = [...firstAvatarBatch, ...secondAvatarBatch]

    expect(dedupedAvatarRows).toHaveLength(202)
    expect(new Set(dedupedAvatarRows.map((row) => row.asset_id)).size).toBe(202)
    expect(dedupedAvatarRows.find((row) => row.asset_id === 'avatar-10')?.asset_name).toBe('Avatar 10 updated')
  })

  it('returns combined upstream errors without writing config rows', async () => {
    mocks.listAvatars.mockResolvedValue({
      avatars: [],
      error: 'avatars API unavailable',
    })
    mocks.listVoices.mockResolvedValue({
      voices: [],
      error: 'voices API unavailable',
    })

    const result = await syncFromHeyGen()

    expect(result).toEqual<SyncResult>({
      avatarsSynced: 0,
      voicesSynced: 0,
      error: 'Avatars: avatars API unavailable; Voices: voices API unavailable',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('records singleton sync status with success=false when sync had errors', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'heygen_sync_state') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return { upsert }
    })

    await recordHeyGenSyncResult({
      avatarsSynced: 3,
      voicesSynced: 1,
      error: 'partial sync failed',
    })

    expect(upsert).toHaveBeenCalledTimes(1)
    const [payload, options] = upsert.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
    expect(payload.id).toBe('singleton')
    expect(payload.success).toBe(false)
    expect(payload.avatars_synced).toBe(3)
    expect(payload.voices_synced).toBe(1)
    expect(payload.error_message).toBe('partial sync failed')
    expect(payload.synced_at).toEqual(expect.any(String))
    expect(payload.updated_at).toEqual(expect.any(String))
    expect(options).toEqual({ onConflict: 'id' })
  })
})
