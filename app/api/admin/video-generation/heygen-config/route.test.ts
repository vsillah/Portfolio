import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getHeyGenConfigByType: vi.fn(),
  getHeyGenDefaults: vi.fn(),
  getHeyGenSyncState: vi.fn(),
  recordHeyGenSyncResult: vi.fn(),
  setDefault: vi.fn(),
  toggleFavorite: vi.fn(),
  addManualAsset: vi.fn(),
  syncFromHeyGen: vi.fn(),
  resolveAssetName: vi.fn(),
  startVideoGenRun: vi.fn(),
  completeVideoGenRun: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/heygen-config', () => ({
  getHeyGenConfigByType: mocks.getHeyGenConfigByType,
  getHeyGenDefaults: mocks.getHeyGenDefaults,
  getHeyGenSyncState: mocks.getHeyGenSyncState,
  recordHeyGenSyncResult: mocks.recordHeyGenSyncResult,
  setDefault: mocks.setDefault,
  toggleFavorite: mocks.toggleFavorite,
  addManualAsset: mocks.addManualAsset,
  syncFromHeyGen: mocks.syncFromHeyGen,
}))

vi.mock('@/lib/heygen', () => ({
  resolveAssetName: mocks.resolveAssetName,
}))

vi.mock('@/lib/video-generation-workflow-runs', () => ({
  startVideoGenRun: mocks.startVideoGenRun,
  completeVideoGenRun: mocks.completeVideoGenRun,
}))

