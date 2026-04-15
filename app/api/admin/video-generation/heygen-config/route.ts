import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  getHeyGenConfigByType,
  getHeyGenDefaults,
  getHeyGenSyncState,
  recordHeyGenSyncResult,
  setDefault,
  toggleFavorite,
  addManualAsset,
  syncFromHeyGen,
} from '@/lib/heygen-config'
import { resolveAssetName } from '@/lib/heygen'
import { startVideoGenRun, completeVideoGenRun } from '@/lib/video-generation-workflow-runs'

export const dynamic = 'force-dynamic'

/**
 * GET — return synced avatars, voices, and current defaults.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const [avatars, voices, defaults, syncRow] = await Promise.all([
    getHeyGenConfigByType('avatar'),
    getHeyGenConfigByType('voice'),
    getHeyGenDefaults(),
    getHeyGenSyncState(),
  ])

  const lastSync = syncRow
    ? {
        syncedAt: syncRow.synced_at,
        success: syncRow.success,
        avatarsSynced: syncRow.avatars_synced,
        voicesSynced: syncRow.voices_synced,
        error: syncRow.error_message,
        hadNewResults: syncRow.avatars_synced + syncRow.voices_synced > 0,
      }
    : null

  return NextResponse.json({
    avatars,
    voices,
    defaults,
    lastSync,
    envFallback: {
      avatarId: process.env.HEYGEN_AVATAR_ID ?? null,
      voiceId: process.env.HEYGEN_VOICE_ID ?? null,
    },
  })
}

/**
 * POST — sync from HeyGen API or set a default.
 * Body: { action: 'sync' } | { action: 'set_default', assetType: 'avatar'|'voice', assetId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const action = body.action as string

  if (action === 'sync') {
    const run = await startVideoGenRun('vgen_heygen')
    try {
      const result = await syncFromHeyGen()
      if (result.error) {
        console.warn('[heygen-config] Sync completed with errors:', result.error)
      }
      await recordHeyGenSyncResult(result)
      const items = result.avatarsSynced + result.voicesSynced
      if (run) {
        await completeVideoGenRun(run.id, {
          success: result.error === null,
          itemsInserted: items,
          errorMessage: result.error,
        })
      }
      return NextResponse.json({
        message: 'Sync complete',
        avatarsSynced: result.avatarsSynced,
        voicesSynced: result.voicesSynced,
        error: result.error,
        success: result.error === null,
        hadNewResults: items > 0,
        syncedAt: new Date().toISOString(),
        run_id: run?.id ?? null,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (run) {
        await completeVideoGenRun(run.id, { success: false, errorMessage: msg })
      }
      console.error('[heygen-config] Sync error:', err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (action === 'set_default') {
    const assetType = body.assetType as 'avatar' | 'voice'
    const assetId = body.assetId as string

    if (!assetType || !['avatar', 'voice'].includes(assetType)) {
      return NextResponse.json({ error: 'assetType must be avatar or voice' }, { status: 400 })
    }
    if (!assetId?.trim()) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 })
    }

    const result = await setDefault(assetType, assetId.trim())
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ message: `Default ${assetType} set to ${assetId}` })
  }

  if (action === 'toggle_favorite') {
    const assetType = body.assetType as 'avatar' | 'voice'
    const assetId = body.assetId as string
    const favorite = body.favorite as boolean

    if (!assetType || !['avatar', 'voice'].includes(assetType)) {
      return NextResponse.json({ error: 'assetType must be avatar or voice' }, { status: 400 })
    }
    if (!assetId?.trim()) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 })
    }

    const result = await toggleFavorite(assetType, assetId.trim(), favorite)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ message: `Favorite ${favorite ? 'added' : 'removed'}` })
  }

  if (action === 'resolve_name') {
    const assetType = body.assetType as 'avatar' | 'voice'
    const assetId = body.assetId as string

    if (!assetType || !['avatar', 'voice'].includes(assetType)) {
      return NextResponse.json({ error: 'assetType must be avatar or voice' }, { status: 400 })
    }
    if (!assetId?.trim()) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 })
    }

    const resolved = await resolveAssetName(assetType, assetId.trim())
    return NextResponse.json({ name: resolved.name, error: resolved.error })
  }

  if (action === 'add_manual') {
    const assetType = body.assetType as 'avatar' | 'voice'
    const assetId = body.assetId as string
    const assetName = body.assetName as string

    if (!assetType || !['avatar', 'voice'].includes(assetType)) {
      return NextResponse.json({ error: 'assetType must be avatar or voice' }, { status: 400 })
    }
    if (!assetId?.trim()) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 })
    }

    const rawKind = body.avatarCharacterKind as string | undefined
    const avatarCharacterKind =
      assetType === 'avatar' && (rawKind === 'talking_photo' || rawKind === 'avatar') ? rawKind : undefined

    const result = await addManualAsset(assetType, assetId.trim(), assetName?.trim() || assetId.trim(), {
      avatarCharacterKind,
    })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ message: `Added ${assetType} ${assetId}`, id: result.id })
  }

  return NextResponse.json({ error: 'Unknown action. Use "sync", "set_default", "toggle_favorite", or "add_manual".' }, { status: 400 })
}
