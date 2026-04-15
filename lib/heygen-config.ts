/**
 * HeyGen configuration management — syncs avatars/voices from HeyGen API
 * into heygen_config table and provides default asset resolution.
 *
 * DB defaults take precedence over env vars. Env vars serve as fallback
 * when no DB default is set (backwards compatibility).
 */

import { supabaseAdmin } from './supabase'
import { listAvatars, listVoices } from './heygen'

export interface HeyGenDefaults {
  avatarId: string | null
  voiceId: string | null
}

export interface HeyGenConfigRow {
  id: string
  asset_type: 'avatar' | 'voice'
  asset_id: string
  asset_name: string
  is_default: boolean
  is_favorite: boolean
  metadata: Record<string, unknown>
  synced_at: string
}

export interface SyncResult {
  avatarsSynced: number
  voicesSynced: number
  error: string | null
}

/** Single-row table `heygen_sync_state` — last catalog sync metadata for admin UI. */
export interface HeyGenSyncStateRow {
  synced_at: string
  success: boolean
  avatars_synced: number
  voices_synced: number
  error_message: string | null
}

/**
 * Persist the outcome of the last sync run (for timestamps and admin status lines).
 */
export async function recordHeyGenSyncResult(result: SyncResult): Promise<void> {
  if (!supabaseAdmin) return

  const now = new Date().toISOString()
  await supabaseAdmin.from('heygen_sync_state').upsert(
    {
      id: 'singleton',
      synced_at: now,
      success: result.error === null,
      avatars_synced: result.avatarsSynced,
      voices_synced: result.voicesSynced,
      error_message: result.error,
      updated_at: now,
    },
    { onConflict: 'id' }
  )
}

/**
 * Read last sync metadata (null if table empty / migration not applied).
 */
const HEYGEN_CHARACTER_KIND_KEY = 'heygenCharacterKind' as const

/**
 * How HeyGen /v2/video/generate expects the selected character id (avatar_id vs talking_photo_id).
 * Env-only defaults are always treated as standard avatars.
 */
export async function getAvatarCharacterKindForHeyGen(
  avatarId: string | null | undefined
): Promise<'avatar' | 'talking_photo'> {
  if (!avatarId?.trim() || !supabaseAdmin) return 'avatar'

  const { data, error } = await supabaseAdmin
    .from('heygen_config')
    .select('metadata')
    .eq('asset_type', 'avatar')
    .eq('asset_id', avatarId.trim())
    .maybeSingle()

  if (error || !data?.metadata || typeof data.metadata !== 'object') return 'avatar'
  const kind = (data.metadata as Record<string, unknown>)[HEYGEN_CHARACTER_KIND_KEY]
  return kind === 'talking_photo' ? 'talking_photo' : 'avatar'
}

export async function getHeyGenSyncState(): Promise<HeyGenSyncStateRow | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('heygen_sync_state')
    .select('synced_at, success, avatars_synced, voices_synced, error_message')
    .eq('id', 'singleton')
    .maybeSingle()

  if (error || !data) return null
  return data as HeyGenSyncStateRow
}

/**
 * Get the default avatar and voice IDs.
 * Priority: DB is_default=true → env var fallback → null
 */
export async function getHeyGenDefaults(): Promise<HeyGenDefaults> {
  if (!supabaseAdmin) {
    return {
      avatarId: process.env.HEYGEN_AVATAR_ID ?? null,
      voiceId: process.env.HEYGEN_VOICE_ID ?? null,
    }
  }

  const { data: defaults } = await supabaseAdmin
    .from('heygen_config')
    .select('asset_type, asset_id')
    .eq('is_default', true)

  let avatarId: string | null = null
  let voiceId: string | null = null

  for (const row of defaults ?? []) {
    if (row.asset_type === 'avatar') avatarId = row.asset_id
    if (row.asset_type === 'voice') voiceId = row.asset_id
  }

  return {
    avatarId: avatarId || process.env.HEYGEN_AVATAR_ID || null,
    voiceId: voiceId || process.env.HEYGEN_VOICE_ID || null,
  }
}

/**
 * Get all synced config rows by asset type.
 */
export async function getHeyGenConfigByType(assetType: 'avatar' | 'voice'): Promise<HeyGenConfigRow[]> {
  if (!supabaseAdmin) return []

  const PAGE_SIZE = 1000
  let all: HeyGenConfigRow[] = []
  let from = 0

  while (true) {
    const { data } = await supabaseAdmin
      .from('heygen_config')
      .select('id, asset_type, asset_id, asset_name, is_default, is_favorite, metadata, synced_at')
      .eq('asset_type', assetType)
      .order('is_favorite', { ascending: false })
      .order('is_default', { ascending: false })
      .order('asset_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    const rows = (data ?? []) as HeyGenConfigRow[]
    all = all.concat(rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

/**
 * Set a specific asset as the default for its type.
 * Clears any previous default for that type (partial unique index enforces this).
 */
export async function setDefault(assetType: 'avatar' | 'voice', assetId: string): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'supabaseAdmin not available' }

  const { error: clearErr } = await supabaseAdmin
    .from('heygen_config')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('asset_type', assetType)
    .eq('is_default', true)

  if (clearErr) return { error: clearErr.message }

  const { error: setErr } = await supabaseAdmin
    .from('heygen_config')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('asset_type', assetType)
    .eq('asset_id', assetId)

  if (setErr) return { error: setErr.message }

  return { error: null }
}

/**
 * Toggle the is_favorite flag for an asset.
 */
export async function toggleFavorite(assetType: 'avatar' | 'voice', assetId: string, favorite: boolean): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'supabaseAdmin not available' }

  const { error } = await supabaseAdmin
    .from('heygen_config')
    .update({ is_favorite: favorite, updated_at: new Date().toISOString() })
    .eq('asset_type', assetType)
    .eq('asset_id', assetId)

  return { error: error?.message ?? null }
}