import { GET, POST } from './route'

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/video-generation/heygen-config', {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/video-generation/heygen-config', () => {
  const originalAvatar = process.env.HEYGEN_AVATAR_ID
  const originalVoice = process.env.HEYGEN_VOICE_ID

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-27T10:00:00.000Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete process.env.HEYGEN_AVATAR_ID
    delete process.env.HEYGEN_VOICE_ID
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getHeyGenConfigByType.mockImplementation(async (type: string) => (
      type === 'avatar' ? [{ id: 'avatar-row' }] : [{ id: 'voice-row' }]
    ))
    mocks.getHeyGenDefaults.mockResolvedValue({ avatarId: 'avatar-1', voiceId: 'voice-1' })
    mocks.getHeyGenSyncState.mockResolvedValue(null)
    mocks.syncFromHeyGen.mockResolvedValue({ avatarsSynced: 2, voicesSynced: 1, error: null })
    mocks.recordHeyGenSyncResult.mockResolvedValue(undefined)
    mocks.startVideoGenRun.mockResolvedValue({ id: 'run-1', agentRunId: 'agent-1' })
    mocks.completeVideoGenRun.mockResolvedValue(undefined)
    mocks.setDefault.mockResolvedValue({ error: null })
    mocks.toggleFavorite.mockResolvedValue({ error: null })
    mocks.addManualAsset.mockResolvedValue({ error: null, id: 'manual-1' })
    mocks.resolveAssetName.mockResolvedValue({ name: 'Ada', error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalAvatar === undefined) delete process.env.HEYGEN_AVATAR_ID
    else process.env.HEYGEN_AVATAR_ID = originalAvatar
    if (originalVoice === undefined) delete process.env.HEYGEN_VOICE_ID
    else process.env.HEYGEN_VOICE_ID = originalVoice
  })

  it('requires admin auth on GET and POST', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(makeRequest())
    const postResponse = await POST(makeRequest({ action: 'sync' }))

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(mocks.getHeyGenConfigByType).not.toHaveBeenCalled()
    expect(mocks.syncFromHeyGen).not.toHaveBeenCalled()
  })

  it('returns a null last sync and null env fallback when neither is configured', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      avatars: [{ id: 'avatar-row' }],
      voices: [{ id: 'voice-row' }],
      defaults: { avatarId: 'avatar-1', voiceId: 'voice-1' },
      lastSync: null,
      envFallback: { avatarId: null, voiceId: null },
    })
  })

  it('marks a sync row as having new results only when avatars or voices were stored', async () => {
    mocks.getHeyGenSyncState.mockResolvedValue({
      synced_at: '2026-09-26T10:00:00.000Z',
      success: true,
      avatars_synced: 0,
      voices_synced: 0,
      error_message: null,
    })
    process.env.HEYGEN_AVATAR_ID = 'env-avatar'
    process.env.HEYGEN_VOICE_ID = 'env-voice'

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(body.lastSync).toEqual({
      syncedAt: '2026-09-26T10:00:00.000Z',
      success: true,
      avatarsSynced: 0,
      voicesSynced: 0,
      error: null,
      hadNewResults: false,
    })
    expect(body.envFallback).toEqual({ avatarId: 'env-avatar', voiceId: 'env-voice' })
  })

  it('records a sync that completed with an error and still returns 200', async () => {
    mocks.syncFromHeyGen.mockResolvedValue({
      avatarsSynced: 1,
      voicesSynced: 0,
      error: 'voice list failed',
    })

    const response = await POST(makeRequest({ action: 'sync' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Sync complete',
      avatarsSynced: 1,
      voicesSynced: 0,
      error: 'voice list failed',
      success: false,
      hadNewResults: true,
      syncedAt: '2026-09-27T10:00:00.000Z',
      run_id: 'run-1',
      agent_run_id: 'agent-1',
    })
    expect(mocks.startVideoGenRun).toHaveBeenCalledWith('vgen_heygen')
    expect(mocks.recordHeyGenSyncResult).toHaveBeenCalledWith({
      avatarsSynced: 1,
      voicesSynced: 0,
      error: 'voice list failed',
    })
    expect(mocks.completeVideoGenRun).toHaveBeenCalledWith('run-1', {
      success: false,
      itemsInserted: 1,
      errorMessage: 'voice list failed',
    })
  })

  it('completes the run as failed when sync throws and does not record a result', async () => {
    mocks.syncFromHeyGen.mockRejectedValue('heygen down')

    const response = await POST(makeRequest({ action: 'sync' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'heygen down' })
    expect(mocks.recordHeyGenSyncResult).not.toHaveBeenCalled()
    expect(mocks.completeVideoGenRun).toHaveBeenCalledWith('run-1', {
      success: false,
      errorMessage: 'heygen down',
    })
  })

  it('rejects an unknown action and invalid default targets before writing', async () => {
    const unknown = await POST(makeRequest({ action: 'resolve_name_typo' }))
    expect(unknown.status).toBe(400)
    await expect(unknown.json()).resolves.toEqual({
      error: 'Unknown action. Use "sync", "set_default", "toggle_favorite", or "add_manual".',
    })

    const badType = await POST(makeRequest({ action: 'set_default', assetType: 'template', assetId: 'abc' }))
    expect(badType.status).toBe(400)
    await expect(badType.json()).resolves.toEqual({ error: 'assetType must be avatar or voice' })

    const blankId = await POST(makeRequest({ action: 'set_default', assetType: 'avatar', assetId: '  ' }))
    expect(blankId.status).toBe(400)
    await expect(blankId.json()).resolves.toEqual({ error: 'assetId is required' })
    expect(mocks.setDefault).not.toHaveBeenCalled()
  })

  it('trims the stored default id but echoes the raw id in the message', async () => {
    const response = await POST(makeRequest({
      action: 'set_default',
      assetType: 'voice',
      assetId: ' voice-9 ',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Default voice set to  voice-9 ' })
    expect(mocks.setDefault).toHaveBeenCalledWith('voice', 'voice-9')
  })

  it('returns the default-write error and toggles favorite with the supplied boolean', async () => {
    mocks.setDefault.mockResolvedValue({ error: 'asset missing' })

    const failed = await POST(makeRequest({ action: 'set_default', assetType: 'avatar', assetId: 'missing' }))
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'asset missing' })

    const removed = await POST(makeRequest({
      action: 'toggle_favorite',
      assetType: 'avatar',
      assetId: ' avatar-2 ',
      favorite: false,
    }))
    expect(removed.status).toBe(200)
    await expect(removed.json()).resolves.toEqual({ message: 'Favorite removed' })
    expect(mocks.toggleFavorite).toHaveBeenCalledWith('avatar', 'avatar-2', false)
  })

  it('resolves a name even when the lookup reports an error', async () => {
    mocks.resolveAssetName.mockResolvedValue({ name: null, error: 'not found' })

    const response = await POST(makeRequest({
      action: 'resolve_name',
      assetType: 'voice',
      assetId: ' voice-x ',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ name: null, error: 'not found' })
    expect(mocks.resolveAssetName).toHaveBeenCalledWith('voice', 'voice-x')
  })

  it('falls back to the asset id for a blank name and keeps only avatar character kinds', async () => {
    const response = await POST(makeRequest({
      action: 'add_manual',
      assetType: 'avatar',
      assetId: ' avatar-3 ',
      assetName: ' ',
      avatarCharacterKind: 'talking_photo',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Added avatar  avatar-3 ',
      id: 'manual-1',
    })
    expect(mocks.addManualAsset).toHaveBeenCalledWith('avatar', 'avatar-3', 'avatar-3', {
      avatarCharacterKind: 'talking_photo',
    })

    await POST(makeRequest({
      action: 'add_manual',
      assetType: 'voice',
      assetId: 'voice-3',
      assetName: 'Narrator',
      avatarCharacterKind: 'talking_photo',
    }))
    expect(mocks.addManualAsset).toHaveBeenLastCalledWith('voice', 'voice-3', 'Narrator', {
      avatarCharacterKind: undefined,
    })
  })
})
