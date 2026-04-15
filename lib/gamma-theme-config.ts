/**
 * Gamma theme catalog — sync from Gamma API into gamma_theme_config, favorites, default, manual IDs.
 */

import { supabaseAdmin } from './supabase'
import { listAllThemes, type GammaThemeListItem } from './gamma-client'

export interface GammaThemeConfigRow {
  id: string
  theme_id: string
  theme_name: string
  is_default: boolean
  is_favorite: boolean
  metadata: Record<string, unknown>
  synced_at: string
}

export interface GammaThemeSyncStateRow {
  synced_at: string
  success: boolean
  themes_synced: number
  error_message: string | null
}

export interface GammaThemeSyncResult {
  themesSynced: number
  error: string | null
}

/**
 * Theme ID to pass to Gamma generation: explicit selection wins, then DB default, then env.
 */
export async function resolveGammaThemeIdForGeneration(
  explicit?: string | null
): Promise<string | undefined> {
  const t = explicit?.trim()
  if (t) return t

  const fromDb = await getDefaultThemeIdFromDb()
  if (fromDb) return fromDb

  const env = process.env.GAMMA_DEFAULT_THEME_ID?.trim()
  return env || undefined
}

async function getDefaultThemeIdFromDb(): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('gamma_theme_config')
    .select('theme_id')
    .eq('is_default', true)
    .maybeSingle()

  if (error || !data?.theme_id) return null
  return data.theme_id as string
}

/**
 * Resolved default for admin UI: DB default row, else GAMMA_DEFAULT_THEME_ID.
 */
export async function getResolvedDefaultThemeId(): Promise<string | null> {
  const db = await getDefaultThemeIdFromDb()
  if (db) return db
  return process.env.GAMMA_DEFAULT_THEME_ID?.trim() || null
}

export async function getGammaThemeSyncState(): Promise<GammaThemeSyncStateRow | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('gamma_theme_sync_state')
    .select('synced_at, success, themes_synced, error_message')
    .eq('id', 'singleton')
    .maybeSingle()

  if (error || !data) return null
  return data as GammaThemeSyncStateRow
}

export async function recordGammaThemeSyncResult(result: GammaThemeSyncResult): Promise<void> {
  if (!supabaseAdmin) return

  const now = new Date().toISOString()
  await supabaseAdmin.from('gamma_theme_sync_state').upsert(
    {
      id: 'singleton',
      synced_at: now,
      success: result.error === null,
      themes_synced: result.themesSynced,
      error_message: result.error,
      updated_at: now,
    },
    { onConflict: 'id' }
  )
}

export async function listGammaThemeConfigRows(): Promise<GammaThemeConfigRow[]> {
  if (!supabaseAdmin) return []

  const PAGE_SIZE = 1000
  let all: GammaThemeConfigRow[] = []
  let from = 0

  while (true) {
    const { data } = await supabaseAdmin
      .from('gamma_theme_config')
      .select('id, theme_id, theme_name, is_default, is_favorite, metadata, synced_at')
      .order('is_favorite', { ascending: false })
      .order('is_default', { ascending: false })
      .order('theme_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    const rows = (data ?? []) as GammaThemeConfigRow[]
    all = all.concat(rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

export async function setGammaThemeDefault(themeId: string): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'supabaseAdmin not available' }

  const { error: clearErr } = await supabaseAdmin
    .from('gamma_theme_config')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('is_default', true)

  if (clearErr) return { error: clearErr.message }

  const { error: setErr } = await supabaseAdmin
    .from('gamma_theme_config')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('theme_id', themeId)

  if (setErr) return { error: setErr.message }
  return { error: null }
}

export async function toggleGammaThemeFavorite(
  themeId: string,
  favorite: boolean
): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'supabaseAdmin not available' }

  const { error } = await supabaseAdmin
    .from('gamma_theme_config')
    .update({ is_favorite: favorite, updated_at: new Date().toISOString() })
    .eq('theme_id', themeId)

  return { error: error?.message ?? null }
}

export async function addManualGammaTheme(
  themeId: string,
  themeName: string
): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'supabaseAdmin not available' }

  const { error } = await supabaseAdmin.from('gamma_theme_config').upsert(
    {
      theme_id: themeId,
      theme_name: themeName,
      is_favorite: true,
      metadata: { manual: true },
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'theme_id', ignoreDuplicates: false }
  )

  return { error: error?.message ?? null }
}

function dedupeThemesById(themes: GammaThemeListItem[]): GammaThemeListItem[] {
  const map = new Map<string, GammaThemeListItem>()
  for (const t of themes) {
    map.set(t.id, t)
  }
  return Array.from(map.values())
}

/**
 * Paginated fetch from Gamma + upsert into gamma_theme_config.
 * Preserves is_default, is_favorite, and merges metadata for existing theme_id rows.
 */
export async function syncGammaThemesFromApi(): Promise<GammaThemeSyncResult> {
  if (!supabaseAdmin) {
    return { themesSynced: 0, error: 'supabaseAdmin not available' }
  }

  const { themes: apiThemes, error: apiError } = await listAllThemes()
  if (apiError) {
    return { themesSynced: 0, error: apiError }
  }

  const { data: existingRows } = await supabaseAdmin
    .from('gamma_theme_config')
    .select('theme_id, is_default, is_favorite, metadata')

  const existing = new Map<
    string,
    { is_default: boolean; is_favorite: boolean; metadata: Record<string, unknown> }
  >()
  for (const row of existingRows ?? []) {
    const id = row.theme_id as string
    existing.set(id, {
      is_default: Boolean(row.is_default),
      is_favorite: Boolean(row.is_favorite),
      metadata: (row.metadata as Record<string, unknown>) || {},
    })
  }

  const deduped = dedupeThemesById(apiThemes)
  const now = new Date().toISOString()

  const payload = deduped.map((t) => {
    const prev = existing.get(t.id)
    const meta: Record<string, unknown> = { ...(prev?.metadata ?? {}) }
    if (t.type) meta.gammaType = t.type
    meta.lastSyncedFromApi = true

    return {
      theme_id: t.id,
      theme_name: t.name,
      is_default: prev?.is_default ?? false,
      is_favorite: prev?.is_favorite ?? false,
      metadata: meta,
      synced_at: now,
      updated_at: now,
    }
  })

  const BATCH = 200
  let errors: string[] = []
  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH)
    const { error } = await supabaseAdmin
      .from('gamma_theme_config')
      .upsert(batch, { onConflict: 'theme_id', ignoreDuplicates: false })
    if (error) errors.push(error.message)
  }

  const envDefault = process.env.GAMMA_DEFAULT_THEME_ID?.trim()
  if (envDefault && payload.some((p) => p.theme_id === envDefault)) {
    const { data: hasDefault } = await supabaseAdmin
      .from('gamma_theme_config')
      .select('theme_id')
      .eq('is_default', true)
      .maybeSingle()
    if (!hasDefault) {
      await setGammaThemeDefault(envDefault)
    }
  }

  return {
    themesSynced: payload.length,
    error: errors.length ? errors.join('; ') : null,
  }
}