/**
 * Manually add an asset by ID (for assets not returned by the HeyGen list API).
 * Marks as favorite by default.
 */
export async function addManualAsset(
  assetType: 'avatar' | 'voice',
  assetId: string,
  assetName: string,
  opts?: { avatarCharacterKind?: 'avatar' | 'talking_photo' }
): Promise<{ id: string | null; error: string | null }> {
  if (!supabaseAdmin) return { id: null, error: 'supabaseAdmin not available' }

  const metadata: Record<string, unknown> = { manual: true }
  if (assetType === 'avatar') {
    metadata[HEYGEN_CHARACTER_KIND_KEY] = opts?.avatarCharacterKind ?? 'avatar'
  }

  const { data, error } = await supabaseAdmin
    .from('heygen_config')
    .upsert({
      asset_type: assetType,
      asset_id: assetId,
      asset_name: assetName,
      is_favorite: true,
      metadata,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'asset_type,asset_id', ignoreDuplicates: false })
    .select('id')
    .single()

  if (error) return { id: null, error: error.message }
  return { id: data?.id ?? null, error: null }
}

/**
 * Sync avatars and voices from HeyGen API into heygen_config table.
 * Uses upsert (on conflict asset_type + asset_id → update name/metadata/synced_at).
 * Does NOT remove rows for assets no longer in HeyGen (they may still be referenced by jobs).
 */
export async function syncFromHeyGen(): Promise<SyncResult> {
  if (!supabaseAdmin) return { avatarsSynced: 0, voicesSynced: 0, error: 'supabaseAdmin not available' }

  const [avatarResult, voiceResult] = await Promise.all([listAvatars(), listVoices()])

  const errors: string[] = []
  let avatarsSynced = 0
  let voicesSynced = 0

  if (avatarResult.error) {
    errors.push(`Avatars: ${avatarResult.error}`)
  } else if (avatarResult.avatars.length > 0) {
    const { data: existingAvatarRows } = await supabaseAdmin
      .from('heygen_config')
      .select('asset_id, metadata')
      .eq('asset_type', 'avatar')

    const existingMeta = new Map<string, Record<string, unknown>>()
    for (const row of existingAvatarRows ?? []) {
      const id = row.asset_id as string
      const m = row.metadata
      existingMeta.set(id, m && typeof m === 'object' ? { ...(m as Record<string, unknown>) } : {})
    }

    const now = new Date().toISOString()
    const deduped = deduplicateById(
      avatarResult.avatars.map(a => {
        const prev = existingMeta.get(a.id) ?? {}
        const meta: Record<string, unknown> = { ...prev }
        meta[HEYGEN_CHARACTER_KIND_KEY] = a.characterKind
        meta.lastSyncedFromApi = true

        return {
          asset_type: 'avatar' as const,
          asset_id: a.id,
          asset_name: a.name,
          metadata: meta,
          synced_at: now,
          updated_at: now,
        }
      })
    )

    const { upserted, errors: batchErrors } = await batchUpsert(deduped)
    avatarsSynced = upserted
    if (batchErrors.length) errors.push(`Avatar upsert: ${batchErrors.join('; ')}`)
  }

  if (voiceResult.error) {
    errors.push(`Voices: ${voiceResult.error}`)
  } else if (voiceResult.voices.length > 0) {
    const deduped = deduplicateById(voiceResult.voices.map(v => ({
      asset_type: 'voice' as const,
      asset_id: v.id,
      asset_name: v.name,
      metadata: { language: v.language, gender: v.gender },
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })))

    const { upserted, errors: batchErrors } = await batchUpsert(deduped)
    voicesSynced = upserted
    if (batchErrors.length) errors.push(`Voice upsert: ${batchErrors.join('; ')}`)
  }

  return {
    avatarsSynced,
    voicesSynced,
    error: errors.length > 0 ? errors.join('; ') : null,
  }
}

type UpsertRow = {
  asset_type: 'avatar' | 'voice'
  asset_id: string
  asset_name: string
  metadata: Record<string, unknown>
  synced_at: string
  updated_at: string
}

/** Deduplicate rows by asset_id (keeps last occurrence). */
function deduplicateById(rows: UpsertRow[]): UpsertRow[] {
  const map = new Map<string, UpsertRow>()
  for (const row of rows) {
    map.set(row.asset_id, row)
  }
  return Array.from(map.values())
}

/**
 * Upsert rows in batches to avoid Postgres "ON CONFLICT DO UPDATE cannot affect
 * row a second time" when the same key appears twice in one statement.
 */
async function batchUpsert(rows: UpsertRow[]): Promise<{ upserted: number; errors: string[] }> {
  if (!supabaseAdmin) return { upserted: 0, errors: ['supabaseAdmin not available'] }

  const BATCH_SIZE = 200
  let upserted = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabaseAdmin
      .from('heygen_config')
      .upsert(batch, { onConflict: 'asset_type,asset_id', ignoreDuplicates: false })

    if (error) {
      errors.push(error.message)
    } else {
      upserted += batch.length
    }
  }

  return { upserted, errors }
}
