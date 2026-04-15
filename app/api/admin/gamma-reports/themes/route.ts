import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  listGammaThemeConfigRows,
  getResolvedDefaultThemeId,
  getGammaThemeSyncState,
  recordGammaThemeSyncResult,
  syncGammaThemesFromApi,
  setGammaThemeDefault,
  toggleGammaThemeFavorite,
  addManualGammaTheme,
} from '@/lib/gamma-theme-config'

export const dynamic = 'force-dynamic'

/**
 * GET — DB-backed theme catalog + resolved default (DB row, else GAMMA_DEFAULT_THEME_ID).
 * Run POST action=sync to refresh from Gamma (paginated /themes).
 */
export async function GET(_request: NextRequest) {
  const auth = await verifyAdmin(_request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [rows, defaultThemeId, syncRow] = await Promise.all([
    listGammaThemeConfigRows(),
    getResolvedDefaultThemeId(),
    getGammaThemeSyncState(),
  ])

  const themeAssets = rows.map((r) => ({
    asset_id: r.theme_id,
    asset_name:
      defaultThemeId && r.theme_id === defaultThemeId
        ? `${r.theme_name} (AmaduTown)`
        : r.theme_name,
    is_favorite: r.is_favorite,
    is_default: r.is_default,
    metadata: r.metadata,
  }))

  const lastSync = syncRow
    ? {
        syncedAt: syncRow.synced_at,
        success: syncRow.success,
        themesSynced: syncRow.themes_synced,
        error: syncRow.error_message,
      }
    : null

  const res = NextResponse.json({
    themes: rows.map((r) => ({ id: r.theme_id, name: r.theme_name })),
    themeAssets,
    defaultThemeId,
    lastSync,
    hasApiKey: Boolean(process.env.GAMMA_API_KEY),
  })
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}

/**
 * POST — sync from Gamma API | set default | favorite | add manual theme id
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as string

  if (action === 'sync') {
    try {
      const result = await syncGammaThemesFromApi()
      await recordGammaThemeSyncResult(result)
      if (result.error) {
        console.warn('[gamma-themes] Sync completed with errors:', result.error)
      }
      return NextResponse.json({
        message: 'Sync complete',
        themesSynced: result.themesSynced,
        error: result.error,
        success: result.error === null,
        syncedAt: new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[gamma-themes] Sync error:', err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (action === 'set_default') {
    const themeId = (body.themeId as string)?.trim()
    if (!themeId) {
      return NextResponse.json({ error: 'themeId is required' }, { status: 400 })
    }
    const result = await setGammaThemeDefault(themeId)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ message: `Default theme set to ${themeId}` })
  }

  if (action === 'toggle_favorite') {
    const themeId = (body.themeId as string)?.trim()
    const favorite = body.favorite as boolean
    if (!themeId) {
      return NextResponse.json({ error: 'themeId is required' }, { status: 400 })
    }
    const result = await toggleGammaThemeFavorite(themeId, favorite)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ message: `Favorite ${favorite ? 'added' : 'removed'}` })
  }

  if (action === 'add_manual') {
    const themeId = (body.themeId as string)?.trim()
    const themeName = (body.themeName as string)?.trim() || themeId
    if (!themeId) {
      return NextResponse.json({ error: 'themeId is required' }, { status: 400 })
    }
    const result = await addManualGammaTheme(themeId, themeName)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ message: `Added theme ${themeId}` })
  }

  return NextResponse.json(
    { error: 'Unknown action. Use "sync", "set_default", "toggle_favorite", or "add_manual".' },
    { status: 400 }
  )
}
